import os
import shutil
import sys
import time

from scripts.common.constants import CMAKE_BUILD_COMMAND
import scripts.common.output as output
import scripts.common.procutil as procutil

def prepare_artifact():
  '''For GitHub actions, this builds the artifacts published by the action runner'''

  artifact_root = os.getcwd() + '/action-runner/artifacts/'
  webmelon_root = os.getcwd() + '/webmelon-sdk/'
  frontend_root = os.getcwd() + '/frontend/dist'
  artifact_webmelon_root = os.getcwd() +  '/action-runner/artifacts/webmelon-sdk/'
  artifact_frontend_root = os.getcwd() + '/action-runner/artifacts/frontend/'

  if not os.path.exists(webmelon_root) or not os.path.exists(frontend_root):
    output.error('Looks like there doesn\'t appear to be a build to prepare artifacts for. Are you sure you have built yet?')
    return False

  if os.path.exists(artifact_root):
    output.warn('Deleting old artifact root...')
    shutil.rmtree(artifact_root)
  
  os.makedirs(artifact_root)
  os.makedirs(artifact_frontend_root)
  os.makedirs(artifact_webmelon_root)

  shutil.copytree(webmelon_root, artifact_webmelon_root, dirs_exist_ok=True)
  shutil.copytree(frontend_root, artifact_frontend_root, dirs_exist_ok=True)

  output.info('Artifacts prepared successfully!')
  return True

if __name__ == '__main__':
  prepare_artifact()
