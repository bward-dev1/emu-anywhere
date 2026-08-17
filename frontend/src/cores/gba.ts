import { EmuCore, InputButton } from './types';

export class GBACore implements EmuCore {
  private emulator: any = null;
  private blitter: any = null;
  private mixer: any = null;
  private mixerInput: any = null;
  private canvas: HTMLCanvasElement | null = null;
  private coreTimerID: number | null = null;
  private isPlaying: boolean = false;
  private startTime: number = Date.now();
  private isInitialized: boolean = false;

  async boot(rom: Uint8Array): Promise<void> {
    if (this.isInitialized) {
      throw new Error('GBA core already initialized');
    }

    // Load all GBA scripts
    await this.loadGBAScripts();

    // Create the emulator with SKIPBoot enabled (HLE, no BIOS required)
    this.emulator = this.createEmulator();
    this.emulator.settings.SKIPBoot = true;

    // Create graphics handler
    this.createCanvas();
    this.blitter = new (window as any).GfxGlueCode(240, 160);
    this.blitter.attachCanvas(this.canvas);
    this.blitter.setSmoothScaling(false); // Use pixel-perfect rendering
    this.emulator.attachGraphicsFrameHandler(this.blitter);

    // Create audio handler
    const audioContext = this.createAudioContext();
    this.mixer = new (window as any).GlueCodeMixer(audioContext);
    this.mixerInput = new (window as any).GlueCodeMixerInput(this.mixer);
    this.emulator.attachAudioHandler(this.mixerInput);

    // Attach ROM
    this.emulator.attachROM(rom);

    // Enable HLE boot (no BIOS)
    this.emulator.settings.SKIPBoot = true;

    // Start the timer
    this.startTimer();

    this.isInitialized = true;
  }

  private createCanvas(): void {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'gba-canvas';
    this.canvas.width = 240;
    this.canvas.height = 160;
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.display = 'block';
    this.canvas.style.imageRendering = 'pixelated';
  }

  getCanvas(): HTMLCanvasElement {
    if (!this.canvas) {
      throw new Error('Canvas not initialized');
    }
    return this.canvas;
  }

  private async loadGBAScripts(): Promise<void> {
    const scripts = [
      '/static/gba/base64.js',
      '/static/gba/iodineGBA/core/Emulator.js',
      '/static/gba/iodineGBA/includes/TypedArrayShim.js',
      '/static/gba/iodineGBA/core/Memory.js',
      '/static/gba/iodineGBA/core/CPU.js',
      '/static/gba/iodineGBA/core/CPU/ARM.js',
      '/static/gba/iodineGBA/core/CPU/THUMB.js',
      '/static/gba/iodineGBA/core/CPU/CPSR.js',
      '/static/gba/iodineGBA/core/Wait.js',
      '/static/gba/iodineGBA/core/Timer.js',
      '/static/gba/iodineGBA/core/DMA.js',
      '/static/gba/iodineGBA/core/memory/DMA0.js',
      '/static/gba/iodineGBA/core/memory/DMA1.js',
      '/static/gba/iodineGBA/core/memory/DMA2.js',
      '/static/gba/iodineGBA/core/memory/DMA3.js',
      '/static/gba/iodineGBA/core/IRQ.js',
      '/static/gba/iodineGBA/core/JoyPad.js',
      '/static/gba/iodineGBA/core/Serial.js',
      '/static/gba/iodineGBA/core/Sound.js',
      '/static/gba/iodineGBA/core/sound/Channel1.js',
      '/static/gba/iodineGBA/core/sound/Channel2.js',
      '/static/gba/iodineGBA/core/sound/Channel3.js',
      '/static/gba/iodineGBA/core/sound/Channel4.js',
      '/static/gba/iodineGBA/core/sound/FIFO.js',
      '/static/gba/iodineGBA/core/Cartridge.js',
      '/static/gba/iodineGBA/core/cartridge/SaveDeterminer.js',
      '/static/gba/iodineGBA/core/cartridge/SRAM.js',
      '/static/gba/iodineGBA/core/cartridge/FLASH.js',
      '/static/gba/iodineGBA/core/cartridge/EEPROM.js',
      '/static/gba/iodineGBA/core/cartridge/GPIO.js',
      '/static/gba/iodineGBA/core/Graphics.js',
      '/static/gba/iodineGBA/core/graphics/Renderer.js',
      '/static/gba/iodineGBA/core/graphics/RendererProxy.js',
      '/static/gba/iodineGBA/core/graphics/RendererShim.js',
      '/static/gba/iodineGBA/core/graphics/BGMatrix.js',
      '/static/gba/iodineGBA/core/graphics/BGTEXT.js',
      '/static/gba/iodineGBA/core/graphics/AffineBG.js',
      '/static/gba/iodineGBA/core/graphics/BG2FrameBuffer.js',
      '/static/gba/iodineGBA/core/graphics/OBJ.js',
      '/static/gba/iodineGBA/core/graphics/Window.js',
      '/static/gba/iodineGBA/core/graphics/OBJWindow.js',
      '/static/gba/iodineGBA/core/graphics/Mosaic.js',
      '/static/gba/iodineGBA/core/graphics/ColorEffects.js',
      '/static/gba/iodineGBA/core/graphics/Compositor.js',
      '/static/gba/iodineGBA/core/graphics/Worker.js',
      '/static/gba/iodineGBA/core/RunLoop.js',
      '/static/gba/iodineGBA/core/Saves.js',
      '/static/gba/iodineGBA/core/Worker.js',
      '/static/gba/ROMLoadGlueCode.js',
      '/static/gba/GfxGlueCode.js',
      '/static/gba/XAudioJS/XAudioServer.js',
      '/static/gba/XAudioJS/resampler.js',
      '/static/gba/AudioGlueCode.js',
      '/static/gba/JoyPadGlueCode.js',
      '/static/gba/SavesGlueCode.js',
    ];

    for (const script of scripts) {
      await this.loadScript(script);
    }
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
  }

