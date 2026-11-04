import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STAGES } from '../../shared/subitising/config';
import { groupSizes, makePicture } from '../../shared/subitising/patterns';
import { voiceSlug } from '../speech';
import { allVoiceLines, flashFeedback } from './voiceLines';

// The list scripts/quick-looks-voice.py records. After changing a line, rewrite it with
//   WRITE_VOICE_LINES=1 npx vitest run src/subitising/voiceLines.test.ts
// then make the new clips with the script.
const folder = join(process.cwd(), 'public/voice/quick-looks');
const listFile = join(folder, 'lines.json');
const lines = allVoiceLines().map((text) => ({ slug: voiceSlug(text), text }));

describe('Quick looks voice clips', () => {
  if (process.env.WRITE_VOICE_LINES) writeFileSync(listFile, `${JSON.stringify(lines, null, 1)}\n`);

  it('gives every line its own clip name', () => {
    expect(new Set(lines.map((l) => l.slug)).size).toBe(lines.length);
  });

  it('has the list of lines up to date', () => {
    expect(JSON.parse(readFileSync(listFile, 'utf8'))).toEqual(lines);
  });

  it('covers the groups every picture can show', () => {
    const all = new Set(allVoiceLines());
    let seed = 7;
    const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const missing = new Set<string>();
    for (const stage of STAGES) {
      for (const type of stage.types) {
        for (let n = stage.min; n <= stage.max; n++) {
          for (let k = 0; k < 200; k++) {
            let sizes: number[];
            try {
              sizes = groupSizes(makePicture(type, n, rng));
            } catch {
              break; // a number this type never shows (trials.ts keeps each type to its own range)
            }
            const line = flashFeedback(true, n, sizes);
            if (!all.has(line)) missing.add(`${type}: ${line}`);
          }
        }
      }
    }
    expect([...missing]).toEqual([]);
  });

  it('has a recorded clip for every line', () => {
    expect(lines.filter((l) => !existsSync(join(folder, `${l.slug}.mp3`))).map((l) => l.slug)).toEqual([]);
  });

  it('keeps no clips for lines the game no longer says', () => {
    const wanted = new Set(lines.map((l) => `${l.slug}.mp3`));
    expect(readdirSync(folder).filter((f) => f.endsWith('.mp3') && !wanted.has(f))).toEqual([]);
  });
});
