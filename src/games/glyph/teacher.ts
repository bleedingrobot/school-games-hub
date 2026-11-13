import { GOES_PER_WALL, PASS_FIRST_GO, TEMPLES, WALLS_PER_TEMPLE } from '../../../shared/glyph/config';
import { fetchGlyphEnabled, saveGlyphEnabled } from '../../data/glyph';
import { useSetting } from '../../teacher/useSetting';

/** Glyph Gates on the teacher's Games table: the on/off switch for the class. The server checks it on every request. */
export function useGlyphClassSwitch(classId: string) {
  return useSetting(() => fetchGlyphEnabled(classId), [classId]);
}

export const saveGlyphClassSwitch = (on: boolean, classId: string) => saveGlyphEnabled(on, classId);

export const GLYPH_ABOUT = `Equivalent fractions (Years 4 to 6): students tap the fraction tiles equal to a gold stone, press Light the runes and pick the glyph their tiles make. ${WALLS_PER_TEMPLE} walls make a temple and there are ${TEMPLES.length} temples; opening ${PASS_FIRST_GO} walls at the first go passes a temple. ${GOES_PER_WALL} goes a wall, with a fraction bar, lens and arrows as help. The server makes and checks every wall. Nobody is ranked. Off hides it from students.`;
