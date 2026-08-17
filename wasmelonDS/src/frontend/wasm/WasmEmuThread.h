#ifndef WASMEMUTHREAD_H
#define WASMEMUTHREAD_H

#include "Platform.h"
#include "NDS.h"
#include "WasmEmulator.h"

namespace wasmelon {

  struct FrameData {
    melonDS::u32 buttonInput;

    bool lidClosed;

    bool isTouching;
    melonDS::u16 touchX;
    melonDS::u16 touchY;

    bool ghostFrame;

    // TODO: add mic data here.
  };

  class WasmEmulator;
  class WasmEmuThread {
  private:
    WasmEmulator* emulator;

  public:
    bool running = false;
    WasmEmuThread(WasmEmulator* emulator);

    /**
     * Executes the next frame
     * 
     * The main purpose of this class is so that if we decide we want to
     * implement multithreaded render support, we can do it without too
     * much refactoring.
     */
    void nextFrame(const FrameData &data);

  };
}

#endif