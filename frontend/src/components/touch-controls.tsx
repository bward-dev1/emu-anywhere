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
  [key: number]: {
    currentButton: string | null;
    startX: number;
    startY: number;
  };
}

const TouchControls: FunctionComponent<TouchControlsProps> = ({ system, onInput }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState<boolean | null>(null);
  const [pressedButtons, setPressedButtons] = useState<PressedButtons>({});
  const pointerStateRef = useRef<PointerState>({});

  useEffect(() => {
    const mediaQuery = window.matchMedia('(pointer: coarse)');
    const handleChange = (e: MediaQueryListEvent) => {
      setIsVisible(e.matches);
    };

    setIsVisible(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  const vibrate = () => {
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  };

  const getButtonAtPoint = (x: number, y: number): string | null => {
    if (!containerRef.current) return null;

    const element = document.elementFromPoint(x, y);
    if (!element) return null;

    const button = element.closest('[data-button]') as HTMLElement | null;
    if (!button || !button.dataset.button) return null;

    return button.dataset.button;
  };

  const handlePointerDown = (e: PointerEvent) => {
    if (!containerRef.current) return;

    e.preventDefault();
    const target = e.target as HTMLElement;
    const button = target.closest('[data-button]') as HTMLElement | null;

    if (!button || !button.dataset.button) return;

    const btnName = button.dataset.button;
    containerRef.current.setPointerCapture(e.pointerId);

    const rect = containerRef.current.getBoundingClientRect();
    pointerStateRef.current[e.pointerId] = {
      currentButton: btnName,
      startX: e.clientX - rect.left,
      startY: e.clientY - rect.top
    };

    setPressedButtons((prev) => ({ ...prev, [btnName]: true }));
    vibrate();
    onInput(btnName, true);
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!containerRef.current || !pointerStateRef.current[e.pointerId]) return;

    const pointerState = pointerStateRef.current[e.pointerId];

    const buttonAtPoint = getButtonAtPoint(e.clientX, e.clientY);

    if (buttonAtPoint && buttonAtPoint !== pointerState.currentButton) {
      const oldButton = pointerState.currentButton;

      if (oldButton && pressedButtons[oldButton]) {
        setPressedButtons((prev) => ({ ...prev, [oldButton]: false }));
        onInput(oldButton, false);
      }

      pointerState.currentButton = buttonAtPoint;
      setPressedButtons((prev) => ({ ...prev, [buttonAtPoint]: true }));
      vibrate();
      onInput(buttonAtPoint, true);
    }
  };

  const handlePointerUp = (e: PointerEvent) => {
    if (!containerRef.current || !pointerStateRef.current[e.pointerId]) return;

    const pointerState = pointerStateRef.current[e.pointerId];
    const btnName = pointerState.currentButton;

    if (btnName && pressedButtons[btnName]) {
      setPressedButtons((prev) => ({ ...prev, [btnName]: false }));
      onInput(btnName, false);
    }

    containerRef.current.releasePointerCapture(e.pointerId);
    delete pointerStateRef.current[e.pointerId];
  };

  const handlePointerCancel = (e: PointerEvent) => {
    handlePointerUp(e);
  };

  const toggleVisibility = () => {
    setIsVisible((prev) => !prev);
  };

  if (isVisible === null) {
    return null;
  }

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
          <button data-button="up" className="dpad-button dpad-up" />
          <button data-button="left" className="dpad-button dpad-left" />
          <button data-button="down" className="dpad-button dpad-down" />
          <button data-button="right" className="dpad-button dpad-right" />
        </div>

        <div className="face-buttons-area">
          {system === 'nds' && (
            <>
              <button data-button="y" className="face-button face-y" />
              <button data-button="x" className="face-button face-x" />
            </>
          )}
          <button data-button="b" className="face-button face-b" />
          <button data-button="a" className="face-button face-a" />
        </div>

        <div className="shoulder-buttons">
          <button data-button="l" className="shoulder-button shoulder-l" />
          <button data-button="r" className="shoulder-button shoulder-r" />
        </div>

        <div className="center-buttons">
          <button data-button="select" className="center-button select" />
          <button data-button="start" className="center-button start" />
        </div>
      </div>

      <button className="toggle-controls-btn" onClick={toggleVisibility}>
        {isVisible ? '⌨' : '🎮'}
      </button>
    </div>
  );
};

export default TouchControls;
