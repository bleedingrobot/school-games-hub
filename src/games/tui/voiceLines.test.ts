import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRound, showRound } from '../../../shared/tui/round';
import { voiceSlug } from '../../speech';
import { allVoiceLines, askLine, sumLine } from './voiceLines';
import { WORDS } from './words';

// The list scripts/voice-clips.py records. After changing a line, rewrite it with
//   WRITE_VOICE_LINES=1 npx vitest run src/games/tui/voiceLines.test.ts
// then make the new clips with scripts/voice-clips.py tui.
const folder = join(process.cwd(), 'public/voice/tui');
const listFile = join(folder, 'lines.json');
const lines = allVoiceLines().map((text) => ({ slug: voiceSlug(text), text }));

describe('Tūī’s Ten Tree voice clips', () => {
  if (process.env.WRITE_VOICE_LINES) writeFileSync(listFile, `${JSON.stringify(lines, null, 1)}\n`);

  it('gives every line its own clip name, with plain letters (Tūī is tui)', () => {
    expect(new Set(lines.map((l) => l.slug)).size).toBe(lines.length);
    expect(lines.find((l) => l.text.startsWith('Tūī is filling'))?.slug).toMatch(/^tui-is-filling/);
  });

  it('has a why-line for every wrong nest of every go', () => {
    const said = new Set(allVoiceLines());
    for (const step of [1, 2, 3, 4, 5] as const) {
      for (const go of showRound(makeRound(3, [], { step, level: 5 }))) {
        for (const w of go.wrongs) expect(said.has(WORDS.why(w.kind, w.n, go.v))).toBe(true);
      }
    }
  });

  it('says the numbers at level 0, never "How many?" alone', () => {
    for (const v of [0, 1, 2, 3] as const) {
      const go = { v, n: 3, teen: 13, l: 0 as const };
      expect(askLine(go)).toBe(sumLine(go));
      expect(askLine(go)).toMatch(/3/);
    }
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
