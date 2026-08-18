import { InputRouter } from './router';

/**
 * Gamepad source for the input router.
 *
 * The GBA half of this app had no controller path at all -- nothing in the tree
 * called navigator.getGamepads(). The DS half had one inside WebMelon, but that
 * one *assigns* the emulator's button bitmask each frame rather than OR-ing
 * into it, so a connected pad wipes out whatever the touch controls and
 * keyboard contributed that frame. Routing both systems through here instead
 * fixes that by construction: a pad is just another set of sources.
 *
 * The Gamepad API has no press/release events, only per-frame state, so
 * "release discipline" here means the poll is the single writer -- every bound
 * control is re-asserted or retracted every frame from the live snapshot. A
 * dropped release is not possible, because there are no releases to drop. The
 * one case that state cannot cover is the pad vanishing mid-press, which is
 * what the disconnect handler is for.
 */

/** Deadzone comes from the setting WebMelon already had, never a second one. */
export type AxisSensitivityGetter = () => number;

export class GamepadSource {
  private router: InputRouter;
  private getAxisSensitivity: AxisSensitivityGetter;
  private attached = false;
  private enabled = true;
  /** Slot values ("pad:b1") this source currently asserts, per pad index. */
  private activeSlots = new Map<number, Set<string>>();
  private onActivity: ((active: boolean) => void) | null = null;
  private anyActive = false;

  constructor(router: InputRouter, getAxisSensitivity: AxisSensitivityGetter) {
    this.router = router;
    this.getAxisSensitivity = getAxisSensitivity;
  }

  /** Notified when the pad starts/stops contributing, for DS rumble upkeep. */
  setActivityHandler(handler: ((active: boolean) => void) | null): void {
    this.onActivity = handler;
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) this.releaseAllPads();
  }

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    window.addEventListener('gamepadconnected', this.handleConnected);
    window.addEventListener('gamepaddisconnected', this.handleDisconnected);
    this.router.addPoller(this.poll);
  }

  detach(): void {
    if (!this.attached) return;
    this.attached = false;
    window.removeEventListener('gamepadconnected', this.handleConnected);
    window.removeEventListener('gamepaddisconnected', this.handleDisconnected);
    this.router.removePoller(this.poll);
    this.releaseAllPads();
  }

  /**
   * Threshold an axis must pass to count as pressed.
   *
   * Matches WebMelon's own formula (threshold = 1 - sensitivity) so the slider
   * in Controller Input means exactly what it always meant, on both systems.
   * Clamped away from 0 because a zero threshold makes a resting stick read as
   * two opposing directions held at once.
   */
  private axisThreshold(): number {
    const sensitivity = this.getAxisSensitivity();
    const threshold = 1 - (Number.isFinite(sensitivity) ? sensitivity : 0.5);
    return Math.min(Math.max(threshold, 0.08), 0.95);
  }

  /** Every slot value this pad is currently asserting. */
  private readPad(pad: Gamepad, threshold: number): Set<string> {
    const active = new Set<string>();

    for (let i = 0; i < pad.buttons.length; i++) {
      const button = pad.buttons[i];
      if (button && button.pressed) active.add(`pad:b${i}`);
    }

    for (let i = 0; i < pad.axes.length; i++) {
      const value = pad.axes[i];
      if (typeof value !== 'number') continue;
      if (value > threshold) active.add(`pad:a${i}+`);
      else if (value < -threshold) active.add(`pad:a${i}-`);
    }

    return active;
  }

  private poll = (): void => {
    if (!this.enabled) return;
    if (typeof navigator.getGamepads !== 'function') return;

    const pads = navigator.getGamepads();
    const threshold = this.axisThreshold();
    const seen = new Set<number>();
    let anyActive = false;

    for (let index = 0; index < pads.length; index++) {
      const pad = pads[index];
      if (!pad || !pad.connected) continue;
      seen.add(index);

      const next = this.readPad(pad, threshold);
      const previous = this.activeSlots.get(index) ?? new Set<string>();

      for (const slotValue of next) {
        if (previous.has(slotValue)) continue;
        for (const action of this.router.actionsForSlot(slotValue)) {
          this.router.setSource(action, `pad${index}:${slotValue}`, true);
        }
      }
      for (const slotValue of previous) {
        if (next.has(slotValue)) continue;
        for (const action of this.router.actionsForSlot(slotValue)) {
          this.router.setSource(action, `pad${index}:${slotValue}`, false);
        }
      }

      this.activeSlots.set(index, next);
      if (next.size > 0) anyActive = true;
    }

    // A pad that stopped appearing in the snapshot without firing a disconnect
    // event (page restored from bfcache, permission revoked) still owes us its
    // releases.
    for (const index of [...this.activeSlots.keys()]) {
      if (!seen.has(index)) this.releasePad(index);
    }

    if (anyActive !== this.anyActive) {
      this.anyActive = anyActive;
      this.onActivity?.(anyActive);
    }
  };

  /**
   * Forget what every pad was holding, without retracting sources.
   *
   * For use alongside InputRouter.releaseAll(), which clears the source sets
   * wholesale. If this bookkeeping were left behind, the next poll would see
   * "no change" for a button that is still physically down and would never
   * re-assert it -- the pad would appear dead until the user let go.
   */
  resetTracking(): void {
    this.activeSlots.clear();
    if (this.anyActive) {
      this.anyActive = false;
      this.onActivity?.(false);
    }
  }

  private releasePad(index: number): void {
    const previous = this.activeSlots.get(index);
    if (previous) {
      for (const slotValue of previous) {
        for (const action of this.router.actionsForSlot(slotValue)) {
          this.router.setSource(action, `pad${index}:${slotValue}`, false);
        }
      }
    }
    this.activeSlots.delete(index);
    // Belt and braces: anything this pad still holds under a binding that has
    // since been edited away is caught by the prefix sweep.
    this.router.releaseSourcePrefix(`pad${index}:`);
  }

  private releaseAllPads(): void {
    for (const index of [...this.activeSlots.keys()]) this.releasePad(index);
    if (this.anyActive) {
      this.anyActive = false;
      this.onActivity?.(false);
    }
  }

  private handleConnected = (): void => {
    // Nothing to seed -- the next poll picks it up. Present so a pad plugged in
    // mid-session starts the poll's bookkeeping from a clean slate.
  };

  private handleDisconnected = (event: Event): void => {
    const index = (event as GamepadEvent).gamepad?.index;
    if (typeof index === 'number') this.releasePad(index);
    else this.releaseAllPads();
  };

  /**
   * One-shot read of whatever control is being pressed right now, for the
   * settings UI's "press a button" capture. Returns null if nothing is.
   */
  static captureSlot(threshold: number): string | null {
    if (typeof navigator.getGamepads !== 'function') return null;
    const pads = navigator.getGamepads();
    for (const pad of pads) {
      if (!pad || !pad.connected) continue;
      for (let i = 0; i < pad.buttons.length; i++) {
        if (pad.buttons[i]?.pressed) return `pad:b${i}`;
      }
      for (let i = 0; i < pad.axes.length; i++) {
        const value = pad.axes[i];
        if (typeof value !== 'number') continue;
        if (value > threshold) return `pad:a${i}+`;
        if (value < -threshold) return `pad:a${i}-`;
      }
    }
    return null;
  }
}
