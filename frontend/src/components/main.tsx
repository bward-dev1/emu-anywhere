import { useState } from 'preact/hooks';
import './main.css';
import Emulator from './emulator';
import Entrypoint from './entrypoint';
import SettingsModal from './settings';
import { EmuCore, System } from '../cores/types';

export function Main() {
  const [emulating, setEmulating] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [currentCore, setCurrentCore] = useState<EmuCore | null>(null);
  const [currentSystem, setCurrentSystem] = useState<System | null>(null);

  const startEmulating = async (core: EmuCore, system: System) => {
    setCurrentCore(core);
    setCurrentSystem(system);
    setEmulating(true);
  };

  const stopEmulating = async () => {
    setEmulating(false);
    setCurrentCore(null);
    setCurrentSystem(null);
  };

  const onOpenSettings = () => {
    setSettingsOpen(true);
  };

  const onCloseSettings = () => {
    setSettingsOpen(false);
  };

  return (
    <>
      <div className="demo-page-container place-content-center">
        {emulating && currentCore && currentSystem ? (
          <Emulator
            core={currentCore}
            system={currentSystem}
            onOpenSettings={onOpenSettings}
            stopEmulating={stopEmulating}
          />
        ) : (
          <Entrypoint 
            onStartEmulating={startEmulating} 
            onOpenSettings={onOpenSettings}
          />
        )}
      </div>
      <SettingsModal
        showing={settingsOpen}
        onClose={onCloseSettings}
      />
    </>
  )
}
