#ifndef WASMFIRMWARESETTINGS_H
#define WASMFIRMWARESETTINGS_H

#include "Platform.h"
#include "NDS.h"

namespace wasmelon {

  class WasmFirmwareSettings {
  private:
    char16_t nickname[10];
    melonDS::u8 nicknameLength;
    melonDS::u8 language = melonDS::Firmware::English;
    melonDS::u8 birthdayMonth = 1;
    melonDS::u8 birthdayDay = 1;

    std::string firmwareFile = "";
    
  public:
    WasmFirmwareSettings();

    void setNickname(std::string nickname);
    void setLanguage(melonDS::u8 language);
    void setBirthday(melonDS::u8 month, melonDS::u8 day);

    void setFirmwareFile(std::string firmwareFilename);

    melonDS::Firmware toFirmware();
  };
}

#endif