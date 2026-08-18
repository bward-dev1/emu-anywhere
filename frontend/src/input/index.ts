import { useEffect } from 'preact/hooks';
import { EmuCore, System } from '../cores/types';
import { InputAction } from './bindings';
import { InputRouter } from './router';
import { KeyboardSource } from './keyboard';
import { GamepadSource } from './gamepad';
import { getInputConfig, subscribeInputConfig } from './store';
import {
  claimWebMelonGamepad,
  getAxisSensitivity,
  mirrorDsBindings,
  releaseWebMelonGamepad,
  setWebMelonUsingGamepad
} from './webmelon-bridge';

export * from './bindings';
export * from './store';
export { GamepadSource } from './gamepad';
export { getAxisSensitivity, setAxisSensitivity, getRumbleIntensity, setRumbleIntensity, isWebMelonAvailable } from './webmelon-bridge';

/**
 * The desktop input runtime.
 *
 * One emulator runs at a time, so this is a module singleton rather than
 * per-component state. That is also what lets the settings modal -- which is a
 * sibling of the emulator view, not a child -- suspend key handling while it
 * captures a new binding.
 */
const router = new InputRouter();
const keyboard = new KeyboardSource(router);
const gamepad = new GamepadSource(router, getAxisSensitivity);

gamepad.setActivityHandler((active) => setWebMelonUsingGamepad(active));

let captureMode = false;

/**
 * Suspend the game's key/pad handling while the settings UI reads a binding.
 *
 * Without this, clicking a slot and pressing X both binds X and makes the
 * character jump, and any key the user tries out while the menu is open leaks
 * into the running game.
 */
export const setInputCaptureMode = (active: boolean): void => {
  if (captureMode === active) return;
  captureMode = active;
  keyboard.setEnabled(!active);
  gamepad.setEnabled(!active);
};

export const getInputRouter = (): InputRouter => router;

/** Read the live deadzone the pad poll is using, for the capture UI. */
export const currentAxisThreshold = (): number =>
  Math.min(Math.max(1 - getAxisSensitivity(), 0.08), 0.95);

export interface DesktopInputOptions {
  core: EmuCore | null;
  system: System | null;
  /** Host-side actions: fast-forward, pause, save state, and friends. */
  onExtra?: (action: InputAction, pressed: boolean) => void;
}

export const useDesktopInput = ({ core, system, onExtra }: DesktopInputOptions): void => {
  useEffect(() => {
    if (!core || !system) return;

    const applyConfig = () => {
      const config = getInputConfig();
      router.setBindings(config[system], config.turboRateHz);
      if (system === 'nds') mirrorDsBindings(config[system]);
    };

    router.setCore(core);
    applyConfig();
    const unsubscribe = subscribeInputConfig(applyConfig);

    // Hand input ownership over from the core's own built-in handler. mGBA
    // ships an SDL keyboard handler compiled into the wasm; leaving it on
    // alongside ours would double-press every bound key and would ignore every
    // rebind the user makes here, since its map lives in C.
    core.setNativeInputEnabled?.(false);
    claimWebMelonGamepad();

    /**
     * Full panic release when the page loses focus or is hidden.
     *
     * The keyboard source already drops its own held keys on blur, but that is
     * not enough on its own: a hold-toggle latch is router state, not key
     * state, so a button latched on stayed pressed while the user was in
     * another window with no indication and no way to release it. Clearing the
     * latches here is the difference between "you tabbed away" and "the game is
     * still holding B".
     *
     * The pad's tracking has to be reset in the same breath, because
     * releaseAll() empties the router's source sets and the poll would
     * otherwise see no change for a button that is still physically down.
     */
    const panicRelease = () => {
      keyboard.releaseHeldKeys();
      gamepad.resetTracking();
      router.releaseAll();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') panicRelease();
    };
    window.addEventListener('blur', panicRelease);
    document.addEventListener('visibilitychange', onVisibility);

    keyboard.attach();
    gamepad.attach();
    router.start();

    return () => {
      window.removeEventListener('blur', panicRelease);
      document.removeEventListener('visibilitychange', onVisibility);
      router.stop();
      keyboard.detach();
      gamepad.detach();
      releaseWebMelonGamepad();
      setWebMelonUsingGamepad(false);
      core.setNativeInputEnabled?.(true);
      router.setCore(null);
      unsubscribe();
    };
  }, [core, system]);

  useEffect(() => {
    router.setExtraHandler(onExtra ?? null);
    return () => router.setExtraHandler(null);
  }, [onExtra]);
};
