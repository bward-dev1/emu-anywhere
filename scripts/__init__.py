'''
The scripts folder is initalized as a Python module so that scripts can run functions
from another script.

Note that this is a double-edged sword: you may avoid writing the same thing twice by
using another function, but your function may also break if changes occur to the function
you are relying on.

You should also write all of your scripts with a __name__ checker rather than performing
actions in the root, as your script may be imported by another script that does not intend
to run all of the functions.
'''
from typing import Callable

import scripts.actions_artifacts
import scripts.frontend_build
import scripts.full_build
import scripts.wasm_build

class RegisteredScript:
  command: str
  aliases: list[str]
  execution_func: Callable
  description: str

  def __init__(self, **kwargs):
    for k, v in kwargs.items():
      setattr(self, k, v)

REGISTERED_SCRIPTS: list[RegisteredScript] = [
  RegisteredScript(
    command='build-cmake',
    aliases=[],
    execution_func=scripts.wasm_build.wasm_build_cmake,
    description='Build the cmake build directory used by the build-wasm script'
  ),
  RegisteredScript(
    command='build-fe',
    aliases=['build-frontend'],
    execution_func=scripts.frontend_build.frontend_build,
    description='Build the frontend files'
  ),
  RegisteredScript(
    command='build-wasm',
    aliases=['build-webasm'],
    execution_func=scripts.wasm_build.wasm_build,
    description='Rebuild all wasm files and place them in the correct directory'
  ),
  RegisteredScript(
    command='full-build',
    aliases=[],
    execution_func=scripts.full_build.full_build,
    description='Perform a complete build of all components from scratch'
  ),
  RegisteredScript(
    command='artifact',
    aliases=['prepare-artifacts'],
    execution_func=scripts.actions_artifacts.prepare_artifact,
    description='Prepare all artifacts (intended for GitHub Actions only)'
  )
]
