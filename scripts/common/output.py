'''
This script allows us to format script output to make it prettier
and easier to read without having to update every reference.
'''
import scripts.common.colors as colors

SUBPROCESS_OUTPUT_COLORS = {
  'emcmake': ('27a5cf', colors.ANSI_CYAN),
  'emmake': ('16b844', colors.ANSI_GREEN),
  'npm': ('c40d6f', colors.ANSI_RED)
}
DEFAULT_SUBPROCESS_COLOR = (colors.get_foreground_color('9738c7'), colors.ANSI_PURPLE)
SUBPROCESS_ERROR_COLOR = (colors.get_foreground_color('a0a0a0'), colors.ANSI_WHITE)

def info(message):
  if type(message) != str:
    message = str(message)
  
  print(colors.INFO + '   INFO   ' + colors.RESET + '\t' + message)

def warn(message):
  if type(message) != str:
    message = str(message)
  
  print(colors.WARN + '   WARN   ' + colors.RESET + '\t' + message)

def error(message):
  if type(message) != str:
    message = str(message)
  
  print(colors.ERROR + '   ERROR   ' + colors.RESET + '\t' + message)

def _subprocess_print(process_name, line, color):
  tab_count = 2 if len(process_name) <= 5 else 1
  tabs = '\t' * tab_count
  print(f'{color}({process_name}){tabs}{colors.RESET}{line}')

def subprocess_stdout(process_name, line):
  process_color = colors.use_rgb_term_color(
    *SUBPROCESS_OUTPUT_COLORS.get(process_name, DEFAULT_SUBPROCESS_COLOR)
  )
  _subprocess_print(process_name, line, process_color)

def subprocess_stderr(process_name, line):
  _subprocess_print(process_name, line, colors.use_rgb_term_color(*SUBPROCESS_ERROR_COLOR))
