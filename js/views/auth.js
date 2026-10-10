import { state, T } from '../state.js';
import { $, esc, I, openSheet, closeSheet, sheetHead, toast, busy } from '../ui.js';
import { signInGoogle, sendEmailLink, saveProfile } from '../api.js';

// Resolves true once the person is signed in with a display name, false if
// they close the sheet. Everything that writes calls this first.
let waiting = [];
export function requireLogin() {
  if (state.user && state.profile && state.profile.name) return Promise.resolve(true);
  if (state.user) return askName();
  return new Promise((res) => {
    waiting.push(res);
    openAuth();
  });
}
export function resolveLogin(ok) {
  const w = waiting; waiting = [];
  w.forEach((r) => r(ok));
}

export function openAuth() {
  const t = T().auth;
  const sh = openSheet(`${sheetHead(t.title, t.sub)}<div class="body" style="padding-top:14px">
      <button class="btn block" data-google>${googleG()} ${t.google}</button>
      <div class="or"><span>${t.or}</span></div>
      <div class="field"><label for="authmail">${t.email}</label><input type="email" id="authmail" autocomplete="email" inputmode="email" dir="ltr"></div>
      <button class="btn block secondary" data-link>${I.mail} ${t.sendLink}</button>
      <div class="note" id="authnote" hidden></div>
      <button class="btn block ghost" style="margin-top:6px" data-close>${t.later}</button>
    </div>`, { close: () => { if (!state.user) resolveLogin(false); } });
  $('[data-google]', sh).onclick = async (e) => {
    busy(e.currentTarget, true);
    try { await signInGoogle(); }
    catch (err) { console.warn(err); if (err.code !== 'auth/popup-closed-by-user') toast(`${t.fail}: ${err.code || err.message}`); }
    finally { busy(e.currentTarget, false); }
  };
  $('[data-link]', sh).onclick = async (e) => {
    const email = $('#authmail').value.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) { $('#authmail').focus(); return; }
    busy(e.currentTarget, true);
    try {
      await sendEmailLink(email);
      const n = $('#authnote'); n.hidden = false; n.textContent = t.linkSent;
    } catch (err) { toast(`${t.fail}: ${err.code || err.message}`); }
    finally { busy(e.currentTarget, false); }
  };
}

// First sign-in, or an email-link account with no name yet.
export function askName() {
  const t = T().auth, m = T().mine;
  return new Promise((res) => {
    let done = false;
    const guess = (state.user && state.user.name) || '';
    const sh = openSheet(`${sheetHead(t.nameTitle, t.nameHint)}<div class="body" style="padding-top:14px">
      <div class="field"><input type="text" id="dname" maxlength="40" value="${esc(guess)}" autocomplete="name" dir="auto"></div>
      <button class="btn block" data-save>${m.saveName}</button></div>`, { close: () => { if (!done) { res(false); resolveLogin(false); } } });
    $('[data-save]', sh).onclick = async () => {
      const name = $('#dname').value.trim().slice(0, 40);
      if (!name) { $('#dname').focus(); return; }
      const data = { name, email: state.user.email || '', lang: state.lang };
      if (!state.profile) data.createdAt = Date.now();
      await saveProfile(state.user.uid, data);
      state.profile = { ...(state.profile || {}), ...data };
      state.user.name = name;
      done = true;
      closeSheet();
      res(true);
      resolveLogin(true);
    };
  });
}

const googleG = () => '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="#fff" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z"/><path fill="#fff" opacity=".85" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z"/><path fill="#fff" opacity=".7" d="M6.4 14a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9z"/><path fill="#fff" opacity=".85" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.5L6.4 10C7.2 7.8 9.4 6 12 6z"/></svg>';
