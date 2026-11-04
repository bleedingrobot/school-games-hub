import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { voiceSlug } from '../../speech';
import { allVoiceLines } from './voiceLines';

// The list scripts/voice-clips.py records. After changing a line, rewrite it with
//   WRITE_VOICE_LINES=1 npx vitest run src/games/korora/voiceLines.test.ts
// then make the new clips with scripts/voice-clips.py korora.
const folder = join(process.cwd(), 'public/voice/korora');
const listFile = join(folder, 'lines.json');
const lines = allVoiceLines().map((text) => ({ slug: voiceSlug(text), text }));

describe('Penguin Pairs voice clips', () => {
  if (process.env.WRITE_VOICE_LINES) writeFileSync(listFile, `${JSON.stringify(lines, null, 1)}\n`);

  it('gives every line its own clip name, with plain letters (Pūkeko is pukeko)', () => {
    expect(new Set(lines.map((l) => l.slug)).size).toBe(lines.length);
    expect(lines.find((l) => l.text.startsWith('Pūkeko wants'))?.slug).toMatch(/^pukeko-wants/);
  });

  it('has the list of lines up to date', () => {
    expect(JSON.parse(readFileSync(listFile, 'utf8'))).toEqual(lines);
  });

  it('has a recorded clip for every line', () => {
    expect(lines.filter((l) => !existsSync(join(folder, `${l.slug}.mp3`))).map((l) => l.slug)).toEqual([]);
  });

  it('keeps no clips for lines the game no longer says', () => {
    const wanted = new Set(lines.map((l) => `${l.slug}.mp3`));
    expect(readdirSync(folder).filter((f) => f.endsWith('.mp3') && !wanted.has(f))).toEqual([]);
  });
});
