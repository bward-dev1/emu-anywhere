import { useState, useEffect, useCallback } from 'preact/hooks';

/**
 * Per-device presentation settings for the emulator view.
 *
 * These are deliberately NOT part of the emulation config -- nothing here
 * touches a core. Screen scale and offset are applied as a CSS transform on the
 * screen container, so resizing and moving the picture costs a compositor
 * transform and never reflows or re-sizes a canvas backing store. That
 * separation is the point: the core owns canvas.width/height, the view owns
 * everything visual, and the two can't fight.
 */
export interface DisplaySettings {
  /** Multiplier on the rendered screen size. 1 = the CSS-fitted default. */
  screenScale: number;
  /** Screen nudge in px, from drag-to-move in layout mode. */
  screenOffsetX: number;
  screenOffsetY: number;
  /** Multiplier on every touch-control dimension. */
  buttonScale: number;
  /** Kills animations, blurs and shadows for low-end devices. */
  ecoMode: boolean;
}

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  screenScale: 1,
  screenOffsetX: 0,
  screenOffsetY: 0,
  buttonScale: 1,
  ecoMode: false
};

export const SCREEN_SCALE_MIN = 0.5;
export const SCREEN_SCALE_MAX = 3;
export const BUTTON_SCALE_MIN = 0.6;
export const BUTTON_SCALE_MAX = 2;

const STORAGE_KEY = 'emu-display-settings';

const clamp = (value: number, min: number, max: number) =>
  Number.isFinite(value) ? Math.min(Math.max(value, min), max) : min;

const readStored = (): DisplaySettings => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DISPLAY_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<DisplaySettings>;
    return {
      // Clamp on read, not just on write. A stored value from an older build
      // (or a hand-edited one) must never be able to scale the screen to
      // something the user can no longer see well enough to fix.
      screenScale: clamp(parsed.screenScale ?? 1, SCREEN_SCALE_MIN, SCREEN_SCALE_MAX),
      screenOffsetX: clamp(parsed.screenOffsetX ?? 0, -2000, 2000),
      screenOffsetY: clamp(parsed.screenOffsetY ?? 0, -2000, 2000),
      buttonScale: clamp(parsed.buttonScale ?? 1, BUTTON_SCALE_MIN, BUTTON_SCALE_MAX),
      ecoMode: !!parsed.ecoMode
    };
  } catch {
    // Malformed JSON or storage unavailable (private browsing) -- defaults are
    // always usable, so never let this throw into the render path.
    return { ...DEFAULT_DISPLAY_SETTINGS };
  }
};

const writeStored = (settings: DisplaySettings) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Nothing to do -- the settings still apply for this session.
  }
};

export function useDisplaySettings() {
  const [settings, setSettings] = useState<DisplaySettings>(() => readStored());

  const update = useCallback((patch: Partial<DisplaySettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      writeStored(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setSettings(() => {
      writeStored(DEFAULT_DISPLAY_SETTINGS);
      return { ...DEFAULT_DISPLAY_SETTINGS };
    });
  }, []);

  // Eco mode is a body-level class so it can reach the touch-control overlay
  // and anything else outside this component's subtree.
  useEffect(() => {
    document.body.classList.toggle('eco-mode', settings.ecoMode);
    return () => document.body.classList.remove('eco-mode');
  }, [settings.ecoMode]);

  return { settings, update, reset };
}
