import { useState } from 'preact/hooks';
import './personalization.css';
import { FormEvent } from 'preact/compat';

export default function PersonalizationSettingsMenu() {
  const [firmwareSettings, setFirmwareSettings] = useState<WebMelonFirmwareSettings>(
    window.WebMelon.firmware.getFirmwareSettings()
  );

  const setLanguage = (event: FormEvent<HTMLSelectElement>) => {
    let settings = Object.assign({}, firmwareSettings);
    settings.language = parseInt(event.currentTarget.value);
    setFirmwareSettings(window.WebMelon.firmware.setFirmwareSettings(settings));
  }

  const setBirthdayMonth = (event: FormEvent<HTMLSelectElement>) => {
    const birthdayMonth = parseInt(event.currentTarget.value);
    let settings = Object.assign({}, firmwareSettings);
    settings.birthdayMonth = birthdayMonth;
    // Using 2008 as the year will let us have the leap day, which can be set as a
    // birthday on the Nintendo DS.
    let daysInMonth = (new Date(2008, birthdayMonth, 0).getDate());
    if (settings.birthdayDay > daysInMonth) {
      settings.birthdayDay = 1;
    }
    setFirmwareSettings(window.WebMelon.firmware.setFirmwareSettings(settings));
  };

  const setBirthdayDay = (event: FormEvent<HTMLSelectElement>) => {
    const birthdayDay = parseInt(event.currentTarget.value);
    let settings = Object.assign({}, firmwareSettings);
    settings.birthdayDay = birthdayDay;
    setFirmwareSettings(window.WebMelon.firmware.setFirmwareSettings(settings));
  };

  const setNickname = (event: FormEvent<HTMLInputElement>) => {
    let settings = Object.assign({}, firmwareSettings);
    settings.nickname = event.currentTarget.value;
    setFirmwareSettings(window.WebMelon.firmware.setFirmwareSettings(settings));
  };

  return (
    <div className="personalization-container">
      <div className="label">
        <span class="label-text">Name</span>
      </div>
      <input type="text" placeholder="Name" maxlength={10} value={firmwareSettings.nickname} onChange={setNickname} className="input input-bordered w-full" />
      <div className="label">
        <span class="label-text-alt">
          This name will be shown in games and menus inside the emulator. Max length: 10 characters.
        </span>
      </div>
      <div className="label">
        <span class="label-text">Birthday (MM/DD)</span>
      </div>
      <div className="birthday-selection">
        <div className="birthday-selector">
          <select className="select select-bordered w-full max-w-xs" onChange={setBirthdayMonth}>
            {Array.from({length: 12}, (_, i) => i + 1).map((i) => (
              <option
                key={i}
                selected={i === firmwareSettings.birthdayMonth}
              >{i}</option>
            ))}
          </select>
        </div>
        <div className="birthday-selector">
          <select className="select select-bordered w-full max-w-xs" onChange={setBirthdayDay}>
            {Array.from({length: (new Date(2008, firmwareSettings.birthdayMonth, 0).getDate())}, (_, i) => i + 1).map((i) => (
              <option
                key={i}
                selected={i === firmwareSettings.birthdayDay}
              >{i}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="label">
        <span class="label-text-alt">
          Some games may add easter eggs on this day. This doesn't have to be your real birthday.
        </span>
      </div>
      <div className="label">
        <span class="label-text">Language</span>
      </div>
      <div className="birthday-selection">
        <div className="birthday-selector">
          <select className="select select-bordered w-full max-w-xs" onChange={setLanguage}>
            {window.WebMelon.constants.FIRMWARE_LANGUAGES.map((language) => (
              <option
                key={language.id}
                selected={firmwareSettings.language === language.id}
                value={language.id}
              >
                {language.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="label">
        <span class="label-text-alt">
          This language will be used as the firmware language and may be used by the games in the emulator as well.
        </span>
      </div>
    </div>
  );
}