import { useState, useEffect, useRef } from 'preact/hooks';
import './emulator.css';
import { LuChevronsRight, LuMove, LuPause, LuSettings, LuX } from 'react-icons/lu';
import {
  useDisplaySettings,
  SCREEN_SCALE_MIN,
  SCREEN_SCALE_MAX,
  BUTTON_SCALE_MIN,
  BUTTON_SCALE_MAX
} from '../display-settings';
import { EmuCore, System } from '../cores/types';
import TouchControls from './touch-controls';
import AudioControls from './audio-controls';
import EmulatorNotice from './emulator-notice';
import { startWatchdog } from '../watchdog';

interface EmulatorProps {
  core: EmuCore;
  system: System;
  onOpenSettings: () => void;
  stopEmulating: () => void;
}

export default function Emulator({ core, system, onOpenSettings, stopEmulating }: EmulatorProps) {
  const [gameTitle, setGameTitle] = useState(system === 'nds' ? 'Nintendo DS' : 'Game Boy Advance');
  const [gameSubtitle, setGameSubtitle] = useState('');
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [fastForward, setFastForward] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [stallMs, setStallMs] = useState<number | null>(null);
  const gbaCanvasRef = useRef<HTMLCanvasElement>(null);
  const screenStageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
  // Only the pause WE caused when Settings opened may be undone when it closes;
  // a pause the user asked for has to survive a trip through the menu.
  const pausedForSettingsRef = useRef(false);

  const { settings, update, reset } = useDisplaySettings();
  // Dragging the picture around and playing a DS game are the same gesture, so
  // repositioning is gated behind an explicit mode instead of being always-on.
  // Without this, every stylus tap on the DS bottom screen would slide the
  // whole display instead of reaching the game.
  const [layoutMode, setLayoutMode] = useState(false);

  const shutdownListener = () => {
    stopEmulating();
  };

  const pauseEmulator = () => {
    if (paused) return;
    setPaused(true);
    core.pause();
  };

  const resumeEmulator = () => {
    if (!paused) return;
    setPaused(false);
    core.resume();
  };

  const startFastForward = () => {
    if (fastForward || paused) return;
    setFastForward(true);
    core.setSpeed(2);
  };
  
  const stopFastForward = () => {
    if (!fastForward || paused) return;
    setFastForward(false);
    core.setSpeed(1);
  };

  const openSettings = () => {
    if (!paused) pausedForSettingsRef.current = true;
    pauseEmulator();
    onOpenSettings();
  };

  const shutdownEmulator = () => {
    core.destroy();
    stopEmulating();
  };

  // Opening Settings paused the emulator and nothing ever resumed it, so every
  // trip through the menu left the game stopped with no sign of why. The dialog
  // fires `close` whichever way it is dismissed -- the Close button, Escape, or
  // SettingsModal calling close() when its `showing` prop goes false.
  useEffect(() => {
    const dialog = document.getElementById('settings-modal');
    if (!dialog) return;
    const onClose = () => {
      if (!pausedForSettingsRef.current) return;
      pausedForSettingsRef.current = false;
      resumeEmulator();
    };
    dialog.addEventListener('close', onClose);
    return () => dialog.removeEventListener('close', onClose);
  }, [paused]);

  // Notice a main thread that stopped responding for long enough that the app
  // looked dead, and offer a way out once it comes back.
  useEffect(() => startWatchdog((report) => setStallMs(report.gap)) ?? undefined, []);

  useEffect(() => {
    // Lock page scroll/pull-to-refresh for as long as the emulator view is
    // mounted (Main only renders <Emulator> while actively playing).
    document.body.classList.add('emulator-active');
    return () => {
      document.body.classList.remove('emulator-active');
    };
  }, []);

  useEffect(() => {
    if (!started) {
      setStarted(true);

      if (system === 'nds') {
        // NDS boot
        window.WebMelon.emulator.startEmulation('top-screen', 'bottom-screen');
        window.WebMelon.emulator.addShutdownListener(shutdownListener);
        
        if (window.WebMelon.firmware.getFirmwareSettings().shouldFirmwareBoot) {
          setGameTitle('Main Menu');
          setGameSubtitle('Firmware Boot');
        } else {
          const romTitle = window.WebMelon.emulator.getGameTitle();
          if (romTitle) {
            const romTitleParts = romTitle.split('\n');
            setGameTitle(romTitleParts[0]);
            if (romTitleParts.length > 1) {
              setGameSubtitle(romTitleParts[1]);
            }
          }
        }
      } else if (system === 'gba') {
        // GBA boot.
        //
        // The canvas below is the one Preact rendered and still owns. We hand it
        // to the core and let the core size its own backing store (240x160) --
        // we never wipe the container and swap in a second element, and nothing
        // here ever assigns canvas.className. That combination is what used to
        // leave the canvas 0px tall with the emulator faithfully rendering into
        // nothing.
        const canvas = gbaCanvasRef.current;
        if (!canvas) return;

        core.attachCanvas?.(canvas);
        core.boot()
          .then(() => {
            const title = core.getGameTitle();
            if (title) setGameTitle(title);
          })
          .catch((error) => {
            console.error('Failed to boot GBA:', error);
            setBootError(error instanceof Error ? error.message : String(error));
          });
      }
    }
  }, [started, system, core]);

  const beginDrag = (e: PointerEvent) => {
    if (!layoutMode || !screenStageRef.current) return;
    e.preventDefault();
    screenStageRef.current.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: settings.screenOffsetX,
      originY: settings.screenOffsetY
    };
  };

  const continueDrag = (e: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    update({
      screenOffsetX: drag.originX + (e.clientX - drag.startX),
      screenOffsetY: drag.originY + (e.clientY - drag.startY)
    });
  };

  const endDrag = (e: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (screenStageRef.current?.hasPointerCapture(e.pointerId)) {
      screenStageRef.current.releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
  };

  const handleTouchInput = (btn: string, pressed: boolean) => {
    // Convert lowercase button names from touch controls to uppercase names
    const buttonMap: { [key: string]: string } = {
      'up': 'DPAD_UP',
      'down': 'DPAD_DOWN',
      'left': 'DPAD_LEFT',
      'right': 'DPAD_RIGHT',
      'a': 'A',
      'b': 'B',
      'x': 'X',
      'y': 'Y',
      'l': 'L',
      'r': 'R',
      'select': 'SELECT',
      'start': 'START',
    };

    const mappedBtn = buttonMap[btn.toLowerCase()];
    if (mappedBtn) {
      core.setButton(mappedBtn as any, pressed);
    }
  };

  return (
    <>
      <div className="emulator-header">
        <div className="game-title-text-container">
          <span className="game-title-text"><b>{gameTitle}</b> ({gameSubtitle})</span>
        </div>
        <div className="emulator-controls-section">
          <div className="tooltip" data-tip="Stop Emulator">
            <button className="btn btn-square" onClick={shutdownEmulator}>
              <LuX size={'1.5em'} />
            </button>
          </div>
          <div className="tooltip" data-tip={layoutMode ? 'Done adjusting' : 'Move / resize screen'}>
            <button
              className={layoutMode ? 'btn btn-square btn-primary' : 'btn btn-square'}
              onClick={() => setLayoutMode(!layoutMode)}
            >
              <LuMove size={'1.5em'} />
            </button>
          </div>
          <div className="tooltip" data-tip="Settings">
            <button className="btn btn-square" onClick={openSettings}>
              <LuSettings size={'1.5em'} />
            </button>
          </div>
          <div className="tooltip" data-tip={paused ? 'Resume' : 'Pause'}>
            <button 
              className={paused ? 'btn btn-square btn-primary' : 'btn btn-square'}
              onClick={paused ? resumeEmulator : pauseEmulator}
            >
              <LuPause size={'1.5em'} />
            </button>
          </div>
          <div className="tooltip" data-tip={fastForward ? 'Stop fast forward' : 'Fast forward (2x)'}>
            <button 
              className={fastForward ? 'btn btn-square btn-primary' : 'btn btn-square'}
              onClick={fastForward ? stopFastForward : startFastForward}
            >
              <LuChevronsRight size={'1.5em'} />
            </button>
          </div>
          <AudioControls />
        </div>
      </div>
      <div
        ref={screenStageRef}
        className={`screen-stage ${layoutMode ? 'layout-mode' : ''}`}
        style={{
          // A compositor transform, not a resize. The canvas backing store stays
          // exactly 240x160 (GBA) / 256x192 (DS) no matter what the user does
          // here, which is what keeps the picture sharp and keeps this control
          // from ever being able to collapse a canvas to zero pixels.
          transform: `translate(${settings.screenOffsetX}px, ${settings.screenOffsetY}px) scale(${settings.screenScale})`
        }}
        onPointerDown={beginDrag}
        onPointerMove={continueDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
      <div className="emulator-container">
        {system === 'nds' ? (
          <>
            <canvas className="emulator-screen" id="top-screen" height="192" width="256" />
            <canvas className="emulator-screen" id="bottom-screen" height="192" width="256" />
          </>
        ) : (
          <>
            <canvas ref={gbaCanvasRef} className="emulator-screen gba-screen" id="gba-canvas" height="160" width="240" />
          </>
        )}
      </div>
      </div>
      {layoutMode && (
        <div className="layout-panel">
          <label>
            <span>Screen size</span>
            <input
              type="range"
              min={SCREEN_SCALE_MIN}
              max={SCREEN_SCALE_MAX}
              step={0.05}
              value={settings.screenScale}
              onInput={(e) => update({ screenScale: Number((e.target as HTMLInputElement).value) })}
            />
            <span className="layout-panel-value">{settings.screenScale.toFixed(2)}x</span>
          </label>
          <label>
            <span>Button size</span>
            <input
              type="range"
              min={BUTTON_SCALE_MIN}
              max={BUTTON_SCALE_MAX}
              step={0.05}
              value={settings.buttonScale}
              onInput={(e) => update({ buttonScale: Number((e.target as HTMLInputElement).value) })}
            />
            <span className="layout-panel-value">{settings.buttonScale.toFixed(2)}x</span>
          </label>
          <label className="layout-panel-toggle">
            <span>Eco mode</span>
            <input
              type="checkbox"
              checked={settings.ecoMode}
              onChange={(e) => update({ ecoMode: (e.target as HTMLInputElement).checked })}
            />
          </label>
          <p className="layout-panel-hint">Drag the screen to move it.</p>
          <button className="btn btn-sm" onClick={reset}>Reset layout</button>
        </div>
      )}
      {bootError && (
        <EmulatorNotice message={`Could not start this ROM: ${bootError}`} onStop={stopEmulating} />
      )}
      {!bootError && stallMs !== null && (
        <EmulatorNotice
          tone="warning"
          message={`The emulator stopped responding for about ${Math.round(stallMs / 1000)} seconds. Reload if it keeps happening.`}
          onDismiss={() => setStallMs(null)}
        />
      )}
      <TouchControls system={system} onInput={handleTouchInput} buttonScale={settings.buttonScale} />
    </>
  )
}
