/**
 * The four standard checks on a game's voice clips, as one call in the game's `voiceLines.test.ts`:
 *
 *   voiceLinesSuite('weka', allVoiceLines, { title: 'Weka’s Stepping Stones voice clips' });
 *
 * 1. every line has its own clip name; 2. `public/voice/<game>/lines.json` matches the lines; 3. every line has a recorded
 * `<slug>.mp3`; 4. no clip is left for a line the game no longer says. After changing a line, rewrite the list with
 * `WRITE_VOICE_LINES=1 npx vitest run <the test file>` and make the clips with scripts/voice-clips.py <game>.
 * Test code only: it uses vitest and node, so a game's screen never imports it (it is not in index.ts).
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { voiceSlug } from '../speech';

export function voiceLinesSuite(
  game: string,
  allVoiceLines: () => string[],
  options: {
    title?: string;
    /** A line that starts with `startsWith` must get a clip name matching `slug` (for example a macron turned to a plain letter). */
    accent?: { startsWith: string; slug: RegExp };
  } = {},
): void {
  const folder = join(process.cwd(), 'public/voice', game);
  const listFile = join(folder, 'lines.json');
  const lines = allVoiceLines().map((text) => ({ slug: voiceSlug(text), text }));

  describe(options.title ?? `${game} voice clips`, () => {
    if (process.env.WRITE_VOICE_LINES) writeFileSync(listFile, `${JSON.stringify(lines, null, 1)}\n`);

    it('gives every line its own clip name, with plain letters', () => {
      expect(new Set(lines.map((l) => l.slug)).size).toBe(lines.length);
      const { accent } = options;
      if (accent) expect(lines.find((l) => l.text.startsWith(accent.startsWith))?.slug).toMatch(accent.slug);
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
}
