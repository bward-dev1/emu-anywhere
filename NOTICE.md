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

MIT and BSD-3-Clause are both GPLv3-compatible, so the combined distribution
under GPLv3 is valid. Each component retains its own copyright notice.

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
2. **No Nintendo BIOS ships.** The GBA core boots via high-level emulation
   (`SKIPBoot`), and the DS core uses the BSD-licensed clean-room FreeBIOS. A
   user may optionally supply their own legally-dumped BIOS.
3. **Emulators are legal.** *Sony Computer Entertainment v. Connectix* (9th Cir.
   2000) and *Sega v. Accolade* (9th Cir. 1992) establish that writing an
   emulator is lawful. What is unlawful is distributing copyrighted ROMs and
   firmware — which this project does not do.
4. `.gitignore` blocks `*.gba`, `*.nds`, and BIOS blobs from ever being committed.
