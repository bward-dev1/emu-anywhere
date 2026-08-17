export type System = 'nds' | 'gba';

export type DsInputButton = (
  'A' | 'B' | 'SELECT' | 'START' | 'DPAD_RIGHT' | 'DPAD_LEFT' | 'DPAD_UP' | 'DPAD_DOWN' | 'R' | 'L' | 'X' | 'Y'
);

export type GbaInputButton = (
  'A' | 'B' | 'SELECT' | 'START' | 'DPAD_RIGHT' | 'DPAD_LEFT' | 'DPAD_UP' | 'DPAD_DOWN' | 'R' | 'L'
);

export type InputButton = DsInputButton | GbaInputButton;

export interface EmuCore {
  boot(rom?: Uint8Array): Promise<void>;
  // Cores that render into a canvas the view owns adopt it here and size their
  // own backing store. Absent on cores (NDS/WebMelon) that locate their canvases
  // by element id instead.
  attachCanvas?(canvas: HTMLCanvasElement): void;
  pause(): void;
  resume(): void;
  setButton(btn: InputButton, pressed: boolean): void;
  setSpeed(multiplier: number): void;
  destroy(): void;
  getGameTitle(): string | null;
}

export interface CoreState {
  system: System;
  core: EmuCore;
  romTitle: string;
}
