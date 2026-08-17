export type System = 'nds' | 'gba';

export type DsInputButton = (
  'A' | 'B' | 'SELECT' | 'START' | 'DPAD_RIGHT' | 'DPAD_LEFT' | 'DPAD_UP' | 'DPAD_DOWN' | 'R' | 'L' | 'X' | 'Y'
);

export type GbaInputButton = (
  'A' | 'B' | 'SELECT' | 'START' | 'DPAD_RIGHT' | 'DPAD_LEFT' | 'DPAD_UP' | 'DPAD_DOWN' | 'R' | 'L'
);

export type InputButton = DsInputButton | GbaInputButton;

export interface EmuCore {
  boot(rom: Uint8Array): Promise<void>;
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
