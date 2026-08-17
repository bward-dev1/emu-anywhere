#include "WasmNdsCart.h"

#include <locale>
#include <codecvt>

using namespace melonDS;

namespace wasmelon {

  WasmNdsCart::WasmNdsCart() {
    
  }

  bool WasmNdsCart::loadFromFile(std::string filename) {
    // loosely abstracted from loadROM and loadROMData in EmuInstance of the QT/SDL emulator implementation
    std::unique_ptr<u8[]> fileData;
    Platform::FileHandle* f = Platform::OpenFile(filename, Platform::FileMode::Read);

    if (!f) {
      Platform::Log(Platform::LogLevel::Error, "Failed to load ROM: could not open file %s", filename.c_str());
      return false;
    }

    long len = Platform::FileLength(f);
    if (len > 0x40000000) {
      Platform::Log(Platform::LogLevel::Error, "Failed to load ROM: exceeds file size (%s)", filename.c_str());
      Platform::CloseFile(f);
      return false;
    }
    Platform::FileRewind(f);
    fileData = std::make_unique<u8[]>(len);
    size_t nread = Platform::FileRead(fileData.get(), (size_t)len, 1, f);
    Platform::CloseFile(f);
    if (nread != 1) {
      fileData = nullptr;
      return false;
    }

    // TODO: detect and decompress .zst files

    std::unique_ptr<u8[]> saveData = nullptr;
    u32 saveLen = 0;

    // TODO: handle saves

    NDSCart::NDSCartArgs cartArgs {};
    auto cart = NDSCart::ParseROM(std::move(fileData), len, this, std::move(cartArgs));

    if (!cart) {
      Platform::Log(Platform::LogLevel::Error, "Failed to load NDS cart");
      return false;
    }

    this->cart = std::move(cart);
    Platform::Log(Platform::LogLevel::Info, "Cart loaded successfully!");
    return true;
  }

  std::string WasmNdsCart::getCommonCartTitle(melonDS::NDSCart::CartCommon *cart) {
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

  std::string WasmNdsCart::getCommonCartCode(melonDS::NDSCart::CartCommon *cart) {
    if (cart == nullptr) {
      return "__ERROR__";
    }

    std::string gameCode = std::string(cart->GetHeader().GameCode, 4);
    return gameCode;
  }

  std::string WasmNdsCart::getCartTitle() {
    if (!cart) {
      return "Empty";
    }
    return WasmNdsCart::getCommonCartTitle(cart.get());
  }

  std::string WasmNdsCart::getCartCode() {
    if (!cart) {
      return "NULL";
    }
    return WasmNdsCart::getCommonCartCode(cart.get());
  }

  std::unique_ptr<melonDS::NDSCart::CartCommon> WasmNdsCart::getCart() {
    return std::move(cart);
  }
}

EMSCRIPTEN_BINDINGS(WasmNdsCart) {
  emscripten::class_<wasmelon::WasmNdsCart>("WasmNdsCart")
    .constructor()
    .function("loadFromFile", &wasmelon::WasmNdsCart::loadFromFile)
    .function("getCartTitle", &wasmelon::WasmNdsCart::getCartTitle)
    .function("getCartCode", &wasmelon::WasmNdsCart::getCartCode)
    ;
}