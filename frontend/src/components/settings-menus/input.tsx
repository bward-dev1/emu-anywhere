import { useEffect, useState } from 'preact/hooks';
import { FormEvent } from 'preact/compat';
import './input.css';
import {
  getAxisSensitivity,
  getRumbleIntensity,
  isWebMelonAvailable,
  setAxisSensitivity,
  setRumbleIntensity
} from '../../input';

export default function InputSettingsMenu() {
  const [axisSensitivityValue, setAxisSensitivityValue] = useState(50);
  const [rumbleIntensityValue, setRumbleIntensityValue] = useState(50);
  const available = isWebMelonAvailable();

  // Seed once on mount. This used to be a useEffect with no dependency array,
  // so it re-read the SDK and called both setState functions on every single
  // render -- it only escaped being an infinite loop because the values kept
  // comparing equal.
  useEffect(() => {
    setAxisSensitivityValue(Math.round(getAxisSensitivity() * 100));
    setRumbleIntensityValue(Math.round(getRumbleIntensity() * 100));
  }, []);

  const handleAxisSensitivityChange = (event: FormEvent<HTMLInputElement>) => {
    const value = parseInt(event.currentTarget.value, 10);
    if (!Number.isFinite(value)) return;
    // Track it in local state too. Previously the slider wrote to the SDK but
    // never updated the value it was rendered from, so the thumb only moved
    // because of the every-render re-read above.
    setAxisSensitivityValue(value);
    setAxisSensitivity(value / 100);
  };

  const handleRumbleIntensityChange = (event: FormEvent<HTMLInputElement>) => {
    const value = parseInt(event.currentTarget.value, 10);
    if (!Number.isFinite(value)) return;
    setRumbleIntensityValue(value);
    setRumbleIntensity(value / 100);
  };

  return (
    <div className="input-container">
      {!available ? (
        <div className="label">
          <span className="label-text-alt">
            The Nintendo DS core is not loaded, so these settings cannot be read or saved right now.
          </span>
        </div>
      ) : null}
      <div class="label">
        <span class="label-text">Controller Axis Sensitivity</span>
        <span class="label-text-alt">{axisSensitivityValue}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={axisSensitivityValue}
        disabled={!available}
        onInput={handleAxisSensitivityChange}
        className="range"
      />
      <div class="label">
        <span class="label-text-alt">
          Setting this higher will make controller axes trigger less easily. If this is set too low, you may not be able to select
          two buttons at the same time (such as using the top left corner to select D-Pad Left and D-Pad Up simultaneously).
          This is the same deadzone the Game Boy Advance controller support uses.
        </span>
      </div>
      <div class="label">
        <span class="label-text">Rumble Pak Intensity</span>
        <span class="label-text-alt">{rumbleIntensityValue}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={rumbleIntensityValue}
        disabled={!available}
        onInput={handleRumbleIntensityChange}
        className="range"
      />
      <div class="label">
        <span class="label-text-alt">
          Determine how much the controller should vibrate in games that support the Nintendo DS Rumble Pak.
        </span>
      </div>
    </div>
  );
}
