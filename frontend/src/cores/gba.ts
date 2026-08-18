import { EmuCore, InputButton } from './types';

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
    this.module = await mGBA({ canvas: this.canvas });

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
