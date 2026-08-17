# GBA core self-test

Proves the Game Boy Advance core actually boots, executes ARM code, services a
BIOS software interrupt, and renders a frame — with no commercial ROM and no
browser. It runs IodineGBA headlessly in Node against the same `frontend/dist`
files the site serves, so a pass here is evidence about what is deployed, not
about a local dev build.

## Run it

```sh
cd frontend && npm run build && cd ..
python3 scripts/selftest/make_selftest_roms.py /tmp
GBA_BASE=frontend/dist/static/gba \
BIOS_PATH=frontend/public/static/gba/freebios/gba_freebios.bin \
ROM_PATH=/tmp/selftest_swi.gba \
node scripts/selftest/gba_headless_test.js
```

## Reading the result

- `emulatorStatus after play: 5` — the core initialised. Anything with the
  `0x10` bit set means it refused and paused, which is the failure mode a bad or
  wrong-sized BIOS produces.
- `frames rendered:` greater than 0 — the render path reached the frame handler.
- For `selftest_swi.gba`, `first 6 pixels RGB: [[0,248,0], ...]` (green) means
  BIOS `SWI 0x06` (Div) returned `100 / 7 == 14`. Red means the BIOS answered
  wrong. Games lean on BIOS SWIs constantly, so this is the check that matters
  when swapping BIOS images.
- `non-black subpixels: 38400 of 115200` — one channel lit across all
  240×160 pixels, i.e. a fully painted screen.

## Result on record

Run 2026-08-17 against `frontend/dist`, both self-test ROMs, comparing the
ez-me/gba-bios image now shipping against the Cult-of-GBA image it replaced:
**both initialised, both rendered, both returned green on the SWI test.** The
BIOS swap is therefore not what makes or breaks GBA boot in this build — useful
to know before blaming the BIOS for a black screen.

The ROMs are generated, never committed. `.gitignore` blocks `*.gba` and that
stays absolute.
