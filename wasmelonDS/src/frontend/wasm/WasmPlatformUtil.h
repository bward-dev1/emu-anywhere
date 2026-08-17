#ifndef WASMPLATFORMUTIL_H
#define WASMPLATFORMUTIL_H

#include "Platform.h"

namespace wasmelon {
  std::string get_file_mode_str(melonDS::Platform::FileMode mode, bool exists);
  bool does_file_exist(const std::string &path);
}

#endif