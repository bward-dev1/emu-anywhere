import os
import shutil
import sys
import time

import scripts.common.output as output
import scripts.wasm_build
import scripts.frontend_build


def full_build():
  '''Performs a complete build from scratch'''
  start_time = time.time()

  builds = [
    scripts.wasm_build.wasm_build_cmake,
    scripts.wasm_build.wasm_build,
    scripts.frontend_build.frontend_build
  ]

  for build in builds:
    if not build():
      output.error('Build step encountered fatal exception, aborting...')
      return False
  
  end_time = time.time()
  time_elapsed = round(end_time - start_time, 2)

  output.info(f'Successfully performed full build in {time_elapsed}s')
  return True


if __name__ == '__main__':
  full_build()
