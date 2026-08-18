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
  // Optional capabilities. Present on cores that support them, absent
  // elsewhere, so callers feature-test rather than branching on system.
  //
  // setNativeInputEnabled exists because mGBA compiles its own SDL keyboard
  // handler into the wasm. The app's binding layer switches it off so there is
  // exactly one owner of button state; WebMelon needs no equivalent because its
  // handler is JS we already drive through its settings.
  setNativeInputEnabled?(enabled: boolean): void;
  saveState?(slot: number): boolean;
  loadState?(slot: number): boolean;
  screenshot?(): boolean;
  reset?(): void;
}

export interface CoreState {
  system: System;
  core: EmuCore;
  romTitle: string;
}
