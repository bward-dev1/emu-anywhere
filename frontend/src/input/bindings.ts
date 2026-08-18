import { System, InputButton } from '../cores/types';

/**
 * The one owned input-binding model, for both cores.
 *
 * Before this file there were two disjoint stores and neither was the app's:
 * DS bindings lived inside WebMelon's own inputSettings (keyed on `event.key`,
 * so layout-dependent), and GBA bindings lived in C inside mGBA's SDL event
 * handler, baked into the wasm and unreachable from JS. Nothing the user could
 * click reached the GBA core at all.
 *
 * Everything here is keyed on `event.code`, not `event.key`. `code` names the
 * physical key ("KeyZ" is the bottom-left letter key whatever the layout calls
 * it), so a binding made on QWERTY still lands on the same key on AZERTY or
 * Dvorak, and a shifted key binds as the same thing it fires as. WebMelon's own
 * map is `event.key`-based by design, so writing through to it means
 * translating on the way out -- see codeToLegacyKey().
 */

/** Actions that are not emulated buttons -- host-side conveniences. */
export type ExtraAction =
  | 'FAST_FORWARD'
  | 'PAUSE'
  | 'SAVE_STATE'
  | 'LOAD_STATE'
  | 'SCREENSHOT'
  | 'FULLSCREEN'
  | 'RESET';

export type InputAction = InputButton | ExtraAction;

export const EXTRA_ACTIONS: ExtraAction[] = [
  'FAST_FORWARD',
  'PAUSE',
  'SAVE_STATE',
  'LOAD_STATE',
  'SCREENSHOT',
  'FULLSCREEN',
  'RESET'
];

const EXTRA_ACTION_SET = new Set<string>(EXTRA_ACTIONS);

export const isExtraAction = (action: InputAction): action is ExtraAction =>
  EXTRA_ACTION_SET.has(action);

/**
 * Extras the DS side cannot serve. WebMelon exposes no save-state or screenshot
 * API (see webmelon-sdk/webmelon.d.ts -- WebMelonEmulator has pause/resume/
 * speed and nothing else), while mGBA exposes saveState/loadState/screenshot.
 * Rather than render a binding row that silently does nothing, the UI hides
 * these for DS.
 */
const GBA_ONLY_EXTRAS = new Set<ExtraAction>(['SAVE_STATE', 'LOAD_STATE', 'SCREENSHOT', 'RESET']);

export const extraActionsFor = (system: System): ExtraAction[] =>
  system === 'gba' ? EXTRA_ACTIONS : EXTRA_ACTIONS.filter((a) => !GBA_ONLY_EXTRAS.has(a));

/** Emulated buttons, in the order they should be listed in the UI. */
const DS_BUTTONS: InputButton[] = [
  'DPAD_UP', 'DPAD_DOWN', 'DPAD_LEFT', 'DPAD_RIGHT',
  'A', 'B', 'X', 'Y', 'L', 'R', 'START', 'SELECT'
];

const GBA_BUTTONS: InputButton[] = [
  'DPAD_UP', 'DPAD_DOWN', 'DPAD_LEFT', 'DPAD_RIGHT',
  'A', 'B', 'L', 'R', 'START', 'SELECT'
];

export const buttonsFor = (system: System): InputButton[] =>
  system === 'gba' ? GBA_BUTTONS : DS_BUTTONS;

export const actionsFor = (system: System): InputAction[] =>
  [...buttonsFor(system), ...extraActionsFor(system)];

export const ACTION_LABELS: Record<InputAction, string> = {
  A: 'A',
  B: 'B',
  X: 'X',
  Y: 'Y',
  L: 'L',
  R: 'R',
  START: 'Start',
  SELECT: 'Select',
  DPAD_UP: 'D-Pad Up',
  DPAD_DOWN: 'D-Pad Down',
  DPAD_LEFT: 'D-Pad Left',
  DPAD_RIGHT: 'D-Pad Right',
  FAST_FORWARD: 'Fast Forward',
  PAUSE: 'Pause / Resume',
  SAVE_STATE: 'Save State',
  LOAD_STATE: 'Load State',
  SCREENSHOT: 'Screenshot',
  FULLSCREEN: 'Fullscreen',
  RESET: 'Reset Game'
};

