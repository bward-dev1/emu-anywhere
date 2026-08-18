import { SystemBindings, codeToLegacyKey } from './bindings';

/**
 * Keeping WebMelon's own input settings honest, without letting it fight us.
 *
 * WebMelon is vendored source in this repo (webmelon-sdk/webmelon.js), not an
 * opaque dependency, so what it does with input is knowable rather than
 * guessable, and two things about it shape this file:
 *
 * 1. Its keyDown/keyUp listeners OR and AND-NOT the same button bitmask our
 *    core adapter writes. Two owners of an idempotent bitmask is harmless, so
 *    we mirror our bindings into it and let both run -- except where turbo or
 *    hold-toggle is on, since those need the bit released while the key is
 *    still physically down. There the mirror deliberately omits that key, and
 *    our router becomes its only owner.
 *
 * 2. Its processGamepadInput *assigns* the bitmask rather than OR-ing it, so a
 *    connected pad erases whatever the keyboard or touch controls contributed
 *    that frame. That is a live bug in the DS path today. We stub it out while
 *    our own pad polling is attached, and restore it on teardown.
 */

interface WebMelonInputLike {
  getInputSettings: () => Record<string, unknown>;
  setInputSettings: (settings: Record<string, unknown>) => void;
  processGamepadInput?: () => void;
}

const webMelonInput = (): WebMelonInputLike | null => {
  const melon = (window as unknown as { WebMelon?: { input?: WebMelonInputLike } }).WebMelon;
  return melon?.input ?? null;
};

export const DEFAULT_AXIS_SENSITIVITY = 0.5;

/**
 * The one axis-sensitivity value, read from WebMelon's settings.
 *
 * The brief for the pad work was explicit that this must not grow a second,
 * competing deadzone setting, so this is the only source and the GBA pad path
 * reads it through here even though WebMelon has nothing to do with GBA.
 */
export const getAxisSensitivity = (): number => {
  const input = webMelonInput();
  if (!input) return DEFAULT_AXIS_SENSITIVITY;
  try {
    const value = input.getInputSettings().gamepadAxisSensitivity;
    return typeof value === 'number' && Number.isFinite(value) ? value : DEFAULT_AXIS_SENSITIVITY;
  } catch {
    return DEFAULT_AXIS_SENSITIVITY;
  }
};

export const setAxisSensitivity = (value: number): void => {
  const input = webMelonInput();
  if (!input) return;
  try {
    const settings = input.getInputSettings();
    settings.gamepadAxisSensitivity = value;
    input.setInputSettings(settings);
  } catch {
    // WebMelon absent or mid-teardown -- our own poll still uses the default.
  }
};

export const getRumbleIntensity = (): number => {
  const input = webMelonInput();
  if (!input) return DEFAULT_AXIS_SENSITIVITY;
  try {
    const value = input.getInputSettings().gamepadRumbleIntensity;
    return typeof value === 'number' && Number.isFinite(value) ? value : DEFAULT_AXIS_SENSITIVITY;
  } catch {
    return DEFAULT_AXIS_SENSITIVITY;
  }
};

export const setRumbleIntensity = (value: number): void => {
  const input = webMelonInput();
  if (!input) return;
  try {
    const settings = input.getInputSettings();
    settings.gamepadRumbleIntensity = value;
    input.setInputSettings(settings);
  } catch {
    // See setAxisSensitivity.
  }
};

export const isWebMelonAvailable = (): boolean => webMelonInput() !== null;

const DS_BITS: Record<string, number> = {
  A: 0x001, B: 0x002, SELECT: 0x004, START: 0x008,
  DPAD_RIGHT: 0x010, DPAD_LEFT: 0x020, DPAD_UP: 0x040, DPAD_DOWN: 0x080,
  R: 0x100, L: 0x200, X: 0x400, Y: 0x800
};

const padIndex = (value: string | null): number | null => {
  if (!value || !value.startsWith('pad:b')) return null;
  const parsed = Number.parseInt(value.slice(5), 10);
  return Number.isInteger(parsed) ? parsed : null;
};

/**
 * Push our DS bindings into WebMelon's settings so its own listeners agree with
 * ours instead of running a stale map.
 */
export const mirrorDsBindings = (bindings: SystemBindings): void => {
  const input = webMelonInput();
  if (!input) return;

  const keybinds: Record<string, number> = {};
  const alternateKeybinds: string[] = [];
  const gamepadBinds: Record<string, number[]> = {};

  for (const [action, binding] of Object.entries(bindings)) {
    const bit = DS_BITS[action];
    if (bit === undefined) continue;

    // Turbo and hold-toggle need the bit to move independently of the physical
    // key, so WebMelon must not also be driving it.
    if (!binding.turbo && !binding.toggle) {
      const primary = codeToLegacyKey(binding.keyPrimary);
      if (primary) keybinds[primary] = bit;
      const alternate = codeToLegacyKey(binding.keyAlternate);
      if (alternate) {
        keybinds[alternate] = bit;
        alternateKeybinds.push(alternate);
      }
    }

    const pads: number[] = [];
    const first = padIndex(binding.padPrimary);
    const second = padIndex(binding.padAlternate);
    if (first !== null) pads.push(first);
    if (second !== null) pads.push(second);
    // WebMelon iterates this unconditionally for every DS button, so a missing
    // key would throw inside its frame loop. Always supply an array.
    gamepadBinds[action] = pads;
  }

  try {
    const settings = input.getInputSettings();
    settings.keybinds = keybinds;
    settings.alternateKeybinds = alternateKeybinds;
    settings.gamepadBinds = gamepadBinds;
    input.setInputSettings(settings);
  } catch {
    // Nothing to recover; our router is still the primary owner.
  }
};

/* ------------------------------------------------------------------ */
/* Gamepad ownership                                                   */
/* ------------------------------------------------------------------ */

let savedProcessGamepadInput: (() => void) | null = null;

/**
 * Take over pad handling from WebMelon, and remember what we replaced.
 *
 * Stubbing rather than clearing gamepadBinds is deliberate: its axis handling
 * ignores gamepadBinds entirely and would keep assigning the bitmask from stick
 * position no matter what the bind table said.
 */
export const claimWebMelonGamepad = (): void => {
  const input = webMelonInput();
  if (!input || savedProcessGamepadInput) return;
  if (typeof input.processGamepadInput !== 'function') return;
  savedProcessGamepadInput = input.processGamepadInput.bind(input);
  input.processGamepadInput = () => {};
};

export const releaseWebMelonGamepad = (): void => {
  const input = webMelonInput();
  if (input && savedProcessGamepadInput) {
    input.processGamepadInput = savedProcessGamepadInput;
  }
  savedProcessGamepadInput = null;
};

/**
 * Keep DS Rumble Pak support alive while we own the pad.
 *
 * WebMelon only rumbles when its own internal `emulatorUsingGamepad` flag is
 * set, and that flag was only ever set by the polling we just stubbed out.
 */
export const setWebMelonUsingGamepad = (active: boolean): void => {
  const melon = (window as unknown as { WebMelon?: { _internal?: Record<string, unknown> } }).WebMelon;
  if (melon?._internal) melon._internal.emulatorUsingGamepad = active;
};
