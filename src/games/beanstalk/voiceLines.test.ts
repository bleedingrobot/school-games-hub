import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { voiceSlug } from '../../speech';
import { TARGETS } from '../../../shared/beanstalk/round';
import { allVoiceLines } from './voiceLines';
import { WORDS } from './words';

// The list scripts/voice-clips.py records. After changing a line, rewrite it with
//   WRITE_VOICE_LINES=1 npx vitest run src/games/beanstalk/voiceLines.test.ts
// then make the new clips with scripts/voice-clips.py beanstalk.
const folder = join(process.cwd(), 'public/voice/beanstalk');
const listFile = join(folder, 'lines.json');
const lines = allVoiceLines().map((text) => ({ slug: voiceSlug(text), text }));

describe("Kiwi's Beanstalk voice clips", () => {
  if (process.env.WRITE_VOICE_LINES) writeFileSync(listFile, `${JSON.stringify(lines, null, 1)}\n`);

  it('gives every line its own clip name, with plain letters (Tūī is tui)', () => {
    expect(new Set(lines.map((l) => l.slug)).size).toBe(lines.length);
    expect(lines.find((l) => l.text.startsWith('Tūī is stuck'))?.slug).toMatch(/^tui-is-stuck/);
  });

  it('has a why-line for every wrong pair and the look-together lines for every leaf, on every beanstalk (maths review R5)', () => {
    const said = new Set(lines.map((l) => l.text));
    for (const target of TARGETS) {
      const step = target / 10;
      for (let a = 1; a <= 9; a++) {
        for (let b = 1; b <= 9; b++) if (a !== b && a + b !== 10) expect(said.has(WORDS.why(a * step, b * step, target)), `${a * step} + ${b * step}`).toBe(true);
        expect(said.has(WORDS.fillUp(a * step, target)) && said.has(WORDS.nowTry(a * step))).toBe(true);
      }
    }
    expect(said.has(WORDS.lookTogether)).toBe(true);
    expect(WORDS.why(80, 30, 100)).toBe('30 and 80 make 110. 3 tens and 8 tens is 11 tens, not 10.');
    expect(WORDS.why(4, 5, 10)).toBe('4 and 5 make 9. Just one more would make 10.');
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
