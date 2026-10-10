// Security rules against the Firestore emulator. Run: npm run test:rules
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection, query, where, writeBatch, increment } from 'firebase/firestore';

const DAY = 86400000;
let env;
const ADMIN = { email: 'boss@example.com', email_verified: true };
const ctx = (uid, tok = { email: `${uid}@example.com`, email_verified: true }) => env.authenticatedContext(uid, tok).firestore();
const anon = () => env.unauthenticatedContext().firestore();

function listing(owner, over = {}) {
  const t = Date.now();
  return {
    ownerUid: owner, ownerName: 'Rachel', lang: 'he', translated: true,
    title: { he: 'שמלה', en: 'Dress' }, problemText: { he: 'גדול', en: 'Too big' }, desc: { he: '', en: '' },
    cat: 'clothes', who: 'girls', age: 'a0', cond: 'tag', source: 'next', sourceOther: '', size: '9m', problem: 'big',
    price: 35, origPrice: 89, link: '', hood: 'ramat-b', contact: { msg: true, phone: false, mail: false },
    thumb: 'data:image/webp;base64,AAAA', photoCount: 1, status: 'active', live: true,
    postedAt: t, expiresAt: t + 30 * DAY, promoUntil: 0, views: 0, kw: ['שמלה'], ...over,
  };
}

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-dandash', firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 } });
});
after(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, 'config/admins'), { emails: ['boss@example.com'] });
    await setDoc(doc(db, 'listings/L1'), listing('alice'));
    await setDoc(doc(db, 'listings/HID'), listing('alice', { status: 'hidden', live: false }));
    await setDoc(doc(db, 'listings/L1/private/contact'), { ownerUid: 'alice', phone: '0521234567', email: '' });
    await setDoc(doc(db, 'photos/L1'), { ownerUid: 'alice', list: ['data:x'] });
  });
});

