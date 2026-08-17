'''
This tool helps run the scripts in the ./scripts folder
'''
import sys

from scripts import REGISTERED_SCRIPTS

def print_help():
  print('usage: buildtools <command> [arguments...]')
  print('')
  print('valid commands:')
  for script in REGISTERED_SCRIPTS:
    print(f'  {script.command}\t\t{script.description}')

def runtool_main():
  if len(sys.argv) <= 1:
    print_help()
    return
  command = sys.argv[1]
  for script in REGISTERED_SCRIPTS:
    if script.command != command and command not in script.aliases:
      continue
    if not script.execution_func():
      sys.exit(1)

if __name__ == '__main__':
  runtool_main()