/**
 * A single binding slot. Keyboard slots hold an `event.code`. Gamepad slots
 * hold one of:
 *   "pad:bN"   -- button index N
 *   "pad:aN+"  -- axis N pushed positive past the deadzone
 *   "pad:aN-"  -- axis N pushed negative past the deadzone
 */
export type BindingSlot = string | null;

export interface ActionBinding {
  keyPrimary: BindingSlot;
  keyAlternate: BindingSlot;
  padPrimary: BindingSlot;
  padAlternate: BindingSlot;
  /** Auto-fire while held, at turboRateHz. */
  turbo: boolean;
  /** Tap to latch on, tap again to release. Ignored for extras. */
  toggle: boolean;
}

export type SystemBindings = Record<string, ActionBinding>;

export interface InputConfig {
  version: number;
  nds: SystemBindings;
  gba: SystemBindings;
  /** Presses per second when turbo is on. */
  turboRateHz: number;
}

export const CONFIG_VERSION = 1;
export const STORAGE_KEY = 'emu-input-bindings';
/** WebMelon's own persisted settings, written by settings.tsx since before this. */
const LEGACY_STORAGE_KEY = 'inputSettings';

export const TURBO_RATE_MIN = 2;
export const TURBO_RATE_MAX = 30;

const slot = (
  keyPrimary: BindingSlot,
  keyAlternate: BindingSlot = null,
  padPrimary: BindingSlot = null,
  padAlternate: BindingSlot = null
): ActionBinding => ({
  keyPrimary,
  keyAlternate,
  padPrimary,
  padAlternate,
  turbo: false,
  toggle: false
});

/**
 * Standard-gamepad-mapping button indices, matching the layout WebMelon already
 * shipped for DS (webmelon.js DefaultGamepadBindings) so a player who had a pad
 * working on DS finds the same face buttons here.
 */
const PAD = {
  SOUTH: 'pad:b0',
  EAST: 'pad:b1',
  WEST: 'pad:b2',
  NORTH: 'pad:b3',
  L1: 'pad:b4',
  R1: 'pad:b5',
  L2: 'pad:b6',
  R2: 'pad:b7',
  SELECT: 'pad:b8',
  START: 'pad:b9',
  DPAD_UP: 'pad:b12',
  DPAD_DOWN: 'pad:b13',
  DPAD_LEFT: 'pad:b14',
  DPAD_RIGHT: 'pad:b15',
  STICK_LEFT: 'pad:a0-',
  STICK_RIGHT: 'pad:a0+',
  STICK_UP: 'pad:a1-',
  STICK_DOWN: 'pad:a1+'
};

/**
 * DS keyboard defaults are WebMelon's own (w/a/s/d + q/o/i/l/k/j/v/b),
 * expressed as physical key codes, so nobody's muscle memory changes. Arrow
 * keys come along as D-Pad alternates, which the old map had no room for.
 */
const dsDefaults = (): SystemBindings => ({
  DPAD_UP: slot('KeyW', 'ArrowUp', PAD.DPAD_UP, PAD.STICK_UP),
  DPAD_DOWN: slot('KeyS', 'ArrowDown', PAD.DPAD_DOWN, PAD.STICK_DOWN),
  DPAD_LEFT: slot('KeyA', 'ArrowLeft', PAD.DPAD_LEFT, PAD.STICK_LEFT),
  DPAD_RIGHT: slot('KeyD', 'ArrowRight', PAD.DPAD_RIGHT, PAD.STICK_RIGHT),
  A: slot('KeyL', null, PAD.EAST),
  B: slot('KeyK', null, PAD.SOUTH),
  X: slot('KeyI', null, PAD.NORTH),
  Y: slot('KeyJ', null, PAD.WEST),
  L: slot('KeyQ', null, PAD.L1, PAD.L2),
  R: slot('KeyO', null, PAD.R1, PAD.R2),
  SELECT: slot('KeyV', null, PAD.SELECT),
  START: slot('KeyB', null, PAD.START),
  FAST_FORWARD: slot('ShiftLeft'),
  PAUSE: slot('KeyP'),
  FULLSCREEN: slot('KeyF')
});

/**
 * GBA keyboard defaults follow mGBA's own SDL convention (arrows, X/Z for A/B,
 * A/S for the shoulders, Enter/Backspace for Start/Select). The core's internal
 * handler is switched off once ours is attached, so these are what actually
 * runs -- keeping them identical to mGBA's means switching owners is invisible.
 */
