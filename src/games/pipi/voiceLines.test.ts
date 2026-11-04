import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { voiceSlug } from '../../speech';
import { allVoiceLines } from './voiceLines';

// The list scripts/voice-clips.py records in Bella's voice. After changing a line, rewrite it with
//   WRITE_VOICE_LINES=1 npx vitest run src/games/pipi/voiceLines.test.ts
// then make the new clips with scripts/voice-clips.py pipi.
const folder = join(process.cwd(), 'public/voice/pipi');
const listFile = join(folder, 'lines.json');
const lines = allVoiceLines().map((text) => ({ slug: voiceSlug(text), text }));

describe("Pipi's Hidden Shells voice clips", () => {
  if (process.env.WRITE_VOICE_LINES) writeFileSync(listFile, `${JSON.stringify(lines, null, 1)}\n`);

  it('gives every line its own clip name, and the list is up to date', () => {
    expect(new Set(lines.map((l) => l.slug)).size).toBe(lines.length);
    expect(lines.some((l) => l.text === '3 pipi. How many are hiding? Look at the sand. Then tap the shell the hand points to.')).toBe(true);
    expect(existsSync(listFile) && JSON.parse(readFileSync(listFile, 'utf8'))).toEqual(lines);
  });

  it('has a recorded clip for every line', () => {
    expect(lines.filter((l) => !existsSync(join(folder, `${l.slug}.mp3`))).map((l) => l.slug)).toEqual([]);
  });

  it('keeps no clips for lines the game no longer says', () => {
    const wanted = new Set(lines.map((l) => `${l.slug}.mp3`));
    expect(readdirSync(folder).filter((f) => f.endsWith('.mp3') && !wanted.has(f))).toEqual([]);
  });
});
