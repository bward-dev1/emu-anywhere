'''
This file contains a lot of various utilities for color to be used for
DS-Anywhere scripts in terminal output. Since I don't feel like requiring
everyone to download Python modules to use these scripts, I'm making it all
myself here.
'''
import os

# For reference see:
# https://en.wikipedia.org/wiki/ANSI_escape_code#Select_Graphic_Rendition_parameters

def hex_to_rgb(hex_code):
  '''Returns a (r, g, b) tuple'''
  if type(hex_code) == str:
    hex_code = hex_code.replace('#', '')
    hex_code = int(hex_code, 16)
  # hex 0xaabbcc should (obviously) be interpreted as RGB (aa, bb, cc)
  r = (hex_code >> 16) & 0xff
  g = (hex_code >> 8) & 0xff
  b = (hex_code) & 0xff
  return (r, g, b)

def get_foreground_color(hex_code):
  '''Returns a str that can be used in stdout to set the color of text'''
  r, g, b = hex_to_rgb(hex_code)
  return f'\033[38;2;{r};{g};{b}m'

def get_background_color(hex_code):
  '''Returns a str that can be used in stdout to set the background color of text'''
  r, g, b = hex_to_rgb(hex_code)
  return f'\033[48;2;{r};{g};{b}m'

RESET = '\033[0m'
BOLD = '\033[1m'
ITALIC = '\033[3m'
UNDERLINE = '\033[4m'

# These use the ANSI colors that respect the user's current theme

ANSI_BLACK = '\033[30m'
ANSI_RED = '\033[31m'
ANSI_GREEN = '\033[32m'
ANSI_YELLOW = '\033[33m'
ANSI_BLUE = '\033[34m'
ANSI_PURPLE = '\033[35m'
ANSI_CYAN = '\033[36m'
ANSI_WHITE = '\033[37m'

ANSI_BG_BLACK = '\033[100m'
ANSI_BG_RED = '\033[101m'
ANSI_BG_GREEN = '\033[102m'
ANSI_BG_YELLOW = '\033[103m'
ANSI_BG_BLUE = '\033[104m'
ANSI_BG_PURPLE = '\033[105m'
ANSI_BG_CYAN = '\033[106m'
ANSI_BG_WHITE = '\033[107m'

# These are RGB colors that do not use the ANSI theme that I'm choosing for DS Anywhere
RGB_INFO = get_background_color('7d9fe8') + BOLD
RGB_WARN = get_background_color('fDed02') + BOLD
RGB_ERROR = get_background_color('ff6767') + BOLD

ANSI_INFO = ANSI_BG_BLUE +  BOLD
ANSI_WARN = ANSI_BG_YELLOW + BOLD
ANSI_ERROR = ANSI_BG_RED + BOLD 

def use_rgb_term_color(rgb, ansi):
  '''Uses an RGB term color if possible, otherwise uses ANSI'''
  if type(rgb) == str and not rgb.startswith('\033'):
    rgb = get_foreground_color(rgb)
  return rgb if os.getenv('COLORTERM', 'none') == 'truecolor' else ansi

INFO = use_rgb_term_color(RGB_INFO, ANSI_INFO)
WARN = use_rgb_term_color(RGB_WARN, ANSI_WARN)
ERROR = use_rgb_term_color(RGB_ERROR, ANSI_ERROR)