const gbaDefaults = (): SystemBindings => ({
  DPAD_UP: slot('ArrowUp', 'KeyW', PAD.DPAD_UP, PAD.STICK_UP),
  DPAD_DOWN: slot('ArrowDown', 'KeyS', PAD.DPAD_DOWN, PAD.STICK_DOWN),
  DPAD_LEFT: slot('ArrowLeft', 'KeyA', PAD.DPAD_LEFT, PAD.STICK_LEFT),
  DPAD_RIGHT: slot('ArrowRight', 'KeyD', PAD.DPAD_RIGHT, PAD.STICK_RIGHT),
  A: slot('KeyX', null, PAD.EAST),
  B: slot('KeyZ', null, PAD.SOUTH),
  L: slot('KeyA', null, PAD.L1, PAD.L2),
  R: slot('KeyS', null, PAD.R1, PAD.R2),
  START: slot('Enter', null, PAD.START),
  SELECT: slot('Backspace', null, PAD.SELECT),
  FAST_FORWARD: slot('ShiftLeft'),
  PAUSE: slot('KeyP'),
  SAVE_STATE: slot('F5'),
  LOAD_STATE: slot('F8'),
  SCREENSHOT: slot('F9'),
  FULLSCREEN: slot('KeyF'),
  RESET: slot(null)
});

// GBA's defaults double-book KeyA and KeyS: they are the D-Pad alternates
// (WASD) and also L/R in mGBA's scheme. Defaults must not ship a conflict, so
// the WASD alternates lose -- arrows are the primaries and still cover
// movement. All four go, not just the two that clash: half a WASD cluster is
// worse than none, and leaving W and D bound while A and S were silently
// dropped just looks broken in the list.
const gbaDefaultsResolved = (): SystemBindings => {
  const bindings = gbaDefaults();
  for (const action of ['DPAD_UP', 'DPAD_DOWN', 'DPAD_LEFT', 'DPAD_RIGHT']) {
    bindings[action].keyAlternate = null;
  }
  return bindings;
};

export const defaultsFor = (system: System): SystemBindings =>
  system === 'gba' ? gbaDefaultsResolved() : dsDefaults();

export const defaultConfig = (): InputConfig => ({
  version: CONFIG_VERSION,
  nds: dsDefaults(),
  gba: gbaDefaultsResolved(),
  turboRateHz: 12
});

/* ------------------------------------------------------------------ */
/* Labelling                                                           */
/* ------------------------------------------------------------------ */

const CODE_LABEL_EXACT: Record<string, string> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Space: 'Space',
  Enter: 'Enter',
  NumpadEnter: 'Num Enter',
  Backspace: 'Backspace',
  Tab: 'Tab',
  ShiftLeft: 'L Shift',
  ShiftRight: 'R Shift',
  ControlLeft: 'L Ctrl',
  ControlRight: 'R Ctrl',
  AltLeft: 'L Alt',
  AltRight: 'R Alt',
  MetaLeft: 'L Meta',
  MetaRight: 'R Meta',
  CapsLock: 'Caps',
  Escape: 'Esc',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backquote: '`'
};

const PAD_BUTTON_LABEL: Record<string, string> = {
  b0: 'Pad A',
  b1: 'Pad B',
  b2: 'Pad X',
  b3: 'Pad Y',
  b4: 'L1',
  b5: 'R1',
  b6: 'L2',
  b7: 'R2',
  b8: 'Select',
  b9: 'Start',
  b10: 'L Stick',
  b11: 'R Stick',
  b12: 'Pad ↑',
  b13: 'Pad ↓',
  b14: 'Pad ←',
  b15: 'Pad →',
  b16: 'Guide'
};

const AXIS_LABEL: Record<string, string> = {
  'a0-': 'Stick ←',
  'a0+': 'Stick →',
  'a1-': 'Stick ↑',
  'a1+': 'Stick ↓',
  'a2-': 'R Stick ←',
  'a2+': 'R Stick →',
  'a3-': 'R Stick ↑',
  'a3+': 'R Stick ↓'
};