test('anyone reads live listings and the feed query', async () => {
  await assertSucceeds(getDoc(doc(anon(), 'listings/L1')));
  await assertSucceeds(getDocs(query(collection(anon(), 'listings'), where('live', '==', true))));
});
test('an unfiltered listings query is refused for non-admins', async () => {
  await assertFails(getDocs(collection(ctx('bob'), 'listings')));
});
test('hidden listings: owner and admin only', async () => {
  await assertFails(getDoc(doc(anon(), 'listings/HID')));
  await assertFails(getDoc(doc(ctx('bob'), 'listings/HID')));
  await assertSucceeds(getDoc(doc(ctx('alice'), 'listings/HID')));
  await assertSucceeds(getDoc(doc(ctx('boss', ADMIN), 'listings/HID')));
});
test('contact details need sign-in', async () => {
  await assertFails(getDoc(doc(anon(), 'listings/L1/private/contact')));
  await assertSucceeds(getDoc(doc(ctx('bob'), 'listings/L1/private/contact')));
});
test('create: valid listing succeeds, anonymous and forged owner fail', async () => {
  const b = ctx('bob');
  await assertSucceeds(setDoc(doc(b, 'listings/N1'), listing('bob')));
  await assertFails(setDoc(doc(anon(), 'listings/N2'), listing('bob')));
  await assertFails(setDoc(doc(b, 'listings/N3'), listing('alice')));
});
test('create: cannot self-promote, fake views, or stretch expiry', async () => {
  const b = ctx('bob');
  await assertFails(setDoc(doc(b, 'listings/N1'), listing('bob', { promoUntil: Date.now() + DAY })));
  await assertFails(setDoc(doc(b, 'listings/N2'), listing('bob', { views: 50 })));
  const t = Date.now();
  await assertFails(setDoc(doc(b, 'listings/N3'), listing('bob', { postedAt: t, expiresAt: t + 90 * DAY })));
  await assertFails(setDoc(doc(b, 'listings/N4'), listing('bob', { status: 'hidden', live: false })));
});
test('create: bad values are refused', async () => {
  const b = ctx('bob');
  await assertFails(setDoc(doc(b, 'listings/N1'), listing('bob', { price: -5 })));
  await assertFails(setDoc(doc(b, 'listings/N2'), listing('bob', { cat: 'weapons' })));
  await assertFails(setDoc(doc(b, 'listings/N3'), listing('bob', { title: { he: '', en: '' } })));
  await assertFails(setDoc(doc(b, 'listings/N4'), listing('bob', { contact: { msg: false, phone: false, mail: false } })));
  await assertFails(setDoc(doc(b, 'listings/N5'), listing('bob', { extra: 1 })));
});
test('listing, photos and contact in one batch', async () => {
  const b = ctx('bob');
  const wb = writeBatch(b);
  wb.set(doc(b, 'listings/N1'), listing('bob'));
  wb.set(doc(b, 'photos/N1'), { ownerUid: 'bob', list: ['data:a', 'data:b'] });
  wb.set(doc(b, 'listings/N1/private/contact'), { ownerUid: 'bob', phone: '050', email: '' });
  await assertSucceeds(wb.commit());
});
test('owner: status, renew, edit; not promote, not un-hide', async () => {
  const a = ctx('alice');
  await assertSucceeds(updateDoc(doc(a, 'listings/L1'), { status: 'sold', live: false }));
  await assertSucceeds(updateDoc(doc(a, 'listings/L1'), { status: 'active', live: true, expiresAt: Date.now() + 30 * DAY }));
  await assertSucceeds(updateDoc(doc(a, 'listings/L1'), { price: 20 }));
  await assertFails(updateDoc(doc(a, 'listings/L1'), { status: 'sold', live: true }));
  await assertFails(updateDoc(doc(a, 'listings/L1'), { promoUntil: Date.now() + DAY }));
  await assertFails(updateDoc(doc(a, 'listings/L1'), { expiresAt: Date.now() + 300 * DAY }));
  await assertFails(updateDoc(doc(a, 'listings/HID'), { status: 'active', live: true }));
  await assertFails(updateDoc(doc(ctx('bob'), 'listings/L1'), { price: 1 }));
});
test('anyone counts a view, by one only', async () => {
  await assertSucceeds(updateDoc(doc(anon(), 'listings/L1'), { views: increment(1) }));
  await assertFails(updateDoc(doc(anon(), 'listings/L1'), { views: 999 }));
  await assertFails(updateDoc(doc(anon(), 'listings/L1'), { views: increment(1), price: 1 }));
});
test('admin: hide, promote, delete; impostor and unverified email fail', async () => {
  const ad = ctx('boss', ADMIN);
  await assertSucceeds(updateDoc(doc(ad, 'listings/L1'), { status: 'hidden', live: false }));
  await assertSucceeds(updateDoc(doc(ad, 'listings/L1'), { promoUntil: Date.now() + 7 * DAY }));
  await assertFails(updateDoc(doc(ad, 'listings/L1'), { price: 1 }));
  await assertFails(updateDoc(doc(ctx('fake', { email: 'boss@example.com', email_verified: false }), 'listings/L1'), { promoUntil: 5 }));
  const wb = writeBatch(ad);
  wb.delete(doc(ad, 'listings/L1/private/contact'));
  wb.delete(doc(ad, 'photos/L1'));
  wb.delete(doc(ad, 'listings/L1'));
  await assertSucceeds(wb.commit());
});
test('owner deletes own listing with photos and contact', async () => {
  const a = ctx('alice');
  const wb = writeBatch(a);
  wb.delete(doc(a, 'listings/L1/private/contact'));
  wb.delete(doc(a, 'photos/L1'));
  wb.delete(doc(a, 'listings/L1'));
  await assertSucceeds(wb.commit());
});
test('blocked users cannot post', async () => {
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'blocked/bob'), { at: 1 }));
  await assertFails(setDoc(doc(ctx('bob'), 'listings/N1'), listing('bob')));
});
test('admins list: admins only; lists: anyone reads, admins write', async () => {
  await assertFails(getDoc(doc(ctx('bob'), 'config/admins')));
  await assertSucceeds(getDoc(doc(ctx('boss', ADMIN), 'config/admins')));
  await assertSucceeds(getDoc(doc(anon(), 'config/lists')));
  await assertFails(setDoc(doc(ctx('bob'), 'config/lists'), { hoods: [] }));
  await assertSucceeds(setDoc(doc(ctx('boss', ADMIN), 'config/lists'), { hoods: [] }));
});
test('wanted: one doc per uid, 14 days', async () => {
  const t = Date.now();
  const w = { ownerName: 'Bob', lang: 'en', translated: false, text: { he: '', en: 'Coat' }, cat: 'clothes', who: 'girls', age: 'a6', hood: 'ramat-a', postedAt: t, expiresAt: t + 14 * DAY };
  await assertSucceeds(setDoc(doc(ctx('bob'), 'wanted/bob'), w));
  await assertFails(setDoc(doc(ctx('bob'), 'wanted/alice'), w));
  await assertFails(setDoc(doc(ctx('bob'), 'wanted/bob'), { ...w, expiresAt: t + 60 * DAY }));
  await assertSucceeds(getDocs(collection(anon(), 'wanted')));
});
test('threads and messages: participants only', async () => {
  const b = ctx('bob');
  const th = { kind: 'listing', refId: 'L1', title: { he: 'שמלה', en: 'Dress' }, owner: 'alice', buyer: 'bob', participants: ['alice', 'bob'], names: { bob: 'Bob' }, last: '', lastAt: Date.now(), lastBy: 'bob', unread: { alice: 0, bob: 0 } };
  await assertFails(setDoc(doc(b, 'threads/L1_bob'), { ...th, owner: 'carol', participants: ['carol', 'bob'] }));
  await assertFails(setDoc(doc(b, 'threads/L1_eve'), th));
  await assertSucceeds(setDoc(doc(b, 'threads/L1_bob'), th));
  const wb = writeBatch(b);
  wb.set(doc(b, 'threads/L1_bob/messages/m1'), { from: 'bob', text: 'Still available?', at: Date.now() });
  wb.update(doc(b, 'threads/L1_bob'), { last: 'Still available?', lastAt: Date.now(), 'unread.alice': increment(1) });
  await assertSucceeds(wb.commit());
  await assertSucceeds(getDocs(collection(ctx('alice'), 'threads/L1_bob/messages')));
  await assertFails(getDocs(collection(ctx('eve'), 'threads/L1_bob/messages')));
  await assertFails(getDoc(doc(ctx('eve'), 'threads/L1_bob')));
  await assertFails(setDoc(doc(ctx('eve'), 'threads/L1_bob/messages/m2'), { from: 'eve', text: 'hi', at: Date.now() }));
  await assertSucceeds(getDocs(query(collection(ctx('alice'), 'threads'), where('participants', 'array-contains', 'alice'))));
});
test('reports: anyone signed in files one, only admins read', async () => {
  const r = { type: 'listing', targetId: 'L1', reason: 'notnew', note: '', by: 'bob', at: Date.now(), status: 'open' };
  await assertSucceeds(setDoc(doc(ctx('bob'), 'reports/r1'), r));
  await assertFails(setDoc(doc(anon(), 'reports/r2'), r));
  await assertFails(getDoc(doc(ctx('bob'), 'reports/r1')));
  await assertSucceeds(getDoc(doc(ctx('boss', ADMIN), 'reports/r1')));
});
test('users: private to themselves and admins', async () => {
  await assertSucceeds(setDoc(doc(ctx('bob'), 'users/bob'), { name: 'Bob', email: 'bob@example.com', createdAt: 1, saved: [] }));
  await assertFails(getDoc(doc(ctx('alice'), 'users/bob')));
  await assertSucceeds(getDoc(doc(ctx('boss', ADMIN), 'users/bob')));
  await assertFails(setDoc(doc(ctx('bob'), 'users/bob'), { name: 'Bob', admin: true }));
});
