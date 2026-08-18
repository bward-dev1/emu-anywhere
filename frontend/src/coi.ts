/**
 * Cross-origin isolation bootstrap.
 *
 * public/coi-headers.js teaches the service worker to add COOP/COEP to the
 * document response, but a service worker cannot control the very navigation
 * that installs it. So the first ever visit renders from an un-isolated
 * document: `crossOriginIsolated` is false, `SharedArrayBuffer` is undefined,
 * and a GBA boot would fail exactly the way it failed on the deployed site.
 *
 * One reload, once the worker is active AND controlling this client, routes the
 * navigation through it and the page comes back isolated.
 *
 * WHY THIS IS NOT A ONE-SHOT ANY MORE
 *
 * The previous version set a sessionStorage flag before its single reload and
 * never reloaded again in that tab. That is a loop guard, but it is also a trap:
 * landing un-isolated is not a first-visit-only event. Measured against a local
 * build of the deployed code, eight cold starts produced three loads with
 * `crossOriginIsolated === false`, and in two of them the worker was already
 * controlling the page while the flag was spent -- so the tab could never
 * recover. Pressing Play from there does not error, it hangs: the mGBA module
 * factory never settles, so nothing rejects and no message is ever shown. A
 * black screen that stays black is what "the app froze" looks like from outside.
 *
 * The fix keeps loop protection but makes it self-healing:
 *
 *  - Loading isolated CLEARS the counter. A tab that has proved isolation works
 *    is allowed a fresh attempt if it later loses it.
 *  - Not isolated spends one attempt, up to MAX_ATTEMPTS, and only reloads once
 *    a worker is actually controlling this client -- reloading merely because
 *    `ready` resolved is what produced un-isolated loads before, since `ready`
 *    resolves on an ACTIVE registration that may not have claimed us yet.
 *  - Exhausting the attempts records a terminal state the UI can read via
 *    isolationBlocked(), instead of leaving the core to hang.
 */
const ATTEMPT_KEY = 'coi-reload-attempts';
const MAX_ATTEMPTS = 3;
/** How long to wait for a worker to claim this client before giving up. */
const CONTROLLER_TIMEOUT_MS = 8000;
/**
 * A runaway reload loop retries within a second or two. Anything slower than
 * this is a person coming back to a page, so the budget starts again -- being
 * stuck for the rest of the tab's life is worse than one extra reload.
 */
const ATTEMPT_DECAY_MS = 60000;

interface AttemptRecord {
  n: number;
  /** Date.now() of the most recent attempt. */
  t: number;
}

const readRecord = (): AttemptRecord => {
  try {
    const raw = sessionStorage.getItem(ATTEMPT_KEY);
    if (!raw) return { n: 0, t: 0 };
    const parsed = JSON.parse(raw) as Partial<AttemptRecord>;
    const n = Number(parsed.n) || 0;
    const t = Number(parsed.t) || 0;
    if (Date.now() - t > ATTEMPT_DECAY_MS) return { n: 0, t: 0 };
    return { n, t };
  } catch {
    return { n: 0, t: 0 };
  }
};

const readAttempts = (): number => readRecord().n;

const writeAttempts = (n: number): boolean => {
  try {
    sessionStorage.setItem(ATTEMPT_KEY, JSON.stringify({ n, t: Date.now() }));
    return true;
  } catch {
    // Storage blocked. Without somewhere to count we cannot guarantee we would
    // ever stop reloading, so we decline to reload at all.
    return false;
  }
};

const clearAttempts = () => {
  try {
    sessionStorage.removeItem(ATTEMPT_KEY);
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
};

/**
 * Hand the budget back because a person explicitly asked to try again. Used by
 * the Reload button on the boot-failure notice: an unprompted reload loop is
 * worth guarding against, a requested one is not.
 */
export function resetIsolationAttempts(): void {
  clearAttempts();
}

/**
 * True once we have run out of reload attempts and the page is still not
 * isolated. The GBA core reads this to fail with a real message rather than
 * calling a module factory that will never come back.
 */
export function isolationBlocked(): boolean {
  if (window.crossOriginIsolated) return false;
  return readAttempts() >= MAX_ATTEMPTS;
}

/** Wait until a service worker is controlling this page, or give up. */
function waitForController(): Promise<boolean> {
  if (navigator.serviceWorker.controller) return Promise.resolve(true);

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const done = (value: boolean) => {
      if (settled) return;
      settled = true;
      navigator.serviceWorker.removeEventListener('controllerchange', onChange);
      clearTimeout(timer);
      resolve(value);
    };

    const onChange = () => done(true);
    navigator.serviceWorker.addEventListener('controllerchange', onChange);

    const timer = setTimeout(() => done(!!navigator.serviceWorker.controller), CONTROLLER_TIMEOUT_MS);

    // `ready` resolving means there is an ACTIVE registration; it does not mean
    // that registration has claimed us. Use it only as a prompt to re-check.
    navigator.serviceWorker.ready
      .then(() => {
        if (navigator.serviceWorker.controller) done(true);
      })
      .catch(() => done(false));
  });
}

export function ensureCrossOriginIsolated(): void {
  if (window.crossOriginIsolated) {
    // Proof that isolation is achievable here. Hand the budget back so a later
    // un-isolated load in this same tab still gets a chance to fix itself.
    clearAttempts();
    return;
  }

  // Service workers need a secure context. On plain http (other than localhost)
  // there is no route to isolation at all, so do not bother reloading.
  if (!window.isSecureContext || !('serviceWorker' in navigator)) return;

  const attempts = readAttempts();
  if (attempts >= MAX_ATTEMPTS) return;

  waitForController()
    .then((controlled) => {
      // Re-check: the worker may have claimed this client while we waited, in
      // which case this document is still the un-isolated one and a reload is
      // exactly what we want -- but if isolation somehow arrived, stop.
      if (window.crossOriginIsolated) {
        clearAttempts();
        return;
      }
      if (!controlled) return;
      if (!writeAttempts(attempts + 1)) return;
      window.location.reload();
    })
    .catch(() => {
      // No registration is possible here; leaving the page un-isolated is the
      // correct outcome, and the GBA core surfaces its own error if used.
    });
}