/** Human-readable name for a stored binding slot, for the settings UI. */
export const describeSlot = (value: BindingSlot): string | null => {
  if (!value) return null;

  if (value.startsWith('pad:')) {
    const token = value.slice(4);
    return PAD_BUTTON_LABEL[token] ?? AXIS_LABEL[token] ?? token;
  }

  if (CODE_LABEL_EXACT[value]) return CODE_LABEL_EXACT[value];
  if (value.startsWith('Key')) return value.slice(3);
  if (value.startsWith('Digit')) return value.slice(5);
  if (value.startsWith('Numpad')) return `Num ${value.slice(6)}`;
  return value;
};

/* ------------------------------------------------------------------ */
/* WebMelon interop                                                    */
/* ------------------------------------------------------------------ */

/**
 * Physical-code to the `event.key` WebMelon's listener compares against.
 *
 * This is a best-effort US-layout translation and it cannot be anything else:
 * `event.key` is layout-dependent by definition, so no static table is right
 * for every keyboard. That inaccuracy is confined to the mirror we hand the
 * SDK; our own handler never consults it and stays layout-correct.
 */
export const codeToLegacyKey = (code: BindingSlot): string | null => {
  if (!code || code.startsWith('pad:')) return null;
  if (code.startsWith('Key')) return code.slice(3).toLowerCase();
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) {
    const rest = code.slice(6);
    return /^\d$/.test(rest) ? rest : null;
  }
  switch (code) {
    case 'ArrowUp': return 'ArrowUp';
    case 'ArrowDown': return 'ArrowDown';
    case 'ArrowLeft': return 'ArrowLeft';
    case 'ArrowRight': return 'ArrowRight';
    case 'Space': return ' ';
    case 'Enter': return 'Enter';
    case 'Backspace': return 'Backspace';
    case 'Tab': return 'Tab';
    case 'ShiftLeft':
    case 'ShiftRight': return 'Shift';
    case 'ControlLeft':
    case 'ControlRight': return 'Control';
    case 'AltLeft':
    case 'AltRight': return 'Alt';
    case 'Minus': return '-';
    case 'Equal': return '=';
    case 'BracketLeft': return '[';
    case 'BracketRight': return ']';
    case 'Backslash': return '\\';
    case 'Semicolon': return ';';
    case 'Quote': return "'";
    case 'Comma': return ',';
    case 'Period': return '.';
    case 'Slash': return '/';
    case 'Backquote': return '`';
    default: return null;
  }
};

/** Inverse of codeToLegacyKey, used once when migrating a pre-existing DS map. */
const legacyKeyToCode = (key: string): string | null => {
  if (key.length === 1) {
    if (/[a-zA-Z]/.test(key)) return `Key${key.toUpperCase()}`;
    if (/\d/.test(key)) return `Digit${key}`;
    const punctuation: Record<string, string> = {
      '-': 'Minus', '=': 'Equal', '[': 'BracketLeft', ']': 'BracketRight',
      '\\': 'Backslash', ';': 'Semicolon', "'": 'Quote', ',': 'Comma',
      '.': 'Period', '/': 'Slash', '`': 'Backquote', ' ': 'Space'
    };
    return punctuation[key] ?? null;
  }
  switch (key) {
    case 'ArrowUp': return 'ArrowUp';
    case 'ArrowDown': return 'ArrowDown';
    case 'ArrowLeft': return 'ArrowLeft';
    case 'ArrowRight': return 'ArrowRight';
    case 'Enter': return 'Enter';
    case 'Backspace': return 'Backspace';
    case 'Tab': return 'Tab';
    case 'Shift': return 'ShiftLeft';
    case 'Control': return 'ControlLeft';
    case 'Alt': return 'AltLeft';
    default: return null;
  }
};

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

const clamp = (value: number, min: number, max: number) =>
  Number.isFinite(value) ? Math.min(Math.max(value, min), max) : min;

/**
 * Rebuild one system's map from whatever was stored, filling any action the
 * stored copy has never heard of from defaults.
 *
 * Merging against defaults rather than trusting the stored object is what keeps
 * a config written by an older build working after new actions are added: the
 * user keeps every binding they set, and the new rows arrive bound rather than
 * blank.
 */
