#ifndef WASMEMULATOR_H
#define WASMEMULATOR_H

#include <emscripten/emscripten.h>
#include <emscripten/bind.h>

#include "Platform.h"
#include "NDS.h"
#include "WasmEmuThread.h"
#include "WasmFirmwareSettings.h"
#include "WasmNdsCart.h"

namespace wasmelon {
  class WasmEmuThread;
  class WasmEmulator {
  private:
    void setBatteryLevels();
    void setDateTime();
    WasmFirmwareSettings firmwareSettings;
    melonDS::Firmware genFirmware();
    WasmEmuThread* emuThread;
    melonDS::Platform::Thread* emuPlatformThread = nullptr;

  public:
    melonDS::NDS* nds;
    melonDS::s16 audioBuffer[4096 * 2];
    melonDS::u32 audioSamples;
    melonDS::u32 videoBufferTop[256 * 192];
    melonDS::u32 videoBufferBtm[256 * 192];
    melonDS::u32 buttonInput = 0;
    bool lidClosed = false;
    bool isTouching = false;
    melonDS::u16 touchX;
    melonDS::u16 touchY;
    std::string savePath;

    WasmEmulator();
    ~WasmEmulator();

    void initialize(bool direct = true);
    void processFrame(bool ghostFrame = false);
    void updateWebFrame();
    void loadFreeBIOS();
    void loadUserBIOS();
    void setFirmwareSettings(WasmFirmwareSettings settings);
    bool loadRom(WasmNdsCart &cart, bool reset);
    void setSavePath(std::string savePath);

    uintptr_t getTopScreenFrameBuffer();
    uintptr_t getBottomScreenFrameBuffer();
    uintptr_t getAudioBuffer();
    int getAudioSamples();

    void touchScreen(int x, int y);
    void releaseScreen();
    void writeSave(const melonDS::u8* savedata, melonDS::u32 savelen);
    void startRumble();
    void stopRumble();
    void handleShutdown();
    void setInput(melonDS::u32 input);

    std::string getCartTitle();

  };
}


#endif