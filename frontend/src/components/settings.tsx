import { useEffect, useRef, useState } from "preact/hooks";
import './settings.css';
import { LuSave, LuUser } from "react-icons/lu";
import { IoGameControllerOutline, IoHardwareChipOutline } from "react-icons/io5";
import { FaRegKeyboard } from "react-icons/fa";
import { FC, ReactNode } from "preact/compat";
import InputSettingsMenu from "./settings-menus/input";
import ControlsSettingsMenu from "./settings-menus/controls";
import PersonalizationSettingsMenu from "./settings-menus/personalization";
import FirmwareSettingsMenu from "./settings-menus/firmware";
import SaveDataSettingsMenu from "./settings-menus/savedata";
import { System } from "../cores/types";

interface SettingsModalProps {
  showing: boolean;
  onClose: () => void;
  // The system currently being emulated, or null at the entrypoint. The
  // Controls menu needs it so it edits the bindings for the core that is
  // actually running instead of always showing the DS map.
  system?: System | null;
};

export interface SettingsMenuProps {
  system: System | null;
}

interface SettingsMenuItem {
  displayName: string;
  icon: ReactNode;
  component: FC<SettingsMenuProps>;
}

const settingsMenus: {[key: string]: SettingsMenuItem} = {
  controls: {
    displayName: 'Controls',
    icon: (<FaRegKeyboard />),
    component: ControlsSettingsMenu
  },
  personalization: {
    displayName: 'Personalization',
    icon: (<LuUser />),
    component: PersonalizationSettingsMenu
  },
  input: {
    displayName: 'Controller Input',
    icon: (<IoGameControllerOutline />),
    component: InputSettingsMenu
  },
  firmware: {
    displayName: 'Firmware',
    icon: (<IoHardwareChipOutline />),
    component: FirmwareSettingsMenu
  },
  savedata: {
    displayName: 'Save Data',
    icon: (<LuSave />),
    component: SaveDataSettingsMenu
  }
};

export default function SettingsModal({ showing, onClose, system = null }: SettingsModalProps){
  const settingsModalRef = useRef<any>(null);
  const [selectedMenu, setSelectedMenu] = useState('controls');

  const closeSettings = () => {
    // Persisting WebMelon's settings is best-effort. It is a build artifact
    // (public/static/webmelon.js, gitignored and copied in by the build script),
    // so it can legitimately be missing, and an exception here would leave the
    // modal stuck open with no way out.
    if (window.WebMelon) {
      window.localStorage.setItem('inputSettings', JSON.stringify(window.WebMelon.input.getInputSettings()));
      window.localStorage.setItem('firmwareSettings', JSON.stringify(window.WebMelon.firmware.getFirmwareSettings()));
    }
    onClose();
  };

  useEffect(() => {
    // Deliberately not gated on window.WebMelon any more. Controls now covers
    // the GBA core as well, which has nothing to do with the DS SDK, so the
    // whole settings dialog refusing to open without it locked GBA players out
    // of their own key bindings.
    if (!settingsModalRef.current) {
      return;
    }

    if (!showing) {
      settingsModalRef.current.close();
      return;
    }

    const handleEscapePress = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showing) {
        closeSettings();
      }
    };

    window.addEventListener('keydown', handleEscapePress);
    settingsModalRef.current.showModal();
    return () => {
      window.removeEventListener('keydown', handleEscapePress);
    };
  }, [showing]);

  useEffect(() => {
    if (!window.WebMelon) {
      console.error('WebMelon not loaded');
      return;
    }
    const localStorageInputSettings = window.localStorage.getItem('inputSettings');
    const localStorageFirmwareSettings = window.localStorage.getItem('firmwareSettings');
    if (localStorageInputSettings) {
      const inputSettings = JSON.parse(localStorageInputSettings);
      window.WebMelon.input.setInputSettings(inputSettings);
    }
    if (localStorageFirmwareSettings) {
      const firmwareSettings = JSON.parse(localStorageFirmwareSettings);
      window.WebMelon.firmware.setFirmwareSettings(firmwareSettings);
    }
  }, []);

  const SettingsMenuComponent = settingsMenus[selectedMenu].component;

  return (
    <dialog ref={settingsModalRef} id="settings-modal" className="modal">
      <form method="dialog" className="modal-box w-11/12 max-w-5xl">
        <h3 className="font-bold text-lg">Settings</h3>
        <div className="settings-box-container">
          <ul className="menu bg-base-200 rounded-box settings-menu">
            {Object.keys(settingsMenus).map((key) => (
              <li key={key}>
                <a className={selectedMenu === key ? 'active' : ''} onClick={() => setSelectedMenu(key)}>
                  {settingsMenus[key].icon}{' '}
                  {settingsMenus[key].displayName}
                </a>
              </li>
            ))}
          </ul>
          <div className="settings-item">
            {showing ? (
              <SettingsMenuComponent system={system} />
            ) : null}
          </div>
        </div>
        <div className="modal-action">
          <button className="btn" onClick={closeSettings}>Close</button>
        </div>
      </form>
    </dialog>
  )
}