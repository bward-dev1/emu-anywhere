import { InputRouter } from './router';

/**
 * Keyboard source for the input router.
 *
 * Three properties this deliberately keeps:
 *
 * 1. It binds on `event.code`, never `event.key`. `code` is the physical key,
 *    so a layout change or a held Shift cannot turn one binding into another.
 * 2. It tracks what it currently holds down, so it can retract exactly those
 *    sources rather than guessing.
 * 3. It releases everything on blur and on visibilitychange. A keyup delivered
 *    to another window never reaches us, so without this, alt-tabbing while
 *    holding a direction leaves the character walking into a wall forever.
 */
export class KeyboardSource {
  private router: InputRouter;
  private held = new Set<string>();
  private attached = false;
  private enabled = true;

  constructor(router: InputRouter) {
    this.router = router;
  }

  /**
   * Suspend without detaching. Used while the settings modal is capturing a
   * new binding, so the key being bound does not also drive the game.
   */
  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) this.releaseHeld();
  }

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  detach(): void {
    if (!this.attached) return;
    this.attached = false;
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.releaseHeld();
  }

  /** Retract every key this source is currently holding. */
  releaseHeldKeys(): void {
    this.releaseHeld();
  }

  private releaseHeld(): void {
    for (const code of this.held) {
      for (const action of this.router.actionsForSlot(code)) {
        this.router.setSource(action, `kb:${code}`, false);
      }
    }
    this.held.clear();
  }

  /**
   * Typing into a text field must never also press A. The settings modal has
   * real inputs (nickname, file pickers), so check the focus target rather than
   * relying on the modal being closed.
   */
  private isTypingTarget(target: EventTarget | null): boolean {
    const element = target as HTMLElement | null;
    if (!element || !element.tagName) return false;
    const tag = element.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || element.isContentEditable;
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.enabled) return;
    if (this.isTypingTarget(event.target)) return;
    // Auto-repeat would re-fire the rising edge that hold-toggle latches on,
    // making a held key flicker the latch instead of setting it once.
    if (event.repeat) return;

    const code = event.code;
    const actions = this.router.actionsForSlot(code);
    if (actions.length === 0) return;

    // Only now do we claim the key. Arrows and Space scroll the page and F-keys
    // do browser things, and a key we are actually using for the game should
    // not also do that -- but a key we are not bound to must be left alone.
    event.preventDefault();

    if (this.held.has(code)) return;
    this.held.add(code);
    for (const action of actions) {
      this.router.setSource(action, `kb:${code}`, true);
    }
    this.router.tick();
  };

  private handleKeyUp = (event: KeyboardEvent): void => {
    const code = event.code;
    // Release regardless of `enabled` and regardless of focus target: if we
    // ever pressed it, we owe the core the release.
    if (!this.held.has(code)) return;
    event.preventDefault();
    this.held.delete(code);
    for (const action of this.router.actionsForSlot(code)) {
      this.router.setSource(action, `kb:${code}`, false);
    }
    this.router.tick();
  };

  private handleBlur = (): void => {
    this.releaseHeld();
    this.router.tick();
  };

  private handleVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      this.releaseHeld();
      this.router.tick();
    }
  };
}
