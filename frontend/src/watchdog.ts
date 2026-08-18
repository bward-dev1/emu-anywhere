/**
 * Main-thread stall detector.
 *
 * The page posts a heartbeat to a worker on a timer. The worker checks the clock
 * on its own thread, so it keeps counting while the main thread is busy, blocked
 * or wedged. When beats resume it reports how long they were missing.
 *
 * Be clear about what this can and cannot do. A worker cannot touch the DOM, so
 * if the main thread never comes back there is nothing on screen to click and no
 * watchdog can change that -- the fix for that case is not to wedge in the first
 * place, which is what the boot timeout in cores/gba.ts and the isolation
 * recovery in coi.ts are for. What this gives you is the case that does recover:
 * a stall long enough that the app looked dead is noticed and reported rather
 * than passing silently, and the user is offered a reload instead of being left
 * to guess.
 *
 * Backgrounded tabs are excluded. Every browser stops rAF and throttles timers
 * in a hidden tab, so counting that as a stall would fire constantly on an iPad
 * where switching apps is normal.
 */

const BEAT_INTERVAL_MS = 500;
/** Long enough that a slow ROM load or a GC pause is not reported as a stall. */
const STALL_THRESHOLD_MS = 6000;

const WORKER_SOURCE = `
let last = Date.now();
self.onmessage = (e) => {
  if (e.data !== 'beat') return;
  const now = Date.now();
  const gap = now - last;
  last = now;
  if (gap > ${STALL_THRESHOLD_MS}) self.postMessage({ gap });
};
`;

export interface StallReport {
  /** Milliseconds the main thread went without sending a heartbeat. */
  gap: number;
}

let started = false;

/**
 * Start watching. Returns a teardown function, or null when workers or blob URLs
 * are unavailable (in which case the app simply runs without a watchdog).
 */
export function startWatchdog(onStall: (report: StallReport) => void): (() => void) | null {
  if (started || typeof Worker === 'undefined') return null;

  let worker: Worker;
  let url: string;
  try {
    url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'application/javascript' }));
    worker = new Worker(url);
  } catch (error) {
    console.warn('Watchdog unavailable:', error);
    return null;
  }
  started = true;

  worker.onmessage = (event: MessageEvent<StallReport>) => {
    // A hidden tab is throttled by design, not stalled.
    if (document.visibilityState !== 'visible') return;
    onStall(event.data);
  };

  // Beat even while hidden. Timers are throttled rather than stopped, so the
  // worker's clock stays roughly fresh and coming back to the tab does not
  // immediately look like a stall -- and the onmessage handler above discards
  // anything reported while the tab was not visible anyway.
  const timer = window.setInterval(() => worker.postMessage('beat'), BEAT_INTERVAL_MS);

  return () => {
    window.clearInterval(timer);
    worker.terminate();
    URL.revokeObjectURL(url);
    started = false;
  };
}
