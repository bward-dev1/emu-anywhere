import { EmuCore, InputButton } from './types';
import { registerAudioSink, unregisterAudioSink } from '../audio';
import { isolationBlocked } from '../coi';

/**
 * How long to give the module factory before calling it dead.
 *
 * mGBA initialises in ~125ms with real isolation headers, and worst case here is
 * a cold fetch of a 1.8MB wasm on a slow connection, so 30s is generous. What
 * matters is that it is finite: without cross-origin isolation the factory never
 * settles at all -- the SharedArrayBuffer transfer to the pthread worker throws
 * out of band, as an unhandled rejection nothing in the app is listening for,
 * and the promise we are awaiting simply never comes back. Reproduced in Chrome
 * against the deployed build. A boot that hangs forever and says nothing is what
 * the freeze report looked like from the user's side.
 */
const MODULE_INIT_TIMEOUT_MS = 30000;

const ISOLATION_MESSAGE =
  'This browser did not give the emulator the shared memory it needs (cross-origin isolation is off). ' +
  'Reloading the page usually fixes it.';

/**
 * Race module init against a timeout and against the out-of-band failure the
 * pthread pool reports on the window, so a stuck factory becomes an error
 * instead of an indefinite wait.
 */
function bootModule<T>(factory: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      window.removeEventListener('unhandledrejection', onRejection);
      fn();
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = typeof reason === 'string' ? reason : reason?.message ?? '';
      // Emscripten's worker handshake rejects on the window rather than through
      // the factory promise. This is the only signal that init has really died.
      if (/SharedArrayBuffer|crossOriginIsolated/i.test(message)) {
        event.preventDefault();
        finish(() => reject(new Error(ISOLATION_MESSAGE)));
      }
    };
    window.addEventListener('unhandledrejection', onRejection);

    const timer = setTimeout(() => {
      finish(() =>
        reject(new Error('The Game Boy Advance core did not finish starting up. Reload the page and try again.'))
      );
    }, MODULE_INIT_TIMEOUT_MS);

    factory.then(
      (value) => finish(() => resolve(value)),
      (error) => finish(() => reject(error))
    );
  });
}

/**
 * GBA core backed by mGBA compiled to WebAssembly (@thenick775/mgba-wasm).
 *
 * This replaces the previous IodineGBA implementation. Three reasons, in order
 * of how much trouble they were causing:
 *
 * 1. NO BIOS REQUIRED. IodineGBA's Memory.js loadBIOS() refuses to initialize
 *    unless it is handed exactly 0x4000 bytes ("Kill init, rather than allow
 *    HLE for now"), so the only ways to boot were Nintendo's copyrighted BIOS
 *    or hunting for a free replacement. mGBA implements the BIOS calls in HLE,
 *    so it boots a cartridge with no Nintendo code and no third-party BIOS blob
 *    anywhere in the repo. The whole legal question on the GBA side disappears.
 * 2. THE CORE OWNS THE CANVAS. mGBA's SDL2 backing store is sized from the
 *    canvas we hand it. We set 240x160 once, here, and let CSS scale the
 *    element visually. Nothing in the render path ever writes layout-derived
 *    numbers back into canvas.width/height, which is exactly the failure that
 *    left GfxGlueCode blitting into a zero-pixel surface.
 * 3. Accuracy and speed. mGBA is a mature C core; IodineGBA is interpreted JS.
 *
 * mGBA is MPL-2.0. MPL-2.0 section 3.3 explicitly permits distribution under a
 * Secondary License (GPL), so it is compatible with the GPLv3 this project
 * ships as. See NOTICE.md.
 */
export class GBACore implements EmuCore {
  private module: any = null;
  private canvas: HTMLCanvasElement | null = null;
  private booted: boolean = false;
  private paused: boolean = false;
  private stagedRom: Uint8Array | null = null;
  private stagedName: string = 'game.gba';

  /**
   * Hold the ROM without booting.
   *
   * mGBA needs the real <canvas> at module-init time, and that canvas does not
   * exist until <Emulator> has rendered. The entrypoint therefore stages the
   * ROM here and the view calls attachCanvas() + boot() once its canvas is in
   * the document. Booting first and re-parenting a detached canvas afterwards
   * is what produced two elements with id="gba-canvas" and a DOM subtree Preact
   * thought it still owned.
   */
  stageRom(rom: Uint8Array, filename: string = 'game.gba'): void {
    this.stagedRom = rom;
    this.stagedName = filename;
  }

