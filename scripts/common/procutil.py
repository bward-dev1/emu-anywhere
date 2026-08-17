import os
import selectors
import subprocess

import scripts.common.output as output

def get_command_from_arg(arg):
  # there's probably a better way to do this
  return arg.split('/')[-1].split('\\')[-1]

def execute_command(arglist, silent=False, cwd=os.getcwd()):
  '''
  Executes the arguments given in arglist and waits for the result

  Use silent=True to execute without providing output
  '''
  if type(arglist) != list:
    raise Exception('execute_command must have a list of arguments')
  if len(arglist) == 0:
    raise Exception('Must have at least one argument in arglist')
  
  process_command = get_command_from_arg(arglist[0])
  process = subprocess.Popen(
    arglist, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    cwd=cwd
  )

  sel = selectors.DefaultSelector()
  sel.register(process.stdout, selectors.EVENT_READ)
  sel.register(process.stderr, selectors.EVENT_READ)
  
  completed = False
  while not completed:
    for key, _ in sel.select():
      line = key.fileobj.readline()
      if not line:
        completed = True
        break
      if silent:
        continue
      try:
        line = line.decode('utf-8').strip()
      except UnicodeDecodeError:
        line = str(line) + ' (failed to decode as UTF8)'
      if key.fileobj is process.stdout:
        output.subprocess_stdout(process_command, line)
      else:
        output.subprocess_stderr(process_command, line)
  
  returncode = process.poll()

  while returncode is None:
    returncode = process.poll()

  return returncode
