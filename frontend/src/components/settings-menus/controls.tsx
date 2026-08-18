import { useEffect, useRef, useState } from 'preact/hooks';
import './controls.css';
import { System } from '../../cores/types';
import { SettingsMenuProps } from '../settings';
import {
  ACTION_LABELS,
  BindingSlot,
  GamepadSource,
  InputAction,
  PRESETS,
  TURBO_RATE_MAX,
  TURBO_RATE_MIN,
  assignSlot,
  buttonsFor,
  currentAxisThreshold,
  describeSlot,
  extraActionsFor,
  getInputConfig,
  parseConfig,
  serializeConfig,
  setInputCaptureMode,
  setInputConfig,
  useSystemBindings
} from '../../input';

type Device = 'keyboard' | 'controller';
type SlotName = 'keyPrimary' | 'keyAlternate' | 'padPrimary' | 'padAlternate';

interface Capture {
  action: string;
  slotName: SlotName;
}

const slotNamesFor = (device: Device): [SlotName, SlotName] =>
  device === 'keyboard' ? ['keyPrimary', 'keyAlternate'] : ['padPrimary', 'padAlternate'];

export default function ControlsSettingsMenu({ system }: SettingsMenuProps) {
  // With a game running we edit that system's map. At the entrypoint there is
  // no running core, so the user picks which one to set up rather than being
  // shown the DS map unconditionally, which is what used to happen even for a
  // GBA session.
  const [editingSystem, setEditingSystem] = useState<System>(system ?? 'nds');
  const effectiveSystem = system ?? editingSystem;

  const [device, setDevice] = useState<Device>('keyboard');
  const [capture, setCapture] = useState<Capture | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { config, bindings, write, reset } = useSystemBindings(effectiveSystem);
  const importRef = useRef<HTMLInputElement>(null);

  const [primarySlot, alternateSlot] = slotNamesFor(device);
  const buttons = buttonsFor(effectiveSystem);
  const extras = extraActionsFor(effectiveSystem);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2600);
  };

  const commit = (action: string, slotName: SlotName, value: BindingSlot) => {
    write(assignSlot(bindings, action, slotName, value));
  };

  const startCapture = (action: string, slotName: SlotName) => {
    setCapture({ action, slotName });
  };

  const clearSlot = (action: string, slotName: SlotName) => {
    setCapture(null);
    commit(action, slotName, null);
  };

  const toggleFlag = (action: string, flag: 'turbo' | 'toggle') => {
    const binding = bindings[action];
    if (!binding) return;
    write({ ...bindings, [action]: { ...binding, [flag]: !binding[flag] } });
  };

  /**
   * Binding capture.
   *
   * Three things the previous implementation got wrong and this fixes:
   *
   * - It read `event.key`, so a binding made with Shift held stored a different
   *   value than the key produces unshifted, and every binding was tied to the
   *   user's keyboard layout. `event.code` is the physical key.
   * - There was no way out. No Escape, no click-away -- once a slot was clicked
   *   the only exit was to bind something. Escape now cancels, and so does
   *   clicking anywhere else.
   * - The capture listener ran while the game did, so the key being bound also
   *   reached the core. setInputCaptureMode suspends the play handlers for the
   *   duration.
   */
  useEffect(() => {
    if (!capture) return;

    setInputCaptureMode(true);

    const finish = (value: BindingSlot | undefined) => {
      if (value !== undefined) commit(capture.action, capture.slotName, value);
      setCapture(null);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      // Capture phase, so this beats the modal's own Escape-to-close handler on
      // window. Escape here means "stop binding", not "close settings".
      event.preventDefault();
      event.stopPropagation();
      if (event.code === 'Escape') {
        finish(undefined);
        return;
      }
      if (device !== 'keyboard') return;
      finish(event.code);
    };

    const onMouseDown = () => finish(undefined);

    window.addEventListener('keydown', onKeyDown, true);
    // Safe to attach now: the click that opened this capture already dispatched
    // its mousedown, so this only sees the *next* one.
    window.addEventListener('mousedown', onMouseDown, true);

    let frame: number | null = null;
    if (device === 'controller') {
      const threshold = currentAxisThreshold();
      const poll = () => {
        const found = GamepadSource.captureSlot(threshold);
        if (found) {
          finish(found);
          return;
        }
        frame = requestAnimationFrame(poll);
      };
      frame = requestAnimationFrame(poll);
    }

    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('mousedown', onMouseDown, true);
      if (frame !== null) cancelAnimationFrame(frame);
      setInputCaptureMode(false);
    };
  }, [capture, device, bindings]);

  // Leaving the menu (or the modal) mid-capture must not leave play input
  // suspended for the rest of the session.
  useEffect(() => () => setInputCaptureMode(false), []);

  const applyPreset = (presetId: string) => {
    const preset = PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    write(preset.build(effectiveSystem));
    flash(`Applied the ${preset.name} layout.`);
  };

  const exportConfig = () => {
    const blob = new Blob([serializeConfig(getInputConfig())], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'emulator-controls.json';
    link.click();
    URL.revokeObjectURL(url);
    flash('Exported emulator-controls.json.');
  };

  const importConfig = (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    // Clear immediately so re-picking the same file still fires a change event.
    input.value = '';
    if (!file) return;

    file.text()
      .then((text) => {
        setInputConfig(parseConfig(text));
        flash('Imported control config.');
      })
      .catch(() => flash('That file is not a control config.'));
  };

  const resetSystem = () => {
    setCapture(null);
    reset();
    flash(`Reset ${effectiveSystem === 'gba' ? 'Game Boy Advance' : 'Nintendo DS'} controls to defaults.`);
  };

  const renderSlot = (action: string, slotName: SlotName) => {
    const isActive = capture?.action === action && capture?.slotName === slotName;
    const value = bindings[action]?.[slotName] ?? null;
    const label = describeSlot(value);

    return (
      <div
        className={isActive ? 'controls-slot controls-ctrl-active' : 'controls-slot'}
        role="button"
        tabIndex={0}
        title="Click to bind, right-click to clear"
        onClick={() => startCapture(action, slotName)}
        onContextMenu={(e) => {
          e.preventDefault();
          clearSlot(action, slotName);
        }}
      >
        {isActive ? (
          <span className="unbound-text-active">
            {device === 'keyboard' ? 'press a key' : 'press a button'}
          </span>
        ) : label ? (
          <kbd className="kbd kbd-sm">{label}</kbd>
        ) : (
          <span className="unbound-text">unbound</span>
        )}
      </div>
    );
  };

  const renderRow = (action: InputAction, showFlags: boolean) => {
    const binding = bindings[action];
    if (!binding) return null;
    return (
      <div className="controls-control" key={action}>
        <div className="controls-ctrl-name">
          <span className="controls-ctrl-name-text">{ACTION_LABELS[action]}</span>
        </div>
        {renderSlot(action, primarySlot)}
        {renderSlot(action, alternateSlot)}
        <div className="controls-flags">
          {showFlags ? (
            <>
              <label className="controls-flag" title="Auto-fire while this is held">
                <input
                  type="checkbox"
                  className="checkbox checkbox-xs"
                  checked={binding.turbo}
                  onChange={() => toggleFlag(action, 'turbo')}
                />
                <span>Turbo</span>
              </label>
              <label className="controls-flag" title="Tap to hold it down, tap again to let go">
                <input
                  type="checkbox"
                  className="checkbox checkbox-xs"
                  checked={binding.toggle}
                  onChange={() => toggleFlag(action, 'toggle')}
                />
                <span>Hold</span>
              </label>
            </>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="controls-container">
      <div className="controls-toolbar">
        {system === null ? (
          <div className="join">
            <input
              className="join-item btn btn-sm"
              type="radio"
              name="controls-system"
              aria-label="Nintendo DS"
              checked={editingSystem === 'nds'}
              onClick={() => { setCapture(null); setEditingSystem('nds'); }}
            />
            <input
              className="join-item btn btn-sm"
              type="radio"
              name="controls-system"
              aria-label="Game Boy Advance"
              checked={editingSystem === 'gba'}
              onClick={() => { setCapture(null); setEditingSystem('gba'); }}
            />
          </div>
        ) : (
          <span className="controls-system-badge">
            {system === 'gba' ? 'Game Boy Advance' : 'Nintendo DS'}
          </span>
        )}

        <div className="join">
          <input
            className="join-item btn btn-sm"
            type="radio"
            name="controls-device"
            aria-label="Keyboard"
            checked={device === 'keyboard'}
            onClick={() => { setCapture(null); setDevice('keyboard'); }}
          />
          <input
            className="join-item btn btn-sm"
            type="radio"
            name="controls-device"
            aria-label="Controller"
            checked={device === 'controller'}
            onClick={() => { setCapture(null); setDevice('controller'); }}
          />
        </div>
      </div>

      <div className="controls-toolbar">
        <select
          className="select select-sm select-bordered"
          value=""
          onChange={(e) => {
            const target = e.currentTarget as HTMLSelectElement;
            applyPreset(target.value);
            target.value = '';
          }}
        >
          <option value="" disabled>Apply a preset...</option>
          {PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>{preset.name} — {preset.description}</option>
          ))}
        </select>
        <button type="button" className="btn btn-sm" onClick={resetSystem}>Reset to defaults</button>
        <button type="button" className="btn btn-sm" onClick={exportConfig}>Export</button>
        <button type="button" className="btn btn-sm" onClick={() => importRef.current?.click()}>Import</button>
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          className="controls-file-input"
          onChange={importConfig}
        />
      </div>

      {device === 'controller' ? (
        <p className="controls-hint">
          Controller bindings are read from whichever pad is connected. Stick directions use the
          axis sensitivity set in Controller Input, so there is only one deadzone to tune.
        </p>
      ) : null}

      {notice ? <div className="controls-notice">{notice}</div> : null}

      <div className="controls-list">
        <div className="controls-section-heading">
          <span>Buttons</span>
          <span className="controls-column-hint">primary / alternate</span>
        </div>
        {buttons.map((action) => renderRow(action, true))}

        <div className="controls-section-heading">
          <span>Shortcuts</span>
          <span className="controls-column-hint">primary / alternate</span>
        </div>
        {extras.map((action) => renderRow(action, false))}
      </div>

      <div className="controls-turbo-rate">
        <span className="label-text">Turbo speed</span>
        <input
          type="range"
          className="range range-sm"
          min={TURBO_RATE_MIN}
          max={TURBO_RATE_MAX}
          step={1}
          value={config.turboRateHz}
          onInput={(e) => setInputConfig({
            ...getInputConfig(),
            turboRateHz: Number((e.target as HTMLInputElement).value)
          })}
        />
        <span className="controls-turbo-value">{config.turboRateHz} / sec</span>
      </div>
    </div>
  );
}
