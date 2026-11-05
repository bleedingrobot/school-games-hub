import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { voiceSlug } from '../../speech';
import { HALE_LINES, spoken } from './tutorial';

// Hale's voice (1 of the game's 8 tests). The list scripts/voice-clips.py records. After changing a line, rewrite it with
//   WRITE_VOICE_LINES=1 npx vitest run src/games/decree/voice.test.ts
// then make the new clips with: ~/kokoro/.venv/bin/python -I scripts/voice-clips.py decree
const folder = join(process.cwd(), 'public/voice/decree');
const lines = HALE_LINES.map(spoken).map((text) => ({ slug: voiceSlug(text), text }));

it("has Hale's lines listed, each with its own recorded clip and no spare ones", () => {
  if (process.env.WRITE_VOICE_LINES) writeFileSync(join(folder, 'lines.json'), `${JSON.stringify(lines, null, 1)}\n`);
  expect(new Set(lines.map((l) => l.slug)).size).toBe(lines.length);
  expect(lines.some((l) => /[▲▼+]/.test(l.text))).toBe(false);
  expect(JSON.parse(readFileSync(join(folder, 'lines.json'), 'utf8'))).toEqual(lines);
  expect(lines.filter((l) => !existsSync(join(folder, `${l.slug}.mp3`))).map((l) => l.slug)).toEqual([]);
  const wanted = new Set(lines.map((l) => `${l.slug}.mp3`));
  expect(readdirSync(folder).filter((f) => f.endsWith('.mp3') && !wanted.has(f))).toEqual([]);
});
