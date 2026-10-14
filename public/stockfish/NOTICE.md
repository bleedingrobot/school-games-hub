# Stockfish (the chess bots' engine)

These files are **Stockfish.js 19** (the "lite, single-threaded" build), copied unchanged
from the `stockfish` npm package, version 19.0.1:

- `stockfish-19-lite-single.js` and `stockfish-19-lite-single.wasm`

Stockfish is free software by the Stockfish developers (https://stockfishchess.org).
Stockfish.js is by Nathan Rugg and Chess.com. Both are licensed under the
**GNU General Public License, version 3** — the full text is in `Copying.txt` next to this file.

**Source code:** the exact source for these files is at
https://github.com/nmrugg/stockfish.js/tree/v19.0.1 and the Stockfish engine itself at
https://github.com/official-stockfish/Stockfish.

You may copy, change and share Stockfish under the terms of the GPL. It comes with no warranty.

School Games Hub runs Stockfish as a separate program in a Web Worker and only talks to it by
sending plain-text chess commands, so the rest of the website is not part of Stockfish.

**Updating:** after upgrading the `stockfish` package, copy the two files above (and
`Copying.txt`) again from `node_modules/stockfish/`. A test checks they match.
