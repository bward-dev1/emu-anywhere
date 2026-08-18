import { InputButton } from '../cores/types';
import { ActionBinding, InputAction, SystemBindings, isExtraAction } from './bindings';

/**
 * The single place an action's pressed-state is decided.
 *
 * Keyboard and gamepad do not talk to the core directly. They assert and
 * retract *sources* ("kb:KeyX", "pad0:b1") against an action, and once per
 * animation frame the router reduces every action's source set to one boolean
 * and pushes only the changes to the core.
 *
 * That indirection is what makes stuck buttons structurally impossible rather
 * than a thing to be careful about. A missed keyup, a pad yanked out mid-press,
 * a rebind while a key is down -- each is just a source disappearing, and the
 * next tick reconciles the core to the truth. It is also the only sane place to
 * put turbo and hold-toggle, which are per-action state that no single input
 * device owns.
 */

export type ExtraHandler = (action: InputAction, pressed: boolean) => void;

interface CoreLike {
  setButton(btn: InputButton, pressed: boolean): void;
}

export class InputRouter {
  private bindings: SystemBindings = {};
  private turboRateHz = 12;
  private core: CoreLike | null = null;
  private onExtra: ExtraHandler | null = null;

  /** action -> set of source ids currently asserting it. */
  private sources = new Map<string, Set<string>>();
  /** Actions currently latched on by hold-toggle. */
  private latched = new Set<string>();
  /** What we have actually told the core, so we only push edges. */
  private applied = new Map<string, boolean>();
  /** Raw (pre-turbo, pre-toggle) state, for edge detection. */
  private rawPrevious = new Map<string, boolean>();
  /** Auto-fire phase per action: whether it is currently in its "on" half, and when to flip. */
  private turboState = new Map<string, { on: boolean; nextFlip: number }>();

  private frameHandle: number | null = null;
  private running = false;
  /**
   * Polled sources (the gamepad), run at the top of each animation frame.
   *
   * These are kept off the manual tick() path on purpose. tick() is called
   * synchronously from event handlers and from releaseSourcePrefix(), and a
   * poll running inside the latter would immediately re-assert the very
   * sources the disconnect was clearing.
   */
  private pollers = new Set<() => void>();

  setCore(core: CoreLike | null): void {
    if (this.core === core) return;
    this.releaseAll();
    this.core = core;
  }

  setBindings(bindings: SystemBindings, turboRateHz: number): void {
    this.bindings = bindings;
    this.turboRateHz = turboRateHz > 0 ? turboRateHz : 12;

    // A rebind can orphan an action that is currently held down. Drop any
    // latch/press state for actions the new map no longer has, then let the
    // next tick reconcile the rest.
    for (const action of [...this.latched]) {
      if (!bindings[action]) this.latched.delete(action);
    }
    for (const action of [...this.sources.keys()]) {
      if (!bindings[action]) this.sources.delete(action);
    }
  }

  setExtraHandler(handler: ExtraHandler | null): void {
    this.onExtra = handler;
  }

  /** Every action a given binding slot value maps to, for either device. */
  actionsForSlot(value: string): string[] {
    const matches: string[] = [];
    for (const [action, binding] of Object.entries(this.bindings)) {
      if (
        binding.keyPrimary === value ||
        binding.keyAlternate === value ||
        binding.padPrimary === value ||
        binding.padAlternate === value
      ) {
        matches.push(action);
      }
    }
    return matches;
  }

  /**
   * Assert or retract one source against one action.
   *
   * `sourceId` must uniquely identify the physical control, so that two
   * controls bound to the same action each hold it independently and releasing
   * one does not release the other.
   */
  setSource(action: string, sourceId: string, active: boolean): void {
    let set = this.sources.get(action);
    if (active) {
      if (!set) {
        set = new Set();
        this.sources.set(action, set);
      }
      set.add(sourceId);
    } else if (set) {
      set.delete(sourceId);
      if (set.size === 0) this.sources.delete(action);
    }
  }

