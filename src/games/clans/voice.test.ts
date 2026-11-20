import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { voiceSlug } from '../../speech';
import { CEREMONY_LINES } from './SeasonCeremony';

// Bella's lines for the new-season ceremony (a voice-lines test: not counted in the test budget). After changing one:
//   WRITE_VOICE_LINES=1 npx vitest run src/games/clans/voice.test.ts
// then make the new clips with: ~/kokoro/.venv/bin/python -I scripts/voice-clips.py clans-season
const folder = join(process.cwd(), 'public/voice/clans-season');
const lines = CEREMONY_LINES.map((text) => ({ slug: voiceSlug(text), text }));

it("has the ceremony's lines listed, each with its own recorded clip and no spare ones", () => {
  if (process.env.WRITE_VOICE_LINES) writeFileSync(join(folder, 'lines.json'), `${JSON.stringify(lines, null, 1)}\n`);
  expect(new Set(lines.map((l) => l.slug)).size).toBe(lines.length);
  expect(JSON.parse(readFileSync(join(folder, 'lines.json'), 'utf8'))).toEqual(lines);
  expect(lines.filter((l) => !existsSync(join(folder, `${l.slug}.mp3`))).map((l) => l.slug)).toEqual([]);
  const wanted = new Set(lines.map((l) => `${l.slug}.mp3`));
  expect(readdirSync(folder).filter((f) => f.endsWith('.mp3') && !wanted.has(f))).toEqual([]);
});
