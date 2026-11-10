import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { voiceSlug } from '../../speech';
import { TARGETS } from '../../../shared/beanstalk/round';
import { allVoiceLines, leafNumbers } from './voiceLines';
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
      for (const a of leafNumbers(target)) {
        for (const b of leafNumbers(target)) if (a !== b && a + b !== target) expect(said.has(WORDS.why(a, b, target)), `${a} + ${b}`).toBe(true);
        expect(said.has(WORDS.fillUp(a, target)) && said.has(WORDS.nowTry) && said.has(WORDS.goesWith(a))).toBe(true);
        // The missing leaf (R8): what is asked of each leaf, and the take-away after it.
        expect(said.has(WORDS.missingAsk(a, target)) && said.has(WORDS.takeAway(a, target))).toBe(true);
      }
    }
    expect(said.has(WORDS.lookTogether) && said.has(WORDS.nextTitle)).toBe(true);
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