  /** Drop every source whose id starts with `prefix` (used on pad disconnect). */
  releaseSourcePrefix(prefix: string): void {
    for (const [action, set] of [...this.sources.entries()]) {
      for (const sourceId of [...set]) {
        if (sourceId.startsWith(prefix)) set.delete(sourceId);
      }
      if (set.size === 0) this.sources.delete(action);
    }
    this.tick();
  }

  /**
   * Panic release: forget every source and latch, and tell the core every
   * button we had pressed is now up. Used on blur, tab hide, and teardown --
   * the cases where releases are genuinely never going to arrive.
   */
  releaseAll(): void {
    this.sources.clear();
    this.latched.clear();
    this.rawPrevious.clear();
    this.turboState.clear();
    for (const [action, wasPressed] of this.applied.entries()) {
      if (wasPressed && this.core && !isExtraAction(action as InputAction)) {
        this.core.setButton(action as InputButton, false);
      }
    }
    this.applied.clear();
  }

  addPoller(poll: () => void): void {
    this.pollers.add(poll);
  }

  removePoller(poll: () => void): void {
    this.pollers.delete(poll);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      for (const poll of this.pollers) poll();
      this.tick();
      this.frameHandle = requestAnimationFrame(loop);
    };
    this.frameHandle = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    if (this.frameHandle !== null) {
      cancelAnimationFrame(this.frameHandle);
      this.frameHandle = null;
    }
    this.releaseAll();
  }

  /** True when any source is currently asserting this action. */
  private isRawActive(action: string): boolean {
    const set = this.sources.get(action);
    return !!set && set.size > 0;
  }

  /**
   * Auto-fire gate for one action, as a time accumulator rather than a sampled
   * square wave.
   *
   * The obvious implementation -- `(now % period) < period / 2` -- is wrong
   * under frame drops. It samples a waveform at the frame rate, so once the
   * frame rate falls below twice the turbo rate it aliases, and the button
   * fires at some unrelated frequency instead of a slower one. Measured on a
   * 16fps machine, a 12/sec setting came out as 4/sec.
   *
   * Flipping on elapsed time instead degrades honestly: it fires as fast as the
   * frames allow, capped at the requested rate, and never invents a rate the
   * user did not ask for. A fresh press always starts in the "on" half so the
   * first frame of every press registers.
   */
  private turboGate(action: string, now: number, justPressed: boolean): boolean {
    const halfPeriod = 500 / this.turboRateHz;
    let state = this.turboState.get(action);

    if (!state || justPressed) {
      state = { on: true, nextFlip: now + halfPeriod };
      this.turboState.set(action, state);
      return true;
    }

    if (now >= state.nextFlip) {
      state.on = !state.on;
      state.nextFlip = now + halfPeriod;
    }
    return state.on;
  }

  tick(): void {
    const now = performance.now();

    for (const action of Object.keys(this.bindings)) {
      const binding: ActionBinding = this.bindings[action];
      const raw = this.isRawActive(action);
      const wasRaw = this.rawPrevious.get(action) ?? false;
      const rising = raw && !wasRaw;
      this.rawPrevious.set(action, raw);

      if (isExtraAction(action as InputAction)) {
        // Extras are events, not held emulator buttons. Report both edges and
        // let the consumer decide (fast-forward wants hold, save-state wants
        // the press only).
        if (raw !== wasRaw) this.onExtra?.(action as InputAction, raw);
        continue;
      }

      let held: boolean;
      if (binding.toggle) {
        if (rising) {
          if (this.latched.has(action)) this.latched.delete(action);
          else this.latched.add(action);
        }
        held = this.latched.has(action);
      } else {
        held = raw;
      }

      if (!held) this.turboState.delete(action);
      const pressed = held && (!binding.turbo || this.turboGate(action, now, rising));

      if (this.applied.get(action) !== pressed) {
        this.applied.set(action, pressed);
        this.core?.setButton(action as InputButton, pressed);
      }
    }
  }

  /** Actions currently latched on, so the UI can show it. */
  latchedActions(): string[] {
    return [...this.latched];
  }
}
