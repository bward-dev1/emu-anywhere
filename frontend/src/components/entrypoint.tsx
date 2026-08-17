import { LuUpload } from 'react-icons/lu';
import { useState, useCallback, useEffect } from 'preact/hooks';
import { ChangeEvent } from 'preact/compat';
import { NDSCore } from '../cores/nds';
import { GBACore } from '../cores/gba';
import { System, EmuCore } from '../cores/types';
import './entrypoint.css';

interface EntrypointProps {
  onStartEmulating: (core: EmuCore, system: System) => void;
  onOpenSettings: () => void;
}

export default function Entrypoint({ onStartEmulating, onOpenSettings }: EntrypointProps) {
  const [romFileName, setRomFileName] = useState<string|null>(null);
  const [romFile, setRomFile] = useState<File|null>(null);
  const [detectedSystem, setDetectedSystem] = useState<System|null>(null);
  const [loading, setLoading] = useState(false);
  const [isFirmwareBooting, setFirmwareBooting] = useState(false);
  const [firmwareBootEnabled, setFirmwareBootEnabled] = useState(false);

  const detectSystem = (filename: string): System | null => {
    const ext = filename.toLowerCase().split('.').pop();
    if (ext === 'nds') return 'nds';
    if (ext === 'gba') return 'gba';
    return null;
  };

  const fileSelectHandler = (event: ChangeEvent<HTMLInputElement>) => {
    let input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    setRomFile(file);
    setRomFileName(file.name);
    const system = detectSystem(file.name);
    setDetectedSystem(system);
  };

  const fileDropHandler = (event: DragEvent) => {
    event.preventDefault();
    if (event.dataTransfer?.files.length) {
      const file = event.dataTransfer.files[0];
      setRomFile(file);
      setRomFileName(file.name);
      const system = detectSystem(file.name);
      setDetectedSystem(system);
    }
  };

  const prepareHandler = useCallback(async () => {
    console.log('starting prepare handler');
    if (isFirmwareBooting) {
      window.WebMelon.emulator.loadUserBIOS();
    } else {
      let gameCode = window.WebMelon.cart.getUnloadedCartCode();
      console.log(gameCode);
      window.WebMelon.emulator.setSavePath('/savefiles/' + gameCode + '.sav');
      window.WebMelon.emulator.loadFreeBIOS();
      window.WebMelon.emulator.loadCart();
    }
    setLoading(false);
    const core = new NDSCore();
    onStartEmulating(core, 'nds');
  }, [isFirmwareBooting]);
  
  const playHandler = useCallback(async () => {
    if (!romFile || !detectedSystem || loading) {
      return;
    }

    setLoading(true);

    try {
      const romData = new Uint8Array(await romFile.arrayBuffer());

      if (detectedSystem === 'nds') {
        const core = new NDSCore();
        window.WebMelon.storage.onPrepare(() => {
          setLoading(false);
          onStartEmulating(core, 'nds');
        });
        await core.boot(romData);
      } else if (detectedSystem === 'gba') {
        // Stage only. mGBA needs the live <canvas> at init time, so the actual
        // boot happens inside <Emulator> once that canvas is in the document.
        const core = new GBACore();
        core.stageRom(romData, romFile.name);
        setLoading(false);
        onStartEmulating(core, 'gba');
      }
    } catch (error) {
      console.error('Error loading ROM:', error);
      setLoading(false);
    }
  }, [romFile, detectedSystem, loading]);

  const firmwareBootHandler = useCallback(async () => {
    if (!window.WebMelon || loading) {
      return;
    }

    setLoading(true);
    window.WebMelon.emulator.createEmulator();
    setFirmwareBooting(true);
  }, [loading, firmwareBootEnabled, isFirmwareBooting]);

  useEffect(() => {
    if (isFirmwareBooting) {
      window.WebMelon.storage.onPrepare(prepareHandler);
      window.WebMelon.storage.prepareVirtualFilesystem();
    }
  }, [isFirmwareBooting]);

  useEffect(() => {
    window.WebMelon.firmware.canFirmwareBoot();
    setTimeout(() => {
      setFirmwareBootEnabled(window.WebMelon.firmware.canFirmwareBoot());
    }, 500);
  }, []);

  return (
    <>
      <h1>{'🎮 Unified Emulator'}</h1>
      <p>
        Emulate Nintendo DS and Game Boy Advance entirely inside of your browser! To get started, add the .nds or .gba ROM file you would like
        to run below! Your files stay locally on your computer and are not uploaded anywhere. You may also add your
        own BIOS files in Settings to perform a Firmware Boot on DS, which will allow you to boot into the Main Menu if
        you desire.
      </p>
      <p>
        You may also configure certain parts of the emulator (such as keybinds, user information, and firmware files)
        in <a class="link link-primary" onClick={onOpenSettings}>Settings...</a>
      </p>
      <p>
        <b>Note:</b> This software is still in development, and you may encounter unintended behavior or lose saved
        data at anytime.
      </p>
      <label for="rom-file-input" onDrop={fileDropHandler} onDragOver={(e)=>e.preventDefault()}>
        <div className="rom-input-container" >
          <LuUpload size={30}/>
          <p><b>Insert ROM file</b></p>
          <p>
            Drag and drop, supports .nds and .gba files
          </p>
          {romFileName ? (
            <p>
              Selected: {romFileName}
              {detectedSystem ? (
                <span className="ml-2 opacity-60">
                  ({detectedSystem.toUpperCase()})
                </span>
              ) : (
                <span className="ml-2 text-error">
                  (unsupported format)
                </span>
              )}
            </p>
          ) : ''}
        </div>
      </label>
      <input type="file" id="rom-file-input" onChange={fileSelectHandler} accept=".nds,.gba" />
      <button class="btn btn-primary play-button" disabled={romFile === null || loading || !detectedSystem} onClick={playHandler}>
        {loading ? (<span className="loading loading-spinner loading-xs"></span>) : ''} Play
      </button>
      {firmwareBootEnabled ? (
        <button class="btn btn-secondary play-button" disabled={loading} onClick={firmwareBootHandler}>
          {loading ? (<span className="loading loading-spinner loading-xs"></span>) : ''} Firmware Boot
        </button>
      ) : null}
      <div class="footer-disclaimer">
        <span class="disclaimer-text">
          <a class="link link-primary" onClick={onOpenSettings}>Settings</a> • <a href="https://github.com/bward-dev1/emu-anywhere" class="link link-primary">GitHub</a>
        </span>
        <br />
        <span class="disclaimer-text">
          This emulator should <i>only</i> be used to emulate legally acquired ROM and BIOS files. This emulator
          is not affiliated with or endorsed by Nintendo. The Nintendo DS and Game Boy Advance are trademarks of
          Nintendo Corporation, Limited.
        </span>
      </div>
    </>
  );
}
