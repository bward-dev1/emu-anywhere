import { FunctionComponent } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import './touch-controls.css';

interface TouchControlsProps {
  system: 'nds' | 'gba';
  onInput: (btn: string, pressed: boolean) => void;
}

interface PressedButtons {
  [key: string]: boolean;
}

interface PointerState {
  [pointerId: number]: {
    currentButton: string | null;
  };
}

// Explicit user override of the auto-detected visibility, persisted so a
// manual choice survives reloads. `null` means "no override, follow auto-detection".
type OverridePref = 'on' | 'off' | null;

const OVERRIDE_STORAGE_KEY = 'emu-touch-controls-override';

const readStoredOverride = (): OverridePref => {
  try {
    const value = window.localStorage.getItem(OVERRIDE_STORAGE_KEY);
    return value === 'on' || value === 'off' ? value : null;
  } catch {
    // Storage can throw in private-browsing modes -- fall back to auto-detection.
    return null;
  }
};

const writeStoredOverride = (value: OverridePref) => {
  try {
    if (value === null) {
      window.localStorage.removeItem(OVERRIDE_STORAGE_KEY);
    } else {
      window.localStorage.setItem(OVERRIDE_STORAGE_KEY, value);
    }
  } catch {
    // Ignore -- nothing we can do if storage is unavailable.
  }
};

// A device is treated as touch-primary when its primary pointer is coarse
// (finger-sized, imprecise) AND it has no hover-capable pointer available.
// This correctly:
// - turns on for phones/tablets with no mouse/trackpad attached
// - stays off for touchscreen laptops (mouse is the primary, fine pointer)
// - reacts live when an iPad gets/loses a trackpad, since the primary
//   pointer/hover characteristics change and this media query re-evaluates
const AUTO_DETECT_QUERY = '(pointer: coarse) and (hover: none)';

const detectAutoVisible = (): boolean => {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(AUTO_DETECT_QUERY).matches;
};