  private createEmulator(): any {
    // Try to create the emulator using the GameBoyAdvanceEmulator constructor
    // The emulator should be available from the loaded scripts
    const EmulatorClass = (window as any).GameBoyAdvanceEmulator;
    if (!EmulatorClass) {
      throw new Error('GameBoyAdvanceEmulator not found in window');
    }
    return new EmulatorClass();
  }

  private createAudioContext(): any {
    // Return a dummy audio element since GlueCodeMixer expects it
    const audioElement = document.createElement('audio');
    audioElement.id = 'gba-audio';
    audioElement.style.display = 'none';
    document.body.appendChild(audioElement);
    return audioElement;
  }

  private startTimer(): void {
    if (this.coreTimerID !== null) {
      clearInterval(this.coreTimerID);
    }
    this.coreTimerID = window.setInterval(() => {
      if (this.emulator && this.isPlaying) {
        this.emulator.timerCallback((Date.now() - this.startTime) >>> 0);
      }
    }, 8);
  }

  pause(): void {
    if (this.emulator) {
      this.isPlaying = false;
      this.emulator.pause();
    }
  }

  resume(): void {
    if (this.emulator) {
      this.isPlaying = true;
      this.emulator.play();
    }
  }

  setButton(btn: InputButton, pressed: boolean): void {
    if (!this.emulator) return;

    // Map button names to GBA key indices
    const buttonMap: Record<string, number> = {
      'A': 0,
      'B': 1,
      'SELECT': 2,
      'START': 3,
      'DPAD_RIGHT': 4,
      'DPAD_LEFT': 5,
      'DPAD_UP': 6,
      'DPAD_DOWN': 7,
      'R': 8,
      'L': 9,
    };

    const keyIndex = buttonMap[btn];
    if (keyIndex !== undefined) {
      if (pressed) {
        this.emulator.keyDown(keyIndex);
      } else {
        this.emulator.keyUp(keyIndex);
      }
    }
  }

  setSpeed(multiplier: number): void {
    if (this.emulator) {
      this.emulator.setSpeed(multiplier);
    }
  }

  destroy(): void {
    if (this.coreTimerID !== null) {
      clearInterval(this.coreTimerID);
      this.coreTimerID = null;
    }
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.isInitialized = false;
    this.isPlaying = false;
  }

  getGameTitle(): string | null {
    // IodineGBA doesn't expose a direct getGameTitle method like melonDS
    // Return a generic title for now
    return null;
  }
}
