import { EmuCore, InputButton } from './types';

export class NDSCore implements EmuCore {
  async boot(rom: Uint8Array): Promise<void> {
    if (!window.WebMelon) {
      throw new Error('WebMelon not loaded');
    }

    window.WebMelon.cart.createCart();
    window.WebMelon.storage.createDirectory('/roms');
    window.WebMelon.storage.write('/roms/game.nds', rom);
    window.WebMelon.emulator.createEmulator();

    if (!window.WebMelon.cart.loadFileIntoCart('/roms/game.nds')) {
      throw new Error('Failed to load cart');
    }

    const gameCode = window.WebMelon.cart.getUnloadedCartCode();
    window.WebMelon.emulator.setSavePath('/savefiles/' + gameCode + '.sav');
    window.WebMelon.emulator.loadFreeBIOS();
    window.WebMelon.emulator.loadCart();
  }

  pause(): void {
    if (window.WebMelon) {
      window.WebMelon.emulator.pause();
    }
  }

  resume(): void {
    if (window.WebMelon) {
      window.WebMelon.emulator.resume();
    }
  }

  setButton(btn: InputButton, pressed: boolean): void {
    if (!window.WebMelon) return;

    // Map button names to DS input bit values
    const buttonMap: Record<string, number> = {
      'A': 0x001,
      'B': 0x002,
      'SELECT': 0x004,
      'START': 0x008,
      'DPAD_RIGHT': 0x010,
      'DPAD_LEFT': 0x020,
      'DPAD_UP': 0x040,
      'DPAD_DOWN': 0x080,
      'R': 0x100,
      'L': 0x200,
      'X': 0x400,
      'Y': 0x800,
    };

    const buttonBit = buttonMap[btn];
    if (buttonBit !== undefined) {
      // Access the internal emulator button input state
      const internal = (window.WebMelon as any)._internal;
      if (!internal) return;

      if (pressed) {
        internal.emulatorButtonInput |= buttonBit;
      } else {
        internal.emulatorButtonInput &= ~buttonBit;
      }
    }
  }

  setSpeed(multiplier: number): void {
    if (window.WebMelon) {
      window.WebMelon.emulator.setEmulatorSpeed(multiplier);
    }
  }

  destroy(): void {
    if (window.WebMelon) {
      window.WebMelon.emulator.shutdown();
    }
  }

  getGameTitle(): string | null {
    if (window.WebMelon) {
      return window.WebMelon.emulator.getGameTitle();
    }
    return null;
  }
}
