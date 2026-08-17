
#include "WasmPlatformUtil.h"

using melonDS::Platform::FileMode;

// Helper functions from qt_sdl's Platform.cpp
constexpr char AccessMode(FileMode mode, bool file_exists) {
  if (mode & FileMode::Append)
    return  'a';

  if (!(mode & FileMode::Write))
    // If we're only opening the file for reading...
    return 'r';

  if (mode & (FileMode::NoCreate))
    // If we're not allowed to create a new file...
    return 'r'; // Open in "r+" mode (IsExtended will add the "+")

  if ((mode & FileMode::Preserve) && file_exists)
    // If we're not allowed to overwrite a file that already exists...
    return 'r'; // Open in "r+" mode (IsExtended will add the "+")

  return 'w';
}

constexpr bool IsExtended(FileMode mode) {
  // fopen's "+" flag always opens the file for read/write
  return (mode & FileMode::ReadWrite) == FileMode::ReadWrite;
}

static std::string GetModeString(FileMode mode, bool file_exists) {
  std::string modeString;

  modeString += AccessMode(mode, file_exists);

  if (IsExtended(mode))
    modeString += '+';

  if (!(mode & FileMode::Text))
    modeString += 'b';

  return modeString;
}

// wasmelon utility functions

std::string wasmelon::get_file_mode_str(FileMode mode, bool exists) {
  return GetModeString(mode, exists);
}

bool wasmelon::does_file_exist(const std::string &path) {
  if (FILE *f = fopen(path.c_str(), "r")) {
    fclose(f);
    return true;
  }
  return false;
}