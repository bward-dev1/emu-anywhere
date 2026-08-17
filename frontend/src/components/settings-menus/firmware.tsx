import { LuUpload } from 'react-icons/lu';
import './firmware.css';
import { useEffect, useState } from 'preact/hooks';
import { ChangeEvent } from 'preact/compat';

export default function FirmwareSettingsMenu() {

  const [hasBios7, setHasBios7] = useState(false);
  const [hasBios9, setHasBios9] = useState(false);
  const [hasFirmware, setHasFirmware] = useState(false);


  const handleFiles = async (files: FileList) => {
    const allowedFileNames = ['bios7.bin', 'bios9.bin', 'firmware.bin'];
    for (const file of files) {
      if (!allowedFileNames.includes(file.name)) {
        return;
      }
      window.WebMelon.firmware.uploadBiosFile(file.name, new Uint8Array(await file.arrayBuffer()));
    }
    updateFileStatus();
    window.WebMelon.storage.sync();
  }

  const updateFileStatus = () => {
    const biosStatuses = window.WebMelon.firmware.getActiveBiosFiles();
    setHasBios7(biosStatuses.hasBios7);
    setHasBios9(biosStatuses.hasBios9);
    setHasFirmware(biosStatuses.hasFirmware);
  }

  const fileSelectHandler = (event: ChangeEvent<HTMLInputElement>) => {
    let input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    handleFiles(input.files);
  };

  const fileDropHandler = (event: DragEvent) => {
    event.preventDefault();
    if (!event.dataTransfer?.files.length) return;
    handleFiles(event.dataTransfer.files);
  };
  
  useEffect(() => {
    updateFileStatus();
  }, []);

  return (
    <div className="firmware-container">
      <label for="firmware-file-input" onDrop={fileDropHandler} onDragOver={(e)=>e.preventDefault()}>
        <div className="firmware-input-container" >
          <LuUpload size={30}/>
          <p><b>Add BIOS files</b></p>
          <p>
            Accepts: bios7.bin, bios9.bin, firmware.bin
          </p>
        </div>
      </label>
      <input type="file" id="firmware-file-input" onChange={fileSelectHandler} />
      <br />
      <ul>
        <li>bios7.bin: <b>{hasBios7 ? 'Provided' : 'Missing'}</b></li>
        <li>bios9.bin: <b>{hasBios9 ? 'Provided' : 'Missing'}</b></li>
        <li>firmware.bin: <b>{hasFirmware ? 'Provided' : 'Missing'}</b></li>
      </ul>
    </div>
  );
}