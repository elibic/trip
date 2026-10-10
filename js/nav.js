// Hash routes: #feed, #wanted, #post, #inbox, #mine, #item/<id>, #edit/<id>, #thread/<id>
export function go(route) {
  if (location.hash === '#' + route) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = route;
}
export function route() {
  const [name, arg] = (location.hash.slice(1) || 'feed').split('/');
  return { name, arg: arg ? decodeURIComponent(arg) : null };
}
// Subscriptions owned by the current screen, cancelled when it changes.
const subs = [];
export const own = (unsub) => { if (typeof unsub === 'function') subs.push(unsub); };
export const releaseAll = () => { while (subs.length) { try { subs.pop()(); } catch (e) {} } };