  /**
   * Adopt the canvas the view already rendered, rather than creating a detached
   * one and swapping it into the DOM later.
   *
   * The old code built its own <canvas> in JS, and the view then wiped
   * .emulator-container's innerHTML and appended it -- which left two elements
   * claiming id="gba-canvas" and handed Preact a subtree it no longer owned.
   * Sizing the backing store here, at attach time, and never again is the
   * "core owns the dimensions, CSS owns the presentation" discipline.
   */
  attachCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    canvas.width = 240;
    canvas.height = 160;
  }

  getCanvas(): HTMLCanvasElement {
    if (!this.canvas) throw new Error('Canvas not attached');
    return this.canvas;
  }

  async boot(rom?: Uint8Array, filename?: string): Promise<void> {
    if (this.booted) throw new Error('GBA core already initialized');
    if (!this.canvas) throw new Error('Canvas not attached before boot');

    const romData = rom ?? this.stagedRom;
    if (!romData) throw new Error('No ROM staged or supplied');
    const romName = filename ?? this.stagedName;

    // Check before calling the factory, not after. mgba-wasm is a pthreads build
    // and needs SharedArrayBuffer; without it the factory hangs rather than
    // throwing, so this is the only place the user can be told what is wrong.
    if (typeof SharedArrayBuffer === 'undefined' || !window.crossOriginIsolated) {
      throw new Error(
        isolationBlocked()
          ? `${ISOLATION_MESSAGE} This page has already retried and could not get it.`
          : ISOLATION_MESSAGE
      );
    }

    const mGBA = (await import('@thenick775/mgba-wasm')).default as any;

    // No locateFile override here, deliberately.
    //
    // RetroVault ships a hand-placed public/cores/mgba.wasm and points locateFile
    // at it. Copying that pattern over is a trap: their checked-in binary is
    // 1,929,991 bytes and the wasm inside @thenick775/mgba-wasm@2.4.1 is
    // 1,833,656 -- different builds. Pinning locateFile would pair this package's
    // JS glue with a wasm it was not compiled against. Letting the package
    // resolve its own asset keeps glue and binary a matched pair, and Vite
    // rewrites that reference to a hashed asset URL relative to the emitted
    // bundle, which resolves correctly under a GitHub Pages project sub-path.
    this.module = await bootModule(mGBA({ canvas: this.canvas }));

    await this.module.FSInit();

    const paths = this.module.filePaths();
    const gamePath = `${paths.gamePath}/${romName}`;
    this.module.FS.writeFile(gamePath, romData);

    if (!this.module.loadGame(gamePath)) {
      throw new Error(`mGBA failed to load ROM: ${romName}`);
    }

    this.stagedRom = null;
    this.booted = true;
    this.paused = false;

    this.attachAudio();
  }

  /**
   * Hand this core's audio to the shared manager.
   *
   * Registered after loadGame because that is when mGBA opens its SDL2 audio
   * device, so `module.SDL2` does not exist before it. Everything the manager
   * needs is read through getters for the same reason -- nothing here captures a
   * node that may not have been built yet.
   */
  private attachAudio(): void {
    const module = this.module;
    if (!module) return;

    registerAudioSink({
      id: 'gba',
      // mGBA's real output context, not a private one. Resuming anything else
      // makes no sound: that was the whole bug.
      context: () => module.SDL2?.audioContext ?? null,
      // mGBA takes 0.0..2.0 where 1.0 is 100%, and our 0..1 maps onto the
      // sensible half of that.
      applyVolume: (level) => module.setVolume(level),
      onUnlock: () => {
        // Do not un-pause a paused game's audio device just because the user
        // touched the screen.
        if (!this.paused) module.resumeAudio();
      },
      analyserSource: () => module.SDL2?.audio?.scriptProcessorNode ?? null
    });
  }

  pause(): void {
    if (this.module && !this.paused) {
      this.module.pauseGame();
      this.paused = true;
    }
  }

  resume(): void {
    if (this.module && this.paused) {
      this.module.resumeGame();
      this.paused = false;
    }
  }

  setButton(btn: InputButton, pressed: boolean): void {
    if (!this.module) return;

    // mGBA takes human-readable button names, not key indices.
    const buttonMap: Record<string, string> = {
      'A': 'A',
      'B': 'B',
      'SELECT': 'Select',
      'START': 'Start',
      'DPAD_UP': 'Up',
      'DPAD_DOWN': 'Down',
      'DPAD_LEFT': 'Left',
      'DPAD_RIGHT': 'Right',
      'L': 'L',
      'R': 'R'
      // X/Y are DS-only and have no GBA equivalent -- deliberately unmapped.
    };

    const name = buttonMap[btn];
    if (!name) return;

    if (pressed) {
      this.module.buttonPress(name);
    } else {
      this.module.buttonUnpress(name);
    }
  }

  setSpeed(multiplier: number): void {
    if (!this.module) return;
    if (typeof this.module.setFastForwardMultiplier === 'function') {
      this.module.setFastForwardMultiplier(multiplier);
    } else if (typeof this.module.setFastForward === 'function') {
      this.module.setFastForward(multiplier);
    }
  }

  /**
   * Turn mGBA's own SDL keyboard handling on or off.
   *
   * mGBA bootstraps "canvas wiring, keyboard events, and other autonomous
   * functions" itself, with its key map living in C inside the wasm. That is
   * why GBA controls were unrebindable: there was no JS map to edit. The app's
   * input layer calls this with false on attach so that it is the only thing
   * pressing buttons, and true again on teardown.
   */
  setNativeInputEnabled(enabled: boolean): void {
    if (this.module && typeof this.module.toggleInput === 'function') {
      this.module.toggleInput(enabled);
    }
  }

  saveState(slot: number): boolean {
    if (!this.module || typeof this.module.saveState !== 'function') return false;
    return !!this.module.saveState(slot);
  }

  loadState(slot: number): boolean {
    if (!this.module || typeof this.module.loadState !== 'function') return false;
    return !!this.module.loadState(slot);
  }

  screenshot(): boolean {
    if (!this.module || typeof this.module.screenshot !== 'function') return false;
    return !!this.module.screenshot();
  }

  reset(): void {
    if (this.module && typeof this.module.quickReload === 'function') {
      this.module.quickReload();
    }
  }

  destroy(): void {
    unregisterAudioSink('gba');
    if (this.module) {
      try {
        this.module.quitGame();
      } catch {
        // quitGame throws if no game was ever loaded -- nothing to clean up then.
      }
      this.module = null;
    }
    this.canvas = null;
    this.booted = false;
    this.paused = false;
  }

  getGameTitle(): string | null {
    if (!this.module) return null;
    return this.module.gameName || null;
  }
}
