/**
 * The picture for a question (docs/plans/help-me/PLAN.md H8): the first rule that recognises the question makes it.
 * A question with its own server figure keeps that, so this returns null for it.
 */
import { PICTURE_RULES } from './rules';
import type { Picture, PictureQuestion } from './types';

export type { Picture, PictureQuestion } from './types';

export function pictureFor(q: PictureQuestion): Picture | null {
  if (q.figure) return null;
  for (const rule of PICTURE_RULES) {
    try {
      const made = rule(q);
      if (made) return made;
    } catch {
      // A rule that can't read this question just isn't the one for it.
    }
  }
  return null;
}
