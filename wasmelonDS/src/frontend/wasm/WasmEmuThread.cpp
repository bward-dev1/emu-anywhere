
#include "WasmEmuThread.h"
#include <chrono>

using namespace melonDS;

namespace wasmelon {

  WasmEmuThread::WasmEmuThread(WasmEmulator* emulator) {
    this->emulator = emulator;
  }

  void WasmEmuThread::nextFrame(const FrameData &data) {
    if (running) {
      Platform::Log(Platform::LogLevel::Debug, "Called nextFrame while running = true");
    }
    running = true;

    emulator->nds->SetKeyMask(~data.buttonInput & 0xfff);
    emulator->nds->SetLidClosed(data.lidClosed);

    if (data.isTouching) {
      emulator->nds->TouchScreen(data.touchX, data.touchY);
    } else {
      emulator->nds->ReleaseScreen();
    }
    
    // TODO: mic data

    if (data.ghostFrame) {
      emulator->nds->RunGhostFrame();
    } else {
      emulator->nds->RunFrame();
    }

    // TODO: we will need to change this to not assume SoftRenderer if we add OpenGL support
    /*auto& renderer = static_cast<SoftRenderer&>(emulator->nds->GetRenderer3D());
    renderer.StopRenderThread();*/

    // Copy video thread to top and bottom
    if (!data.ghostFrame) {
      auto& emuGPU = emulator->nds->GPU;
      memcpy(
        emulator->videoBufferTop,
        emuGPU.Framebuffer[emuGPU.FrontBuffer][0].get(),
        256 * 192 * 4
      );
      memcpy(
        emulator->videoBufferBtm,
        emuGPU.Framebuffer[emuGPU.FrontBuffer][1].get(),
        256 * 192 * 4
      );
    }

    // Convert colors from ABGR to ARGB for top and bottom video buffers
    for (size_t i = 0; i < 256 * 192; ++i) {
      emulator->videoBufferTop[i] = (
        (emulator->videoBufferTop[i] & 0xff00ff00) | 
        ((emulator->videoBufferTop[i] & 0x000000ff) << 16) |
        ((emulator->videoBufferTop[i] & 0x00ff0000) >> 16)
      );

      emulator->videoBufferBtm[i] = (
        (emulator->videoBufferBtm[i] & 0xff00ff00) | 
        ((emulator->videoBufferBtm[i] & 0x000000ff) << 16) |
        ((emulator->videoBufferBtm[i] & 0x00ff0000) >> 16)
      );
    }

    // Read audio output into emulator buffer
    int targetOutputSize = emulator->nds->SPU.GetOutputSize() * 2;
    emulator->audioSamples = emulator->nds->SPU.ReadOutput(emulator->audioBuffer, targetOutputSize);
    // If we have no samples, we need to zero out the audio.
    if (emulator->audioSamples == 0) {
      memset(emulator->audioBuffer, 0, 547);
      emulator->audioSamples = 547;
    }

    // This calls the JavaScript framework to execute the logic that renders it on the page.
    emulator->updateWebFrame();

    running = false;
  }

}
