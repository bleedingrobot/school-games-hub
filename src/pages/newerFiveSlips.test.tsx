import { describe, expect, it } from 'vitest';
import { PARROT_KINDS } from '../../shared/parrot/round';
import { SLIPS as ROBIN_SLIPS } from '../../shared/robin/round';
import { SLIP_WORDS as LIZARD_WORDS } from '../../shared/lizard/teacher';
import { SLIP_WORDS as SWAMPHEN_WORDS } from '../../shared/swamphen/teacher';
import { SLIP_WORDS as PARROT_WORDS } from './TeacherParrot';
import { SLIP_WORDS as PIGEON_WORDS } from './TeacherPigeon';
import { SLIP_WORDS as ROBIN_WORDS } from './TeacherRobin';

describe('the usual slip words (S34)', () => {
  it('has a phrase for every kind of slip in Parrot, Robin and Pigeon, and Lizard and Swamp Hen keep theirs', () => {
    for (const kind of PARROT_KINDS) expect(PARROT_WORDS[kind]?.length, `parrot ${kind}`).toBeGreaterThan(3);
    for (const kind of ROBIN_SLIPS) expect(ROBIN_WORDS[kind]?.length, `robin ${kind}`).toBeGreaterThan(3);
    for (const kind of ['reverse', 'ten', 'one', 'mirror', 'near'] as const) expect(PIGEON_WORDS[kind]?.length, `pigeon ${kind}`).toBeGreaterThan(3);
    for (const words of [LIZARD_WORDS, SWAMPHEN_WORDS]) for (const [kind, phrase] of Object.entries(words)) expect(phrase.length, kind).toBeGreaterThan(3);
  });
});
