import { useEffect, useState } from 'preact/hooks';
import { LuVolume1, LuVolume2, LuVolumeX } from 'react-icons/lu';
import './audio-controls.css';
import {
  AudioSettings,
  getAudioSettings,
  setAudioSettings,
  subscribeAudioSettings,
  unlockAudio
} from '../audio';

/**
 * Volume and mute for whichever core is running.
 *
 * Kept in its own file rather than inside the emulator header so the styling and
 * state live somewhere that is not being edited by the touch and input branches
 * at the same time. The single point of contact is one element in emulator.tsx.
 *
 * The control is deliberately a real user gesture surface: on iOS a suspended
 * AudioContext can only be resumed from inside a gesture handler, so tapping the
 * speaker or dragging the slider is a legitimate second chance to unlock audio
 * that the initial tap on Play could not.
 */
export default function AudioControls() {
  const [settings, setSettings] = useState<AudioSettings>(() => getAudioSettings());
  const [open, setOpen] = useState(false);

  useEffect(() => subscribeAudioSettings(setSettings), []);

  useEffect(() => {
    if (!open) return;
    // Close when the user interacts anywhere else, without an overlay that would
    // swallow taps meant for the game.
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.audio-controls')) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const percent = Math.round(settings.volume * 100);
  const Icon = settings.muted || settings.volume === 0 ? LuVolumeX : settings.volume < 0.5 ? LuVolume1 : LuVolume2;

  return (
    <div className="audio-controls">
      <div className="tooltip" data-tip={settings.muted ? 'Sound off' : `Sound ${percent}%`}>
        <button
          className={settings.muted ? 'btn btn-square btn-primary' : 'btn btn-square'}
          aria-label="Sound"
          onClick={() => {
            unlockAudio();
            setOpen((v) => !v);
          }}
        >
          <Icon size={'1.5em'} />
        </button>
      </div>
      {open && (
        <div className="audio-panel">
          <label className="audio-panel-row">
            <span>Volume</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.volume}
              aria-label="Volume"
              onInput={(e) => {
                const volume = Number((e.target as HTMLInputElement).value);
                // Moving the slider off zero is also an un-mute; leaving it
                // muted while the number climbs is the sort of thing that makes
                // people think the sound is broken again.
                setAudioSettings({ volume, muted: volume === 0 ? settings.muted : false });
              }}
            />
            <span className="audio-panel-value">{percent}%</span>
          </label>
          <button
            className="btn btn-sm"
            onClick={() => setAudioSettings({ muted: !settings.muted })}
          >
            {settings.muted ? 'Unmute' : 'Mute'}
          </button>
        </div>
      )}
    </div>
  );
}
