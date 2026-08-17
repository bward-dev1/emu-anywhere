import { useState, useEffect, useRef } from 'preact/hooks';
import './emulator.css';
import { LuChevronsRight, LuPause, LuSettings, LuX } from 'react-icons/lu';
import { EmuCore, System } from '../cores/types';
import TouchControls from './touch-controls';

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
  const gbaCanvasRef = useRef<HTMLCanvasElement>(null);

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
    pauseEmulator();
    onOpenSettings();
  };

  const shutdownEmulator = () => {
    core.destroy();
    stopEmulating();
  };

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
        </div>
      </div>
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
      {bootError && (
        <div className="emulator-boot-error">Could not start this ROM: {bootError}</div>
      )}
      <TouchControls system={system} onInput={handleTouchInput} />
    </>
  )
}
