import { EmuCore, InputButton } from './types';

export class NDSCore implements EmuCore {
  async boot(rom: Uint8Array): Promise<void> {
    if (!window.WebMelon) {
      throw new Error('WebMelon not loaded');
    }

    const WebMelon = window.WebMelon;

    WebMelon.cart.createCart();
    WebMelon.storage.createDirectory('/roms');
    WebMelon.storage.write('/roms/game.nds', rom);
    WebMelon.emulator.createEmulator();

    if (!WebMelon.cart.loadFileIntoCart('/roms/game.nds')) {
      throw new Error('Failed to load cart');
    }

    // The save file for this cart (if one exists from a previous session) lives under
    // /savefiles, which is an IndexedDB-backed mount. It is only guaranteed to contain
    // previously persisted saves once its async FS.syncfs() completes, so wait for that
    // directly here rather than going through WebMelon.storage.onPrepare(). The caller
    // (Entrypoint's "Play" handler) also subscribes via onPrepare for its own "reveal the
    // running emulator" transition -- awaiting the lower-level callback ourselves keeps our
    // BIOS/cart/save loading deterministic and finished *before* that transition can fire,
    // instead of racing whichever onPrepare subscriber happened to register first.
    await new Promise<void>((resolve, reject) => {
      WebMelon.storage.initializeSavefilesDirectory((err: unknown) => {
        if (err) {
          reject(new Error(`Failed to initialize DS save directory: ${err}`));
          return;
        }
        resolve();
      });
    });

    const gameCode = WebMelon.cart.getUnloadedCartCode();
    WebMelon.emulator.setSavePath('/savefiles/' + gameCode + '.sav');
    WebMelon.emulator.loadFreeBIOS();
    WebMelon.emulator.loadCart();

    // Now that the cart, BIOS, and any existing save are loaded, prepare the shared virtual
    // filesystem (this also covers /firmware) and fire the "vfs ready" event. Without this
    // call nothing in this boot path ever invokes prepareVirtualFilesystem(), so the
    // onPrepare callback the caller registered before awaiting boot() would never run and
    // the UI would be stuck on its loading state forever -- this was the main reason loading
    // a ROM and pressing Play did not work at all.
    WebMelon.storage.prepareVirtualFilesystem();
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
