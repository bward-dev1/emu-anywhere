
#include <memory>
#include <ctime>
#include <locale>
#include <codecvt>

#include "WasmEmulator.h"
#include "GPU.h"

using namespace melonDS;

namespace wasmelon {

  WasmEmulator::WasmEmulator() {
    nds = new NDS({}, this);
    emuThread = new WasmEmuThread(this);
  }

  WasmEmulator::~WasmEmulator() {
    delete nds;
  }

  void WasmEmulator::setBatteryLevels() {
    // TODO: if support is added for DSi, we will need to set proper parameters
    nds->SPI.GetPowerMan()->SetBatteryLevelOkay(true);
  }

  void WasmEmulator::setDateTime() {
    auto currentTime = std::time(0);
    auto localTime = std::localtime(&currentTime);
    nds->RTC.SetDateTime(
      localTime->tm_year,
      localTime->tm_mon + 1,
      localTime->tm_mday,
      localTime->tm_hour,
      localTime->tm_min,
      localTime->tm_sec
    );
  }

  Firmware WasmEmulator::genFirmware() {
    return firmwareSettings.toFirmware();
  }  

  void WasmEmulator::initialize(bool direct) {
    nds->Reset();
    if (direct) {
      nds->SetupDirectBoot("game");
    }
    nds->Start();
  }

  void WasmEmulator::processFrame(bool ghostFrame) {
    FrameData frameData {
      buttonInput,
      lidClosed,
      isTouching,
      touchX,
      touchY,
      ghostFrame
    };
    setDateTime();
    emuThread->nextFrame(frameData);
  }

  void WasmEmulator::loadFreeBIOS() {
    nds->SetARM7BIOS(bios_arm7_bin);
    nds->SetARM9BIOS(bios_arm9_bin);
    nds->SetFirmware(genFirmware());
    setBatteryLevels();
    setDateTime();
  }

  void WasmEmulator::loadUserBIOS() {
    ARM7BIOSImage arm7_bios;
    ARM9BIOSImage arm9_bios;
    Platform::FileHandle* arm7_fh = Platform::OpenFile("/firmware/bios7.bin", Platform::Read);
    Platform::FileHandle* arm9_fh = Platform::OpenFile("/firmware/bios9.bin", Platform::Read);
    if (!arm7_fh || Platform::FileLength(arm7_fh) != 0x4000) {
      return;
    }
    if (!arm9_fh || Platform::FileLength(arm9_fh) != 0x1000) {
      return;
    }
    Platform::FileRead(arm7_bios.data(), arm7_bios.size(), 1, arm7_fh);
    Platform::FileRead(arm9_bios.data(), arm9_bios.size(), 1, arm9_fh);
    Platform::CloseFile(arm7_fh);
    Platform::CloseFile(arm9_fh);
    nds->SetARM7BIOS(arm7_bios);
    nds->SetARM9BIOS(arm9_bios);
    nds->SetFirmware(genFirmware());
    nds->LoadGBAAddon(GBAAddon_RumblePak);
    setBatteryLevels();
    setDateTime();
  }

  void WasmEmulator::setFirmwareSettings(WasmFirmwareSettings settings) {
    firmwareSettings = settings;
  }

  bool WasmEmulator::loadRom(WasmNdsCart &cart, bool reset) {
    std::unique_ptr<u8[]> saveData = nullptr;
    u32 saveLen = 0;

    std::unique_ptr<melonDS::NDSCart::CartCommon> cart_ptr = cart.getCart();
    if (!cart_ptr) {
      Platform::Log(Platform::LogLevel::Info, "Attempted to use uninitialized NDSCart in WasmEmulator::loadRom");
      return false;
    }

    cart_ptr->SetUserData(this);
    nds->SetNDSCart(std::move(cart_ptr));

    // The only GBA cart currently supported is Rumble Pak, but this will need to be customizable
    // in the future.
    nds->LoadGBAAddon(GBAAddon_RumblePak);

    if (Platform::FileExists(savePath)) {
      Platform::FileHandle* fileHandle = Platform::OpenFile(savePath, Platform::FileMode::Read);

      Platform::Log(Platform::LogLevel::Debug, "Loading save file at %s\n", savePath.c_str());
      melonDS::u64 dataSize = Platform::FileLength(fileHandle);
      saveData = std::make_unique<u8[]>(dataSize);

      Platform::FileRead(saveData.get(), dataSize, 1, fileHandle);

      nds->SetNDSSave(saveData.get(), static_cast<melonDS::u32>(dataSize));
      Platform::Log(Platform::LogLevel::Debug, "Successfully loaded save file!\n");
    }

    return true;
  }

