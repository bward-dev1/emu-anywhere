#!/usr/bin/env python3
"""Generate the tiny GBA self-test ROMs used by gba_headless_test.js.

These are hand-assembled ARM7TDMI programs written for this repository. They are
original work, not dumps of anything, and they exist so the GBA core can be
proven to actually execute and render without needing a commercial game. The
built .gba files are deliberately NOT committed -- .gitignore blocks *.gba, and
that rule stays absolute. Run this script to produce them.

  python3 scripts/selftest/make_selftest_roms.py /tmp

  red.gba  fills the screen red   -> proves the core runs ARM code and renders
  swi.gba  fills the screen GREEN if BIOS SWI 0x06 (Div) returns 100/7 == 14,
           RED if it does not     -> proves the replacement BIOS's SWI table works
"""
import struct
import sys
import pathlib

RED = [
    0xE3A00404,  # mov  r0, #0x04000000
    0xE3A01C04,  # mov  r1, #0x400
    0xE3811003,  # orr  r1, r1, #3          ; DISPCNT = mode 3 | BG2
    0xE5801000,  # str  r1, [r0]
    0xE3A00406,  # mov  r0, #0x06000000     ; VRAM
    0xE3A0101F,  # mov  r1, #0x001F         ; BGR555 red
    0xE3A02C96,  # mov  r2, #0x9600         ; 240*160 pixels
    0xE0C010B2,  # loop: strh r1, [r0], #2
    0xE2522001,  #       subs r2, r2, #1
    0x1AFFFFFC,  #       bne  loop
    0xEAFFFFFE,  # hang: b hang
]

SWI = [
    0xE3A00404,  # mov  r0, #0x04000000
    0xE3A01C04,  # mov  r1, #0x400
    0xE3811003,  # orr  r1, r1, #3          ; DISPCNT = mode 3 | BG2
    0xE5801000,  # str  r1, [r0]
    0xE3A00064,  # mov  r0, #100
    0xE3A01007,  # mov  r1, #7
    0xEF060000,  # swi  0x06                ; BIOS Div -> r0 = 100 / 7 = 14
    0xE350000E,  # cmp  r0, #14
    0x13A0401F,  # movne r4, #0x001F        ; RED   -> BIOS SWI returned wrong
    0x03A04E3E,  # moveq r4, #0x03E0        ; GREEN -> BIOS SWI returned right
    0xE3A00406,  # mov  r0, #0x06000000
    0xE3A02C96,  # mov  r2, #0x9600
    0xE0C040B2,  # loop: strh r4, [r0], #2
    0xE2522001,  #       subs r2, r2, #1
    0x1AFFFFFC,  #       bne  loop
    0xEAFFFFFE,  # hang: b hang
]


def build(words: list[int]) -> bytes:
    return b"".join(struct.pack("<I", w) for w in words).ljust(4096, b"\x00")


def main() -> None:
    out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp")
    out.mkdir(parents=True, exist_ok=True)
    for name, words in (("red", RED), ("swi", SWI)):
        path = out / f"selftest_{name}.gba"
        path.write_bytes(build(words))
        print(f"wrote {path} ({path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
