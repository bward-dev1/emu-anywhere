import { useEffect, useState } from 'preact/hooks';
import { FormEvent } from 'preact/compat';
import './input.css';

export default function InputSettingsMenu() {
  const [axisSensitivityValue, setAxisSensitivityValue] = useState(50);
  const [rumbleIntensityValue, setRumbleIntensityValue] = useState(50);

  useEffect(() => {
    const inputSettings = window.WebMelon.input.getInputSettings();
    setAxisSensitivityValue(inputSettings.gamepadAxisSensitivity * 100);
    setRumbleIntensityValue(inputSettings.gamepadRumbleIntensity * 100);
  });

  const handleAxisSensitivityChange = (event: FormEvent<HTMLInputElement>) => {
    const axisValue = parseInt(event.currentTarget.value);
    let inputSettings = window.WebMelon.input.getInputSettings();
    inputSettings.gamepadAxisSensitivity = axisValue / 100;
    window.WebMelon.input.setInputSettings(inputSettings);
  };

  const handleRumbleIntensityChange = (event: FormEvent<HTMLInputElement>) => {
    const intensityValue = parseInt(event.currentTarget.value);
    let inputSettings = window.WebMelon.input.getInputSettings();
    inputSettings.gamepadRumbleIntensity = intensityValue / 100;
    window.WebMelon.input.setInputSettings(inputSettings);
  };

  return (
    <div className="input-container">
      <div class="label">
        <span class="label-text">Controller Axis Sensitivity</span>
      </div>
      <input type="range" min={0} max={100} step={1} value={axisSensitivityValue} onChange={handleAxisSensitivityChange} className="range" />
      <div class="label">
        <span class="label-text-alt">
          Setting this higher will make controller axes trigger less easily. If this is set too low, you may not be able to select
          two buttons at the same time (such as using the top left corner to select D-Pad Left and D-Pad Up simultaneously).
        </span>
      </div>
      <div class="label">
        <span class="label-text">Rumble Pak Intensity</span>
      </div>
      <input type="range" min={0} max={100} step={1} value={rumbleIntensityValue} onChange={handleRumbleIntensityChange} className="range" />
      <div class="label">
        <span class="label-text-alt">
          Determine how much the controller should vibrate in games that support the Nintendo DS Rumble Pak.
        </span>
      </div>
    </div>
  );
}