'''
Contains various constants used by scripts
'''

CMAKE_BUILD_COMMAND = 'emcmake cmake -B build -DBUILD_QT_SDL=OFF -DENABLE_OGLRENDERER=OFF'
CMAKE_MACOS_PREFIX_PATHS = [
  'brew --prefix qt@6',
  'brew --prefix libarchive',
  'brew --prefix pkg-config'
]