const fs = require('fs');
const vm = require('vm');
const path = require('path');

const BASE = process.env.GBA_BASE;
const BIOS_PATH = process.env.BIOS_PATH;

const files = [
  'iodineGBA/core/Emulator.js',
  'iodineGBA/includes/TypedArrayShim.js',
  'iodineGBA/core/Memory.js',
  'iodineGBA/core/CPU.js',
  'iodineGBA/core/CPU/ARM.js',
  'iodineGBA/core/CPU/THUMB.js',
  'iodineGBA/core/CPU/CPSR.js',
  'iodineGBA/core/Wait.js',
  'iodineGBA/core/Timer.js',
  'iodineGBA/core/DMA.js',
  'iodineGBA/core/memory/DMA0.js','iodineGBA/core/memory/DMA1.js',
  'iodineGBA/core/memory/DMA2.js','iodineGBA/core/memory/DMA3.js',
  'iodineGBA/core/IRQ.js','iodineGBA/core/JoyPad.js','iodineGBA/core/Serial.js',
  'iodineGBA/core/Sound.js',
  'iodineGBA/core/sound/Channel1.js','iodineGBA/core/sound/Channel2.js',
  'iodineGBA/core/sound/Channel3.js','iodineGBA/core/sound/Channel4.js',
  'iodineGBA/core/sound/FIFO.js',
  'iodineGBA/core/Cartridge.js',
  'iodineGBA/core/cartridge/SaveDeterminer.js','iodineGBA/core/cartridge/SRAM.js',
  'iodineGBA/core/cartridge/FLASH.js','iodineGBA/core/cartridge/EEPROM.js',
  'iodineGBA/core/cartridge/GPIO.js',
  'iodineGBA/core/Graphics.js',
  'iodineGBA/core/graphics/Renderer.js','iodineGBA/core/graphics/RendererProxy.js',
  'iodineGBA/core/graphics/RendererShim.js','iodineGBA/core/graphics/BGMatrix.js',
  'iodineGBA/core/graphics/BGTEXT.js','iodineGBA/core/graphics/AffineBG.js',
  'iodineGBA/core/graphics/BG2FrameBuffer.js','iodineGBA/core/graphics/OBJ.js',
  'iodineGBA/core/graphics/Window.js','iodineGBA/core/graphics/OBJWindow.js',
  'iodineGBA/core/graphics/Mosaic.js','iodineGBA/core/graphics/ColorEffects.js',
  'iodineGBA/core/graphics/Compositor.js',
  'iodineGBA/core/RunLoop.js','iodineGBA/core/Saves.js',
];

const sandbox = { console, Math, Date, JSON, Uint8Array, Int8Array, Uint16Array, Int16Array,
  Uint32Array, Int32Array, Float32Array, Float64Array, ArrayBuffer, Object, Array, Error,
  TypeError, RangeError, String, Number, Boolean, Function, parseInt, parseFloat, isNaN,
  setTimeout, clearTimeout, setInterval, clearInterval };
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.global = sandbox;
sandbox.Worker = undefined;
vm.createContext(sandbox);

for (const f of files) {
  const p = path.join(BASE, f);
  try { vm.runInContext(fs.readFileSync(p, 'utf8'), sandbox, { filename: f }); }
  catch (e) { console.log('LOAD FAIL', f, e.message); process.exit(2); }
}

const bios = new Uint8Array(fs.readFileSync(BIOS_PATH));
const rom  = new Uint8Array(fs.readFileSync(process.env.ROM_PATH));
console.log('bios bytes', bios.length, 'rom bytes', rom.length);

const emu = new sandbox.GameBoyAdvanceEmulator();
emu.attachBIOS(bios);
emu.attachROM(rom);
emu.settings.SKIPBoot = true;
emu.settings.offthreadGfxEnabled = false;
emu.attachPlayStatusHandler(function () {});

let frames = 0, lastFrame = null;
emu.attachGraphicsFrameHandler({ copyBuffer: function (buf) { frames++; lastFrame = buf.slice ? buf.slice(0) : Array.from(buf); } });

emu.play();
console.log('emulatorStatus after play:', emu.emulatorStatus, '(5 = running; 0x10 bit set = paused/refused)');
if ((emu.emulatorStatus & 0x1) === 0) { console.log('CORE REFUSED TO INITIALIZE'); process.exit(3); }
let t = 0;
for (let i = 0; i < 400; i++) { t += 17; emu.timerCallback(t >>> 0); }
console.log('frames rendered:', frames);
if (!lastFrame) { console.log('NO FRAME'); process.exit(4); }

// swizzledFrame is RGB triplets, 240*160*3
const px = [];
for (let i = 0; i < 6; i++) px.push([lastFrame[i*3], lastFrame[i*3+1], lastFrame[i*3+2]]);
console.log('first 6 pixels RGB:', JSON.stringify(px));
let nonBlack = 0;
for (let i = 0; i < 240*160*3; i++) if (lastFrame[i] !== 0) nonBlack++;
console.log('non-black subpixels:', nonBlack, 'of', 240*160*3);
