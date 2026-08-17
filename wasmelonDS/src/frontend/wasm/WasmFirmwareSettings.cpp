#include <codecvt> // If this causes issues, it's likely because it's getting removed in C++26
#include <locale>

#include <emscripten/emscripten.h>
#include <emscripten/bind.h>

#include "WasmFirmwareSettings.h"

namespace wasmelon {
  WasmFirmwareSettings::WasmFirmwareSettings() {
    memset(nickname, 0, sizeof(char16_t) * 10);
    memcpy(nickname, u"Player", 6);
    nicknameLength = 6;
  }

  void WasmFirmwareSettings::setNickname(std::string nickname) {
    std::wstring_convert<std::codecvt_utf8_utf16<char16_t>, char16_t> converter;
    std::u16string utf16Nickname = converter.from_bytes(nickname);
    if (utf16Nickname.size() > 10) {
      return;
    }
    memcpy(this->nickname, utf16Nickname.c_str(), sizeof(char16_t) * utf16Nickname.size());
    nicknameLength = utf16Nickname.size();
  }

  void WasmFirmwareSettings::setLanguage(melonDS::u8 language) {
    if (language >= 8) {
      return;
    }
    this->language = language;
  }

  void WasmFirmwareSettings::setBirthday(melonDS::u8 month, melonDS::u8 day) {
    // Just going to assume month and day are valid here and that no one does
    // anything super fucking stupid.
    birthdayMonth = month;
    birthdayDay = day;
  }

  void WasmFirmwareSettings::setFirmwareFile(std::string firmwareFilename) {
    firmwareFile = firmwareFilename;
  }

  melonDS::Firmware WasmFirmwareSettings::toFirmware() {
    melonDS::Firmware firmware(0);
    if (firmwareFile.length() != 0) {
      melonDS::Platform::FileHandle* fileHandle = melonDS::Platform::OpenFile(firmwareFile, melonDS::Platform::Read);
      if (!fileHandle) {
        melonDS::Platform::Log(melonDS::Platform::LogLevel::Error, "Failed to load firmware: could not open file %s", firmwareFile.c_str());
      }
      firmware = melonDS::Firmware(fileHandle);
      melonDS::Platform::CloseFile(fileHandle);
    }
    for (auto &user_data: firmware.GetUserData()) {
      user_data.BirthdayDay = birthdayDay;
      user_data.BirthdayMonth = birthdayMonth;
      memcpy(user_data.Nickname, nickname, sizeof(char16_t) * nicknameLength);
      user_data.NameLength = nicknameLength;
      user_data.Settings &= ~melonDS::Firmware::Language::Reserved;
      user_data.Settings |= language;
    }
    firmware.UpdateChecksums();
    return firmware;
  }
}

EMSCRIPTEN_BINDINGS(WasmFirmwareSettings) {
  emscripten::class_<wasmelon::WasmFirmwareSettings>("WasmFirmwareSettings")
    .constructor()
    .function("setNickname", &wasmelon::WasmFirmwareSettings::setNickname)
    .function("setLanguage", &wasmelon::WasmFirmwareSettings::setLanguage)
    .function("setBirthday", &wasmelon::WasmFirmwareSettings::setBirthday)
    .function("setFirmwareFile", &wasmelon::WasmFirmwareSettings::setFirmwareFile)
    ;
}