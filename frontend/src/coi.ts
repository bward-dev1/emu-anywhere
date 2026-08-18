/**
 * Cross-origin isolation bootstrap.
 *
 * public/coi-headers.js teaches the service worker to add COOP/COEP to the
 * document response, but a service worker cannot control the very navigation
 * that installs it. So the first ever visit renders from an un-isolated
 * document: `crossOriginIsolated` is false, `SharedArrayBuffer` is undefined,
 * and a GBA boot would fail exactly the way it failed on the deployed site.
 *
 * One reload, once the worker is active, routes the navigation through it and
 * the page comes back isolated. Every later visit is already isolated and this
 * is a no-op.
 *
 * The sessionStorage flag is the loop guard: if isolation still does not take
 * (a browser with service workers disabled, an unexpected host), we reload at
 * most once per tab session rather than spinning.
 */
const RELOAD_FLAG = 'coi-reload-attempted';

export function ensureCrossOriginIsolated(): void {
  if (window.crossOriginIsolated) return;

  // Service workers need a secure context. On plain http (other than localhost)
  // there is no route to isolation at all, so do not bother reloading.
  if (!window.isSecureContext || !('serviceWorker' in navigator)) return;

  let alreadyTried = false;
  try {
    alreadyTried = sessionStorage.getItem(RELOAD_FLAG) !== null;
  } catch {
    // Storage can throw when cookies/site data are blocked. Treat that as
    // "already tried" rather than risking a reload loop we cannot detect.
    return;
  }
  if (alreadyTried) return;

  navigator.serviceWorker.ready
    .then((registration) => {
      // Re-check: the worker may have claimed this client while we waited.
      if (window.crossOriginIsolated || !registration.active) return;
      sessionStorage.setItem(RELOAD_FLAG, '1');
      window.location.reload();
    })
    .catch(() => {
      // No registration is possible here; leaving the page un-isolated is the
      // correct outcome, and the GBA core surfaces its own error if used.
    });
}
