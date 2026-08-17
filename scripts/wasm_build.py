import os
import shutil
import sys
import time

from scripts.common.constants import CMAKE_BUILD_COMMAND
import scripts.common.output as output
import scripts.common.procutil as procutil

def wasm_build_cmake():
  '''Runs emcmake to initialize the build directory'''

  wasmelon_root = os.getcwd() + '/wasmelonDS'
  build_root = wasmelon_root + '/build'

  if not os.path.exists(wasmelon_root):
    output.error('Please run this in the root directory of DS Anywhere!')
    return False

  if os.path.exists(build_root) and '--overwrite' not in sys.argv:
    if '--overwrite' not in sys.argv:
      output.error('The cmake build directory already exists, are you sure you want to do this?')
      output.warn('If you would like to overwrite, run this command again with the --overwrite flag')
      return False
    else:
      output.warn('Overwriting existing build root...')
      shutil.rmtree(build_root)
  
  return_code = procutil.execute_command(CMAKE_BUILD_COMMAND.split(), cwd=wasmelon_root)
  if return_code != 0:
    output.error('Failed to run cmake!')
    return False
  return True

def wasm_build():
  '''Builds the .wasm files in wasmelonDS'''

  start_time = time.time()

  wasmelon_root = os.getcwd() + '/wasmelonDS'
  build_root = wasmelon_root + '/build'

  if not os.path.exists(wasmelon_root):
    output.error('Please run this in the root directory of DS Anywhere!')
    return False

  if not os.path.exists(build_root):
    output.error('Build directories do not appear to exist, did you use emcmake yet?')
    return False
  
  return_code = procutil.execute_command([
    'emmake',
    'make',
    'wasmemulator'
  ], cwd=build_root)

  if return_code != 0:
    output.error(f'emmake returned with error {return_code}, aborting')
    return False
  
  emulator_wasm_path = build_root + '/wasmemulator.wasm'
  emulator_emjs_path = build_root + '/wasmemulator.js'

  if not os.path.exists(emulator_emjs_path) or not os.path.exists(emulator_wasm_path):
    output.error('Emulator WASM files not detected after build, something likely went wrong.')
    return False
  
  copy_destinations = [
    os.getcwd() + '/webmelon-sdk/',
    os.getcwd() + '/frontend/public/static/'
  ]

  for dest_dir in copy_destinations:
    if not os.path.exists(dest_dir):
      output.warn(f'Could not copy output to {dest_dir} because it does not exist, skipping...')
      continue
    shutil.copy(emulator_wasm_path, dest_dir + 'wasmemulator.wasm')
    shutil.copy(emulator_emjs_path, dest_dir + 'wasmemulator.js')
  
  end_time = time.time()
  time_elapsed = round(end_time - start_time, 2)
  output.info(f'Successfully built in {time_elapsed}s!')
  return True


if __name__ == '__main__':
  wasm_build()
