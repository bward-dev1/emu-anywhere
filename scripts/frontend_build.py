#!/usr/bin/python3
'''
This script should be used to build the .wasm file and replace the necessary
.js and .d.ts files in ds-anywhere-fe

No arguments are taken.
'''
import os
import shutil
import sys
import time

import scripts.common.output as output
import scripts.common.procutil as procutil

def frontend_build():
  '''
  Installs external dependencies, copies internal dependencies
  and builds the frontend
  '''

  start_time = time.time()

  webmelon_root = os.getcwd() + '/webmelon-sdk/'
  frontend_root = os.getcwd() + '/frontend/'

  if not os.path.exists(webmelon_root) or not os.path.exists(frontend_root):
    output.error('Please run this in the root directory of DS Anywhere!')
    return False
  
  # Copy webmelon.d.ts from webmelon to frontend
  if not os.path.exists(frontend_root + 'src/'):
    output.error('no source directory at frontend? this shouldn\'t happen.')
    return False
  if not os.path.exists(webmelon_root + 'webmelon.d.ts'):
    output.error('typescript definition file missing at webmelon-sdk/webmelon.d.ts!')
    return False
  shutil.copy(webmelon_root + 'webmelon.d.ts', frontend_root + 'src/webmelon.d.ts')
  shutil.copy(webmelon_root + 'webmelon.js', frontend_root + 'public/static/webmelon.js')

  if '--install-deps' in sys.argv or '--github-action-runner' in sys.argv:
    output.info('Prepared directory, installing dependencies (this may take a minute)...')
    return_code = procutil.execute_command([
      'npm', 'install'
    ], cwd=frontend_root)

    if return_code != 0:
      output.error(f'dependency install returned with error {return_code}, aborting')
      return False
  else:
    output.info('Skipping dependency installs, to install dependencies type --install-deps')
  output.info('Building frontend...')
  
  return_code = procutil.execute_command([
    'npm', 'run', 'build'
  ], cwd=frontend_root)

  if return_code != 0:
    output.error(f'build returned with fatal error {return_code}')
    return False
  
  end_time = time.time()
  time_elapsed = round(end_time - start_time, 2)
  output.info(f'Successfully built in {time_elapsed}s!')
  return True


if __name__ == '__main__':
  frontend_build()
