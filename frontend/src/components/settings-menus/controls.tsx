import { useEffect, useState } from 'preact/hooks';
import './controls.css';

interface ControlSetting {
  keyPrimary: string|null;
  keyAlternate: string|null;
  name: string;
  bitfield: number;
}

export default function ControlsSettingsMenu() {

  const [inputMode, setInputMode] = useState('keyboard');
  const [controlSettings, setControlSettings] = useState<ControlSetting[]>([]);
  const [isBinding, setIsBinding] = useState(false);
  const [isBindingAlternate, setIsBindingAlternate] = useState(false);
  const [bindingIndex, setBindingIndex] = useState(0);

  const loadSettings = () => {
    const inputSettings = window.WebMelon.input.getInputSettings();

    if (inputMode === 'keyboard') {
      let keyboardSettings: ControlSetting[] = [];
      for (const buttonType in window.WebMelon.constants.DS_INPUT_MAP) {
        let bitmask = window.WebMelon.constants.DS_INPUT_MAP[buttonType as keyof typeof window.WebMelon.constants.DS_INPUT_MAP];
        let buttonKeybinds = Object.keys(inputSettings.keybinds).filter(
          x => inputSettings.keybinds[x] === bitmask
        );
        console.log(buttonKeybinds);
        // TODO: differentiate between primary and alternate once we add data structure for that
        const keyPrimary = buttonKeybinds.filter(x => !inputSettings.alternateKeybinds.includes(x))[0] ?? null;
        const keyAlternate = buttonKeybinds.filter(x => inputSettings.alternateKeybinds.includes(x))[0] ?? null;
        keyboardSettings.push({
          keyPrimary,
          keyAlternate,
          name: window.WebMelon.constants.DS_BUTTON_NAME_MAP[buttonType as keyof typeof window.WebMelon.constants.DS_BUTTON_NAME_MAP],
          bitfield: bitmask
        })
      }
      console.log(keyboardSettings)
      setControlSettings(keyboardSettings);
    } else {
      // TODO: implement controller settings
      setControlSettings([]);
    }
  };

  const updateKeyboardControlSettings = () => {
    let keybinds: {[key: string]: number} = {};
    let alternateKeybinds: string[] = [];
    for (const setting of controlSettings) {
      if (setting.keyPrimary) {
        keybinds[setting.keyPrimary] = setting.bitfield;
      }
      if (setting.keyAlternate) {
        keybinds[setting.keyAlternate] = setting.bitfield;
        alternateKeybinds.push(setting.keyAlternate);
      }
    }
    let newInputSettings = window.WebMelon.input.getInputSettings();
    newInputSettings.keybinds = keybinds;
    newInputSettings.alternateKeybinds = alternateKeybinds;
    window.WebMelon.input.setInputSettings(newInputSettings);
  };

  const startBinding = (index: number, alternate: boolean) => {
    setBindingIndex(index);
    setIsBindingAlternate(alternate);
    setIsBinding(true);
  }

  const removeBinding = (index: number, alternate: boolean) => {
    let newControlSettings = [...controlSettings];
    if (alternate) {
      newControlSettings[index].keyAlternate = null;
    } else {
      newControlSettings[index].keyPrimary = null;
    }
    setIsBinding(false);
    setControlSettings(newControlSettings);
    updateKeyboardControlSettings();
  }

  const bindingKeyPressHandler = (event: KeyboardEvent) => {
    let newControlSettings = [...controlSettings];
    for (const settingIndex in newControlSettings) {
      if (newControlSettings[settingIndex].keyPrimary === event.key) {
        newControlSettings[settingIndex].keyPrimary = null;
      }
      if (newControlSettings[settingIndex].keyAlternate === event.key) {
        newControlSettings[settingIndex].keyAlternate = null;
      }
      if (settingIndex === bindingIndex.toString()) {
        if (isBindingAlternate) {
          newControlSettings[settingIndex].keyAlternate = event.key;
        } else {
          newControlSettings[settingIndex].keyPrimary = event.key;
        }
      }
    }
    setControlSettings(newControlSettings);
    updateKeyboardControlSettings();
    setIsBinding(false);
  };

  useEffect(() => {
    if (isBinding) {
      window.addEventListener('keydown', bindingKeyPressHandler);
      return () => {
        window.removeEventListener('keydown', bindingKeyPressHandler);
      };
    }
  }, [isBinding]);

  useEffect(() => {
    setIsBinding(false);
    loadSettings();
  }, [inputMode]);

  return (
    <div className="controls-container">
      <div className="controls-input-mode-selector">
        <div className="join">
          <input 
            className="join-item btn"
            type="radio"
            name="options"
            aria-label="Keyboard"
            checked={inputMode === 'keyboard'}
            onClick={() => setInputMode('keyboard')}
          />
          <input
            className="join-item btn"
            type="radio"
            name="options"
            aria-label="Controller"
            checked={inputMode === 'controller'}
            onClick={() => setInputMode('controller')}
          />
        </div>
      </div>
      <div className="controls-list">
        {controlSettings.length === 0 ? (
          <span>Customizable controller settings not implemented yet.</span>
        ) : controlSettings.map((setting, index) => (
          <div className="controls-control" key={index}>
            <div className="controls-ctrl-name">
              <span className="controls-ctrl-name-text">{setting.name}</span>
            </div>
            <div
              className={
                (isBinding && bindingIndex === index && !isBindingAlternate) ? 
                  'controls-ctrl-primary controls-ctrl-active' : 'controls-ctrl-primary'
              }
              onClick={() => startBinding(index, false)}
              onContextMenu={(e) => {
                e.preventDefault();
                removeBinding(index, false);
              }}
            >
              <span>
                {setting.keyPrimary ? (
                  <kbd className="kbd kbd-sm">{setting.keyPrimary.toUpperCase()}</kbd>
                ) : (
                  <span className={(isBinding && bindingIndex === index && !isBindingAlternate) ? 'unbound-text-active' : 'unbound-text'}>
                    {(isBinding && bindingIndex === index && !isBindingAlternate) ? 'press key' : 'click to bind...'}
                  </span>
                )}
              </span>
            </div>
            <div 
              className={
                (isBinding && bindingIndex === index && isBindingAlternate) ? 
                  'controls-ctrl-alternate controls-ctrl-active' : 'controls-ctrl-alternate'
              }
              onClick={() => startBinding(index, true)}
              onContextMenu={(e) => {
                e.preventDefault();
                removeBinding(index, true);
              }}
            >
              <span>
                {setting.keyAlternate ? (
                  <kbd className="kbd kbd-sm">{setting.keyAlternate.toUpperCase()}</kbd>
                ) : (
                  <span className={(isBinding && bindingIndex === index && isBindingAlternate) ? 'unbound-text-active' : 'unbound-text'}>
                    {(isBinding && bindingIndex === index && isBindingAlternate) ? 'press key' : 'click to bind...'}
                  </span>
                )}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}