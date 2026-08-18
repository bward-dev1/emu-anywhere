/*
 * Cross-origin isolation for GitHub Pages.
 *
 * mgba-wasm is an Emscripten pthreads build: it allocates its heap as
 * `new WebAssembly.Memory({..., shared: true})` and posts that SharedArrayBuffer
 * to a worker during module init. The browser only hands out SharedArrayBuffer
 * when the page is cross-origin isolated, which needs two response headers on
 * the document:
 *
 *   Cross-Origin-Opener-Policy:   same-origin
 *   Cross-Origin-Embedder-Policy: require-corp
 *
 * GitHub Pages serves static files and cannot be configured to send them, so on
 * the deployed site `crossOriginIsolated` was false, `SharedArrayBuffer` was
 * undefined, and every GBA boot died with
 *   "SharedArrayBuffer transfer requires self.crossOriginIsolated"
 * leaving a mounted-but-black 240x160 canvas. (The older IodineGBA core avoided
 * this by staying on the main thread -- see gba-iodine.ts.bak.)
 *
 * A service worker can synthesize the headers a static host will not send: it
 * re-issues the navigation request and returns an equivalent Response with the
 * two headers added. The page that results IS cross-origin isolated.
 *
 * This file is injected at the TOP of the Workbox-generated service worker via
 * `workbox.importScripts` in vite.config.ts, so its fetch listener is registered
 * before Workbox's routing and wins the navigation request. Everything that is
 * not a navigation falls through to Workbox untouched, so precaching and the
 * offline behaviour of the PWA are unchanged.
 *
 * COEP require-corp only constrains CROSS-origin subresources. Every asset this
 * app loads (mgba wasm/js chunks, static/wasmemulator.*, static/webmelon.js,
 * icons) is same-origin, so nothing needs a CORP header.
 */

/*
 * Which requests we take over.
 *
 * - navigate: the document response is what makes the page isolated at all.
 * - worker:   mgba-wasm spawns its pthread pool with `new Worker(...)`. A worker
 *             started from an isolated page only starts if its OWN script
 *             response also carries the isolation headers. Workbox precaches
 *             that chunk and replays it from Cache Storage with the headers it
 *             was stored with -- none -- so the worker never boots, the pthread
 *             pool never reports ready, and the mGBA module factory hangs
 *             forever instead of rejecting: a mounted-but-black canvas and no
 *             error anywhere. Verified: identical build served with real COOP/
 *             COEP headers and no service worker initialises mGBA in ~125ms.
 */
const HANDLED_DESTINATIONS = new Set(['worker', 'sharedworker']);

/*
 * Worker scripts are cache-FIRST, the navigation is network-first.
 *
 * The worker URL is a content-hashed asset (assets/mgba-<hash>.js) derived from
 * the main chunk the page is already running, so the only correct copy is the
 * one belonging to the build that is loaded. Cache Storage holds exactly that
 * build -- Workbox precached it alongside the chunk that references it. Going to
 * the network instead is what breaks after a deploy: a client still running the
 * previous build asks GitHub Pages for the previous build's hash, which no
 * longer exists, gets a 404, and because a 404 is a perfectly successful fetch
 * the old code passed it straight through. The worker then fails to start, the
 * pthread pool never reports ready, and module init hangs with no error --
 * indistinguishable, from the outside, from the app freezing.
 *
 * The document is the opposite case: it is not content-hashed, and serving a
 * stale index.html is how a client gets pinned to a dead build in the first
 * place, so that one stays network-first with the cache as an offline fallback.
 */
const withIsolationHeaders = (response) => {
  // An opaque response has an unreadable body and immutable headers; passing it
  // through unchanged is better than throwing.
  if (response.type === 'opaque' || response.type === 'opaqueredirect') {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  // Same-origin responses do not strictly need CORP, but stating it keeps the
  // worker script acceptable to the embedder check on every browser rather than
  // relying on the same-origin shortcut.
  headers.set('Cross-Origin-Resource-Policy', 'same-origin');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
};

const fromCache = (request) =>
  caches
    .match(request, { ignoreSearch: true })
    .catch(() => undefined);

const fromNetwork = async (request) => {
  try {
    const response = await fetch(request);
    // A 404/5xx is a fetch that succeeded and an asset that did not. Treat it as
    // a miss so the caller can fall back, rather than handing the browser a
    // Response it will choke on.
    return response.ok || response.type === 'opaque' ? response : undefined;
  } catch {
    return undefined;
  }
};

self.addEventListener('fetch', (event) => {
  const request = event.request;

  const isNavigation = request.mode === 'navigate';
  const isWorkerScript = HANDLED_DESTINATIONS.has(request.destination);
  if (!isNavigation && !isWorkerScript) return;

  // Cross-origin requests are none of our business, and rewriting them would
  // strip the CORS semantics the browser is relying on.
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      let response;

      if (isWorkerScript) {
        response = (await fromCache(request)) || (await fromNetwork(request));
      } else {
        response = await fromNetwork(request);
        if (!response) {
          // Offline, or the document 404'd. Fall back to whatever Workbox
          // precached so an installed PWA still opens.
          response =
            (await fromCache(request)) ||
            (await caches.match('index.html', { ignoreSearch: true }).catch(() => undefined));
        }
      }

      if (!response) {
        // Nothing anywhere. Fail out loud with a status the caller can see,
        // instead of resolving to something that will hang the pthread pool.
        return new Response(`emu-anywhere: no copy of ${request.url} in cache or on the network`, {
          status: 504,
          statusText: 'Gateway Timeout'
        });
      }

      return withIsolationHeaders(response);
    })()
  );
});