const mergeSystem = (stored: unknown, base: SystemBindings): SystemBindings => {
  const result: SystemBindings = {};
  const source = (stored && typeof stored === 'object' ? stored : {}) as Record<string, unknown>;

  for (const action of Object.keys(base)) {
    const raw = source[action] as Partial<ActionBinding> | undefined;
    const fallback = base[action];
    if (!raw || typeof raw !== 'object') {
      result[action] = { ...fallback };
      continue;
    }
    const readSlot = (value: unknown, fallbackValue: BindingSlot): BindingSlot => {
      // `undefined` means "the stored copy predates this slot" -- fall back.
      // An explicit `null` means the user cleared it and must stay cleared.
      if (value === undefined) return fallbackValue;
      return typeof value === 'string' && value.length > 0 ? value : null;
    };
    result[action] = {
      keyPrimary: readSlot(raw.keyPrimary, fallback.keyPrimary),
      keyAlternate: readSlot(raw.keyAlternate, fallback.keyAlternate),
      padPrimary: readSlot(raw.padPrimary, fallback.padPrimary),
      padAlternate: readSlot(raw.padAlternate, fallback.padAlternate),
      turbo: !!raw.turbo,
      toggle: !!raw.toggle
    };
  }
  return result;
};

/**
 * Pull the pre-existing DS map out of WebMelon's own persisted settings.
 *
 * settings.tsx has been writing localStorage['inputSettings'] since before this
 * feature existed, so a returning player already has a customised DS map there.
 * Dropping it on first run of the new build would silently reset their controls,
 * so it is translated forward once.
 */
const migrateLegacyDs = (base: SystemBindings): SystemBindings => {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  } catch {
    return base;
  }
  if (!raw) return base;

  let legacy: { keybinds?: Record<string, number>; alternateKeybinds?: string[]; gamepadBinds?: Record<string, number[]> };
  try {
    legacy = JSON.parse(raw);
  } catch {
    return base;
  }
  if (!legacy || typeof legacy !== 'object') return base;

  const bitToAction: Record<number, string> = {
    0x001: 'A', 0x002: 'B', 0x004: 'SELECT', 0x008: 'START',
    0x010: 'DPAD_RIGHT', 0x020: 'DPAD_LEFT', 0x040: 'DPAD_UP', 0x080: 'DPAD_DOWN',
    0x100: 'R', 0x200: 'L', 0x400: 'X', 0x800: 'Y'
  };

  const result: SystemBindings = {};
  for (const action of Object.keys(base)) result[action] = { ...base[action] };

  if (legacy.keybinds && typeof legacy.keybinds === 'object') {
    const alternates = new Set(Array.isArray(legacy.alternateKeybinds) ? legacy.alternateKeybinds : []);
    // Only clear the keyboard slots of buttons the legacy map actually mentions.
    // A legacy map that never bound X keeps the default for X rather than
    // arriving unbound.
    const touched = new Set<string>();
    for (const [key, bit] of Object.entries(legacy.keybinds)) {
      const action = bitToAction[bit];
      if (!action || !result[action]) continue;
      if (!touched.has(action)) {
        result[action].keyPrimary = null;
        result[action].keyAlternate = null;
        touched.add(action);
      }
      const code = legacyKeyToCode(key);
      if (!code) continue;
      if (alternates.has(key)) {
        result[action].keyAlternate = code;
      } else {
        result[action].keyPrimary = code;
      }
    }
  }

  if (legacy.gamepadBinds && typeof legacy.gamepadBinds === 'object') {
    for (const [action, indices] of Object.entries(legacy.gamepadBinds)) {
      if (!result[action] || !Array.isArray(indices)) continue;
      const [first, second] = indices;
      if (typeof first === 'number') result[action].padPrimary = `pad:b${first}`;
      if (typeof second === 'number') result[action].padAlternate = `pad:b${second}`;
    }
  }

  return result;
};

export const loadConfig = (): InputConfig => {
  const base = defaultConfig();
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage unavailable (private browsing, blocked site data). Defaults are
    // always usable, so this must never throw into the render path.
    return base;
  }

  if (!raw) {
    return { ...base, nds: migrateLegacyDs(base.nds) };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<InputConfig>;
    return {
      version: CONFIG_VERSION,
      nds: mergeSystem(parsed.nds, base.nds),
      gba: mergeSystem(parsed.gba, base.gba),
      turboRateHz: clamp(parsed.turboRateHz ?? base.turboRateHz, TURBO_RATE_MIN, TURBO_RATE_MAX)
    };
  } catch {
    return base;
  }
};

export const saveConfig = (config: InputConfig): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Nothing useful to do -- the in-memory config still drives this session.
  }
};

/* ------------------------------------------------------------------ */
/* Conflict handling, import/export                                    */
/* ------------------------------------------------------------------ */

