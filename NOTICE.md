# Third-party components and licensing

This project ("Unified Web Emulator") is a merge of two upstream projects. The
combined work is distributed under the **GNU General Public License v3.0**,
because it incorporates melonDS, which is GPLv3. See `LICENSE`.

## Components

| Component | Origin | License | Notes |
|---|---|---|---|
| `wasmelonDS/` | melonDS, via bward-dev1/ds-anywhere | GPLv3 | Nintendo DS core, compiled to WebAssembly via Emscripten |
| `webmelon-sdk/` | bward-dev1/ds-anywhere | GPLv3 | TypeScript bindings between WASM and the frontend |
| `frontend/` | bward-dev1/ds-anywhere | GPLv3 | Preact + Vite + Tailwind + daisyUI UI |
| `gba-core/iodineGBA/` | taisel/IodineGBA, © 2010–2017 Grant Galitz | MIT | Game Boy Advance core, pure JavaScript |
| `gba-core/XAudioJS/` | taisel/XAudioJS | MIT | Audio output shim for the GBA core |
| `gba-core/*GlueCode.js` | ayvacs/gba.js.org | MIT | Glue layer, **heavily modified** — see "Legal remediation" |
| `wasmelonDS/freebios/` | DraStic FreeBIOS, © 2013 Gilead Kutnick | BSD-3-Clause | Clean-room DS BIOS replacement, **not** derived from Nintendo's BIOS |
| `frontend/public/static/gba/freebios/` | ez-me/gba-bios (VBA-M / Normmatt lineage), via ReGBA | GPLv2 | Open-source GBA BIOS replacement, hand-written ARM assembly + C, **not** derived from Nintendo's BIOS. sha1 `598c0b2c6c5d15bbba218773574c9e7856d141f3`. Shipped as a standalone data file, aggregated rather than linked — see below |

MIT and BSD-3-Clause are both GPLv3-compatible, so the combined distribution
under GPLv3 is valid. Each component retains its own copyright notice.

The GBA replacement BIOS is GPLv2 (no "or later" clause), which cannot be
*combined* with GPLv3 code into a single linked work. It is not combined with
one here. It is a standalone ARM program for the emulated console, shipped as a
16 KB data file and copied into emulated memory at runtime; no emulator code
links against it and it links against no emulator code. That is aggregation on a
shared distribution medium, which both licenses permit. It lives in its own
directory with its own unmodified GPLv2 text, and its complete corresponding
source is public at https://github.com/ez-me/gba-bios.

## Legal remediation performed during the merge

The `gba.js.org` upstream was **not** distributable. It was architected as a ROM
catalog, not as an emulator you bring your own files to. The following was
removed and is not present in this repository or its git history:

- **104 commercial Game Boy Advance ROMs** (~1.1 GB) served from `binaries/`.
- **`gba_bios.bin`** — Nintendo's copyrighted Game Boy Advance BIOS.
- **15 unattributed `-DEBUG-*.gba` test ROMs**, removed because their provenance
  and licensing could not be verified.
- The hardcoded `games{}` catalog in `CoreGlueCode.js` mapping ~104 commercial
  titles to server-hosted ROM files.
- The server-side ROM/BIOS download path (`downloadFile("../binaries/...")`).
- `XAudioJS.swf` — a dead Flash fallback.

A full file-by-file record is in `docs/REMOVED_MANIFEST.txt`.

**This repository was created with fresh git history.** Deleting the ROMs from a
working tree would not have removed them from `gba.js.org`'s commit history, so
no upstream history was carried over.

## How this project stays legal

1. **No ROMs ship.** The user supplies their own game files at runtime via a file
   picker or drag-and-drop. Files are read in-browser and never uploaded.
2. **No Nintendo BIOS ships.** Both cores boot on clean-room BIOS replacements:
   the DS core uses the BSD-licensed DraStic FreeBIOS, and the GBA core uses the
   GPLv2-licensed open-source BIOS from ez-me/gba-bios. A user may optionally
   supply their own legally-dumped BIOS instead.

   Note on the GBA core specifically: IodineGBA does **not** support high-level
   emulation. Its `Memory.js loadBIOS()` refuses to initialise unless handed
   exactly 0x4000 bytes, so setting `SKIPBoot` alone leaves the core silently
   dead — a real BIOS image is mandatory, and the only question is whose. An
   earlier revision of this file claimed the GBA core booted via HLE; that was
   incorrect, and it is why GBA ROMs appeared to load and then never ran.
3. **Emulators are legal.** *Sony Computer Entertainment v. Connectix* (9th Cir.
   2000) and *Sega v. Accolade* (9th Cir. 1992) establish that writing an
   emulator is lawful. What is unlawful is distributing copyrighted ROMs and
   firmware — which this project does not do.
4. `.gitignore` blocks `*.gba`, `*.nds`, and BIOS blobs from ever being committed.
