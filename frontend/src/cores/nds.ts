import { EmuCore, InputButton } from './types';
import { destinationGainFor, registerAudioSink, unregisterAudioSink } from '../audio';

/**
 * The bits of WebMelon we have to reach past the public SDK for. Its shipped
 * webmelon.d.ts describes neither `audio` nor `_internal`, so audio has to be
 * addressed through a narrow structural type rather than `any` everywhere.
 */
interface WebMelonAudioInternals {
  _internal?: {
    emulatorAudioCtx?: AudioContext;
    emulatorAudioNode?: AudioNode | null;
  };
  audio?: {
    getAudioContext?: () => AudioContext;
  };
}

const webMelonAudio = (): WebMelonAudioInternals | null =>
  (window.WebMelon as unknown as WebMelonAudioInternals) ?? null;

export class NDSCore implements EmuCore {
  private paused: boolean = false;

  constructor() {
    // Attach in the constructor, not in boot(), for two reasons. The firmware
    // boot path in entrypoint.tsx builds an NDSCore and never calls boot(), so
    // boot() would miss it entirely. And WebMelon's AudioWorkletNode is created
    // by an async createAudioProcessor() during startEmulation -- our gain node
    // has to already own the destination by then, or the worklet connects
    // straight to the speakers and the volume control has nothing to act on.
    this.attachAudio();
  }

  /**
   * WebMelon builds its AudioContext the instant its script tag runs, long
   * before anyone has touched the screen, and only ever tries to un-suspend it
   * from inside its own frame loop -- which is a timer callback, not a user
   * gesture. Safari ignores that, so on iOS the context stays suspended for the
   * whole session and the DS is silent. Nothing in the frontend touched it
   * before this.
   *
   * There is also no volume anywhere in the WebMelon SDK, so level and mute go
   * through a GainNode we insert in front of the destination.
   */
  private attachAudio(): void {
    registerAudioSink({
      id: 'nds',
      // Read through every time: WebMelon closes this context and constructs a
      // fresh one on shutdown, so a captured reference is stale after one stop.
      context: () => webMelonAudio()?._internal?.emulatorAudioCtx ?? null,
      applyVolume: (level) => {
        const ctx = webMelonAudio()?._internal?.emulatorAudioCtx;
        if (!ctx || ctx.state === 'closed') return;
        destinationGainFor(ctx).gain.value = level;
      },
      onUnlock: () => {
        // WebMelon's own accessor resumes as a side effect; harmless when the
        // context is already running.
        webMelonAudio()?.audio?.getAudioContext?.();
      },
      holdSuspended: () => this.paused,
      // Measure at the gain node rather than at WebMelon's worklet, because
      // everything that reaches the speakers on this context passes through it.
      // That makes a reading post-volume (so mute really does read as zero) and
      // it exists from the moment we attach, instead of appearing whenever the
      // async worklet finishes loading.
      analyserSource: () => {
        const ctx = webMelonAudio()?._internal?.emulatorAudioCtx;
        if (!ctx || ctx.state === 'closed') return null;
        return destinationGainFor(ctx);
      }
    });
  }

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
      this.paused = true;
      window.WebMelon.emulator.pause();
    }
  }

  resume(): void {
    if (window.WebMelon) {
      this.paused = false;
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
    unregisterAudioSink('nds');
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