type SlotName = 'keyPrimary' | 'keyAlternate' | 'padPrimary' | 'padAlternate';

const KEY_SLOTS: SlotName[] = ['keyPrimary', 'keyAlternate'];
const PAD_SLOTS: SlotName[] = ['padPrimary', 'padAlternate'];

/**
 * Assign `value` to one slot, clearing it wherever else it was bound.
 *
 * A physical key that fires two actions at once is never what the user meant,
 * and leaving the stale copy behind was how the old implementation produced
 * maps where a key visibly belonged to two buttons.
 */
export const assignSlot = (
  bindings: SystemBindings,
  action: string,
  slotName: SlotName,
  value: BindingSlot
): SystemBindings => {
  const isPad = PAD_SLOTS.includes(slotName);
  const affected = isPad ? PAD_SLOTS : KEY_SLOTS;
  const next: SystemBindings = {};

  for (const key of Object.keys(bindings)) {
    const binding = { ...bindings[key] };
    if (value !== null) {
      for (const candidate of affected) {
        if (binding[candidate] === value) binding[candidate] = null;
      }
    }
    next[key] = binding;
  }

  if (next[action]) next[action] = { ...next[action], [slotName]: value };
  return next;
};

export const serializeConfig = (config: InputConfig): string =>
  JSON.stringify(config, null, 2);

/** Parse an imported config, rejecting anything that is not one. */
export const parseConfig = (text: string): InputConfig => {
  const parsed = JSON.parse(text) as Partial<InputConfig>;
  if (!parsed || typeof parsed !== 'object' || (!parsed.nds && !parsed.gba)) {
    throw new Error('Not an emulator control config');
  }
  const base = defaultConfig();
  return {
    version: CONFIG_VERSION,
    nds: mergeSystem(parsed.nds, base.nds),
    gba: mergeSystem(parsed.gba, base.gba),
    turboRateHz: clamp(parsed.turboRateHz ?? base.turboRateHz, TURBO_RATE_MIN, TURBO_RATE_MAX)
  };
};

/* ------------------------------------------------------------------ */
/* Presets                                                             */
/* ------------------------------------------------------------------ */

export interface BindingPreset {
  id: string;
  name: string;
  description: string;
  build: (system: System) => SystemBindings;
}

/** Rewrite only the D-Pad + face/shoulder key slots, leaving extras alone. */
const withKeys = (system: System, keys: Record<string, [BindingSlot, BindingSlot]>): SystemBindings => {
  const bindings = defaultsFor(system);
  for (const [action, [primary, alternate]] of Object.entries(keys)) {
    if (!bindings[action]) continue;
    bindings[action] = { ...bindings[action], keyPrimary: primary, keyAlternate: alternate };
  }
  return bindings;
};

export const PRESETS: BindingPreset[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'The stock layout for this system.',
    build: (system) => defaultsFor(system)
  },
  {
    id: 'wasd',
    name: 'WASD',
    description: 'Movement on WASD, actions on the right hand.',
    build: (system) => withKeys(system, {
      DPAD_UP: ['KeyW', 'ArrowUp'],
      DPAD_DOWN: ['KeyS', 'ArrowDown'],
      DPAD_LEFT: ['KeyA', 'ArrowLeft'],
      DPAD_RIGHT: ['KeyD', 'ArrowRight'],
      A: ['KeyL', null],
      B: ['KeyK', null],
      X: ['KeyI', null],
      Y: ['KeyJ', null],
      L: ['KeyQ', null],
      R: ['KeyO', null],
      SELECT: ['KeyV', null],
      START: ['KeyB', null]
    })
  },
  {
    id: 'arrows',
    name: 'Arrows + ZX',
    description: 'The classic browser-emulator layout.',
    build: (system) => withKeys(system, {
      DPAD_UP: ['ArrowUp', null],
      DPAD_DOWN: ['ArrowDown', null],
      DPAD_LEFT: ['ArrowLeft', null],
      DPAD_RIGHT: ['ArrowRight', null],
      A: ['KeyX', null],
      B: ['KeyZ', null],
      X: ['KeyS', null],
      Y: ['KeyA', null],
      L: ['KeyQ', null],
      R: ['KeyW', null],
      SELECT: ['Backspace', null],
      START: ['Enter', null]
    })
  }
];