const TouchControls: FunctionComponent<TouchControlsProps> = ({ system, onInput }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [override, setOverride] = useState<OverridePref>(() => readStoredOverride());
  const [autoVisible, setAutoVisible] = useState<boolean>(() => detectAutoVisible());
  const [pressedButtons, setPressedButtons] = useState<PressedButtons>({});
  const pointerStateRef = useRef<PointerState>({});
  // Reference-counts how many active pointers are currently holding each
  // button, so lifting one of two fingers off the same button doesn't
  // release it while the other finger is still holding it down.
  const pressCountRef = useRef<{ [key: string]: number }>({});

  const isVisible = override !== null ? override === 'on' : autoVisible;

  useEffect(() => {
    if (!window.matchMedia) return;
    const mediaQuery = window.matchMedia(AUTO_DETECT_QUERY);
    const handleChange = (e: MediaQueryListEvent) => setAutoVisible(e.matches);

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    return undefined;
  }, []);

  const vibrate = () => {
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  };

  const pressButton = (name: string) => {
    const count = (pressCountRef.current[name] || 0) + 1;
    pressCountRef.current[name] = count;
    if (count === 1) {
      setPressedButtons((prev) => ({ ...prev, [name]: true }));
      vibrate();
      onInput(name, true);
    }
  };

  const releaseButton = (name: string) => {
    const count = Math.max((pressCountRef.current[name] || 0) - 1, 0);
    pressCountRef.current[name] = count;
    if (count === 0) {
      setPressedButtons((prev) => ({ ...prev, [name]: false }));
      onInput(name, false);
    }
  };

  // Safety net: if a pointerup/pointercancel is ever missed (app switch,
  // notification, browser eating the event), don't leave a button stuck
  // held down forever.
  useEffect(() => {
    const releaseAllPointers = () => {
      Object.values(pointerStateRef.current).forEach((state) => {
        if (state.currentButton) releaseButton(state.currentButton);
      });
      pointerStateRef.current = {};
    };
    const handleVisibilityChange = () => {
      if (document.hidden) releaseAllPointers();
    };

    window.addEventListener('blur', releaseAllPointers);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('blur', releaseAllPointers);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getButtonAtPoint = (x: number, y: number): string | null => {
    const element = document.elementFromPoint(x, y);
    if (!element) return null;

    const button = element.closest('[data-button]') as HTMLElement | null;
    if (!button || !button.dataset.button) return null;

    return button.dataset.button;
  };

  const handlePointerDown = (e: PointerEvent) => {
    if (!containerRef.current) return;

    const target = e.target as HTMLElement;
    const button = target.closest('[data-button]') as HTMLElement | null;

    // Not on a control -- let the event through untouched (e.g. taps meant
    // for the DS bottom-screen/stylus input, which lives underneath this
    // overlay). We never preventDefault() here unless we're actually
    // claiming the touch for a button.
    if (!button || !button.dataset.button) return;

    e.preventDefault();
    const btnName = button.dataset.button;
    containerRef.current.setPointerCapture(e.pointerId);

    pointerStateRef.current[e.pointerId] = { currentButton: btnName };
    pressButton(btnName);
  };

  const handlePointerMove = (e: PointerEvent) => {
    const pointerState = pointerStateRef.current[e.pointerId];
    if (!pointerState) return;

    const buttonAtPoint = getButtonAtPoint(e.clientX, e.clientY);

    if (buttonAtPoint !== pointerState.currentButton) {
      if (pointerState.currentButton) {
        releaseButton(pointerState.currentButton);
      }
      if (buttonAtPoint) {
        pressButton(buttonAtPoint);
      }
      pointerState.currentButton = buttonAtPoint;
    }
  };

  const handlePointerUp = (e: PointerEvent) => {
    const pointerState = pointerStateRef.current[e.pointerId];
    if (!pointerState) return;

    if (pointerState.currentButton) {
      releaseButton(pointerState.currentButton);
    }

    if (containerRef.current?.hasPointerCapture(e.pointerId)) {
      containerRef.current.releasePointerCapture(e.pointerId);
    }
    delete pointerStateRef.current[e.pointerId];
  };

  const handlePointerCancel = (e: PointerEvent) => {
    handlePointerUp(e);
  };

  const toggleVisibility = () => {
    const next: OverridePref = isVisible ? 'off' : 'on';
    setOverride(next);
    writeStoredOverride(next);
  };

  return (
    <div
      ref={containerRef}
      className={`touch-controls ${isVisible ? 'visible' : 'hidden'}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      <div className="controls-container">
        <div className="dpad-area">
          <button data-button="up" className={`dpad-button dpad-up ${pressedButtons.up ? 'pressed' : ''}`} />
          <button data-button="left" className={`dpad-button dpad-left ${pressedButtons.left ? 'pressed' : ''}`} />
          <button data-button="down" className={`dpad-button dpad-down ${pressedButtons.down ? 'pressed' : ''}`} />
          <button data-button="right" className={`dpad-button dpad-right ${pressedButtons.right ? 'pressed' : ''}`} />
        </div>

        <div className="face-buttons-area">
          {system === 'nds' && (
            <>
              <button data-button="y" className={`face-button face-y ${pressedButtons.y ? 'pressed' : ''}`} />
              <button data-button="x" className={`face-button face-x ${pressedButtons.x ? 'pressed' : ''}`} />
            </>
          )}
          <button data-button="b" className={`face-button face-b ${pressedButtons.b ? 'pressed' : ''}`} />
          <button data-button="a" className={`face-button face-a ${pressedButtons.a ? 'pressed' : ''}`} />
        </div>
      </div>

      <div className="shoulder-buttons">
        <button data-button="l" className={`shoulder-button shoulder-l ${pressedButtons.l ? 'pressed' : ''}`} />
        <button data-button="r" className={`shoulder-button shoulder-r ${pressedButtons.r ? 'pressed' : ''}`} />
      </div>

      <div className="center-buttons">
        <button data-button="select" className={`center-button select ${pressedButtons.select ? 'pressed' : ''}`} />
        <button data-button="start" className={`center-button start ${pressedButtons.start ? 'pressed' : ''}`} />
      </div>

      <button className="toggle-controls-btn" onClick={toggleVisibility}>
        {isVisible ? '⌨' : '🎮'}
      </button>
    </div>
  );
};

export default TouchControls;
