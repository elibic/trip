// The one place that talks to the Firebase SDK loader. Everything else
// imports the ready instances from here.
import { firebaseConfig, SDK } from './config.js';

const params = new URLSearchParams(location.search);
export const EMU = params.has('emu') && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
export const configured = !!firebaseConfig || EMU;

const appMod = await import(`${SDK}/firebase-app.js`);
export const fs = await import(`${SDK}/firebase-firestore.js`);
export const au = await import(`${SDK}/firebase-auth.js`);

let app = null, db = null, auth = null;
if (configured) {
  const cfg = firebaseConfig || { apiKey: 'demo-key', authDomain: 'localhost', projectId: 'demo-dandash' };
  app = appMod.initializeApp(cfg);
  // A local cache makes repeat visits cost almost nothing and keeps the app
  // usable on a weak connection.
  try {
    db = fs.initializeFirestore(app, EMU
      ? { experimentalForceLongPolling: true }
      : { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) });
  } catch (e) {
    db = fs.getFirestore(app);
  }
  auth = au.getAuth(app);
  if (EMU) {
    fs.connectFirestoreEmulator(db, '127.0.0.1', 8080);
    au.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  }
}
export { app, db, auth };