  void WasmEmulator::setSavePath(std::string savePath) {
    this->savePath = savePath;
  }

  uintptr_t WasmEmulator::getTopScreenFrameBuffer() {
    return reinterpret_cast<uintptr_t>(&videoBufferTop);
  }

  uintptr_t WasmEmulator::getBottomScreenFrameBuffer() {
    return reinterpret_cast<uintptr_t>(&videoBufferBtm);
  }

  uintptr_t WasmEmulator::getAudioBuffer() {
    return reinterpret_cast<uintptr_t>(this->audioBuffer);
  }
  
  int WasmEmulator::getAudioSamples() {
    return audioSamples;
  }

  void WasmEmulator::touchScreen(int x, int y) {
    touchX = x;
    touchY = y;
    isTouching = true;
  }

  void WasmEmulator::releaseScreen() {
    isTouching = false;
  }

  void WasmEmulator::writeSave(const u8* savedata, u32 savelen) {
    Platform::Log(Platform::LogLevel::Debug, "Writing save...\n");
    Platform::Log(Platform::LogLevel::Debug, "Save path: %s\n", savePath.c_str());
    Platform::FileHandle* fileHandle = Platform::OpenFile(savePath, Platform::FileMode::Write);

    Platform::FileWrite(savedata, savelen, 1, fileHandle);
    EM_ASM(
      window.WebMelon._internal.events.onSaveWrite();
    );
  }

  void WasmEmulator::startRumble() {
    EM_ASM(window.WebMelon._internal.events.onRumbleStart());
  }

  void WasmEmulator::stopRumble() {
    EM_ASM(window.WebMelon._internal.events.onRumbleStop());
  }

  void WasmEmulator::handleShutdown() {
    EM_ASM(window.WebMelon._internal.events.onShutdown());
  }

  void WasmEmulator::updateWebFrame() {
    EM_ASM(
      window.WebMelon._internal.events.onEmulatorFrameUpdate();
    );
  }

  void WasmEmulator::setInput(melonDS::u32 input) {
    buttonInput = input;
  }
  
  std::string WasmEmulator::getCartTitle() {
    auto cart = nds->NDSCartSlot.GetCart();
    if (cart == nullptr) {
      return "__ERROR__";
    }

    auto banner = cart->Banner();
    if (banner == nullptr) {
      return "__ERROR__";
    }
    
    // TODO: localization support to include title in user's locale

    std::wstring_convert<std::codecvt_utf8_utf16<char16_t>, char16_t> converter;
    std::u16string englishUtf16Title(
      banner->EnglishTitle,
      std::char_traits<char16_t>::length(banner->EnglishTitle)
    );
    
    return converter.to_bytes(englishUtf16Title);
  }

}


EMSCRIPTEN_BINDINGS(WasmEmulator) {
  emscripten::class_<wasmelon::WasmEmulator>("WasmEmulator")
    .constructor()
    .function("initialize", &wasmelon::WasmEmulator::initialize)
    .function("loadFreeBIOS", &wasmelon::WasmEmulator::loadFreeBIOS)
    .function("loadUserBIOS", &wasmelon::WasmEmulator::loadUserBIOS)
    .function("setFirmwareSettings", &wasmelon::WasmEmulator::setFirmwareSettings)
    .function("loadRom", &wasmelon::WasmEmulator::loadRom)
    .function("setSavePath", &wasmelon::WasmEmulator::setSavePath)
    .function("processFrame", &wasmelon::WasmEmulator::processFrame)
    .function("getTopScreen", &wasmelon::WasmEmulator::getTopScreenFrameBuffer, emscripten::allow_raw_pointers())
    .function("getBottomScreen", &wasmelon::WasmEmulator::getBottomScreenFrameBuffer, emscripten::allow_raw_pointers())
    .function("getAudioBuffer", &wasmelon::WasmEmulator::getAudioBuffer, emscripten::allow_raw_pointers())
    .function("getAudioSamples", &wasmelon::WasmEmulator::getAudioSamples)
    .function("touchScreen", &wasmelon::WasmEmulator::touchScreen)
    .function("releaseScreen", &wasmelon::WasmEmulator::releaseScreen)
    .function("setInput", &wasmelon::WasmEmulator::setInput)
    .function("getCartTitle", &wasmelon::WasmEmulator::getCartTitle)
    ;
}