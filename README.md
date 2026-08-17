# Unified Web Emulator

Game Boy Advance **and** Nintendo DS, emulated entirely inside a web browser —
including full support for iPhone and iPad, where it installs to the Home Screen
and runs fullscreen like a native app.

This is a merge of two projects:

- **[ds-anywhere](https://github.com/brxxn/ds-anywhere)** — melonDS compiled to
  WebAssembly via Emscripten, with a Preact/Vite frontend. Provides the DS core.
- **[gba.js.org](https://github.com/ayvacs/gba.js.org)** — a web frontend around
  the IodineGBA JavaScript core. Provides the GBA core.

## How it works

Drop in a `.gba` or `.nds` file and the app detects which system it is and boots
the matching core. Your files are read in the browser and **never leave your
device** — there is no upload, and no server ever sees them.

| | Game Boy Advance | Nintendo DS |
|---|---|---|
| Core | IodineGBA (JavaScript) | melonDS (C++ → WebAssembly) |
| Boot | open-source replacement BIOS (GPLv2) | DraStic FreeBIOS (clean-room) |
| Display | 240×160, nearest-neighbour upscale | dual screen |
| Saves | in-browser (IndexedDB) | in-browser (IndexedDB) |

## iOS support

The DS core already ran on desktop; iOS needed real work, because mobile Safari
behaves differently in several ways that break naive emulator frontends:

- **On-screen gamepad** — multitouch, built on Pointer Events rather than click
  handlers, so you can hold a direction and press a button at once. The D-pad
  supports sliding your thumb between directions without lifting.
- **Audio unlock** — iOS starts `AudioContext` suspended and only lets you
  resume it inside a real user gesture, so sound is armed on first touch.
- **Safe-area layout** — controls respect the notch, the Dynamic Island, and the
  home indicator via `env(safe-area-inset-*)`.
- **No zoom** — double-tap and pinch zoom are suppressed on the play surface, and
  form fields are ≥16px so Safari does not force-zoom on focus.
- **Wake Lock** — the screen will not sleep mid-game where supported.
- **PWA install** — Add to Home Screen gives a fullscreen, offline-capable app.
  The WebAssembly is precached, so it runs with no network at all.

## Legality

This project ships **no ROMs and no copyrighted BIOS files**, and it never will.

Writing an emulator is lawful — see *Sony Computer Entertainment v. Connectix*
(9th Cir. 2000) and *Sega v. Accolade* (9th Cir. 1992). What is unlawful is
distributing copyrighted ROMs and firmware. So:

- Games come from **you**, at runtime, from your own device.
- The GBA core uses the **open-source GBA BIOS replacement** from
  [ez-me/gba-bios](https://github.com/ez-me/gba-bios) (GPLv2, VBA-M / Normmatt
  lineage) — hand-written ARM assembly and C, not a dump of Nintendo's BIOS.
  IodineGBA has no high-level-emulation path, so a BIOS image is mandatory; the
  only question is whose, and this one is free software with public source.
- The DS core uses **FreeBIOS**, a BSD-licensed clean-room reimplementation
  written from public documentation and explicitly not derived from Nintendo's
  BIOS.
- `.gitignore` blocks ROMs, saves, and BIOS blobs from ever being committed.

The upstream `gba.js.org` repository shipped 104 commercial ROMs and Nintendo's
GBA BIOS, and was structured as a catalog of them rather than as an emulator you
supply files to. All of it was removed, the ROM-catalog loading path was replaced
with user-supplied file loading, and this repository was created with **fresh git
history** so that none of it survives in past commits.

Full details, component licensing, and a file-by-file record of what was removed:
see [`NOTICE.md`](NOTICE.md) and [`docs/REMOVED_MANIFEST.txt`](docs/REMOVED_MANIFEST.txt).

## License

**GPLv3** — see [`LICENSE`](LICENSE). The project incorporates melonDS (GPLv3),
IodineGBA and XAudioJS (MIT, © Grant Galitz), DraStic FreeBIOS (BSD-3-Clause,
© Gilead Kutnick), and the ez-me/gba-bios GBA BIOS replacement (GPLv2, shipped as
a standalone data file rather than linked). MIT and BSD-3-Clause are
GPL-compatible; every component keeps its own copyright notice. See
[`NOTICE.md`](NOTICE.md).

Not affiliated with, authorised by, or endorsed by Nintendo. Game Boy Advance and
Nintendo DS are trademarks of Nintendo Co., Ltd.
