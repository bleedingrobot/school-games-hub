/** Names come from word lists (the hub's rule: nobody types a name). */
export const MEMBER_NAMES = [
  'Aria', 'Bram', 'Cleo', 'Dax', 'Elin', 'Finn', 'Gwen', 'Hugo', 'Isla', 'Jory', 'Kira', 'Leif', 'Mira', 'Nico', 'Orla', 'Pip',
  'Quill', 'Rowan', 'Sage', 'Tam', 'Una', 'Vik', 'Wren', 'Xara', 'Yuri', 'Zed', 'Ember', 'Moss', 'Tilly', 'Bodhi', 'Kiri', 'Hemi',
];
export const CLAN_ADJECTIVES = ['Red', 'Silver', 'Brave', 'Golden', 'Swift', 'Jolly', 'Mighty', 'Clever', 'Misty', 'Bold', 'Lucky', 'Iron'];
export const CLAN_NOUNS = ['Banner', 'Foxes', 'Lanterns', 'Wolves', 'Shields', 'Owls', 'Pennants', 'Bears', 'Falcons', 'Hammers', 'Stars', 'Rangers'];

export const clanNameFrom = (adjective: number, noun: number) =>
  `${CLAN_ADJECTIVES[((adjective % CLAN_ADJECTIVES.length) + CLAN_ADJECTIVES.length) % CLAN_ADJECTIVES.length]} ${CLAN_NOUNS[((noun % CLAN_NOUNS.length) + CLAN_NOUNS.length) % CLAN_NOUNS.length]}`;

/**
 * Made-up hero names (27 Oct 2026). Only when the teacher's switch is on; the list above is still the default.
 * Hero names are only shown to the pupil and their teachers, never to classmates, and clan names still come from the lists.
 */
export const TYPED_NAME_MIN = 2;
export const TYPED_NAME_MAX = 12;

/** Letters, with at most one space, hyphen or apostrophe between two parts ("Te Ahi", "Jo-Jo", "O'Neil"). No numbers. */
const NAME_SHAPE = /^[A-Za-z]+(?:[ '-][A-Za-z]+)?$/;

// Refused anywhere inside a name. Each letter may be typed more than once ("fuuuck" is caught, "Bob" is not "boob").
const NEVER_INSIDE = [
  'fuck', 'fuk', 'fck', 'shit', 'cunt', 'bitch', 'bastard', 'wank', 'twat', 'bollock', 'nigg', 'fagot', 'faggot',
  'retard', 'slut', 'whore', 'porn', 'penis', 'vagina', 'boob', 'dildo', 'hitler', 'pedo', 'sexy', 'horny',
  'poop', 'pussy', 'skank', 'tits', 'arsehole', 'asshole', 'dickhead', 'killyourself',
];
// Refused as a whole name or a whole part only, because they are inside ordinary names ("Cassius", "Dickens", "Grape").
const NEVER_ALONE = [
  'ass', 'arse', 'butt', 'bum', 'poo', 'pee', 'piss', 'cock', 'dick', 'tit', 'hell', 'damn', 'crap', 'sex', 'fag', 'hoe',
  'nob', 'knob', 'prick', 'wee', 'weewee', 'willy', 'fart', 'stupid', 'dumb', 'idiot', 'loser', 'ugly', 'fat', 'kill', 'die',
  'dead', 'gay', 'homo', 'nude', 'naked', 'drug', 'drugs', 'weed', 'beer', 'vape', 'rape', 'kys', 'kkk', 'shag', 'puta', 'nazi',
];

/** "boob" becomes b+o+o+b+: the same letters in order, each typed one or more times. */
const stretchy = (word: string) => [...word].map((ch) => `${ch}+`).join('');
const insideRule = new RegExp(NEVER_INSIDE.map(stretchy).join('|'));
const aloneRule = new RegExp(`^(?:${NEVER_ALONE.map(stretchy).join('|')})$`);
const lettersOf = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

/** A made-up name, tidied (spaces trimmed, each part starting with a capital), or why it can't be used. */
export function checkTypedName(raw: unknown): { ok: true; name: string } | { ok: false; say: string } {
  if (typeof raw !== 'string') return { ok: false, say: 'Type a name.' };
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (trimmed === '') return { ok: false, say: 'Type a name.' };
  if (trimmed.length < TYPED_NAME_MIN) return { ok: false, say: `A name needs at least ${TYPED_NAME_MIN} letters.` };
  if (trimmed.length > TYPED_NAME_MAX) return { ok: false, say: `A name can be up to ${TYPED_NAME_MAX} letters long.` };
  if (!NAME_SHAPE.test(trimmed)) return { ok: false, say: 'Use letters only (one space, dash or apostrophe is fine).' };
  const whole = lettersOf(trimmed);
  const parts = trimmed.split(/[ '-]/).map(lettersOf);
  if (insideRule.test(whole) || aloneRule.test(whole) || parts.some((p) => aloneRule.test(p))) {
    return { ok: false, say: 'Please pick a kinder name.' };
  }
  const name = trimmed.replace(/(^|[ '-])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());
  return { ok: true, name };
}

/** The name a hero will have: a name from the list as it is, or (when the teacher allows it) a made-up name, tidied. */
export function memberNameFrom(raw: unknown, typedNames: boolean): { ok: true; name: string } | { ok: false; say: string } {
  if (typeof raw === 'string' && MEMBER_NAMES.includes(raw)) return { ok: true, name: raw };
  if (!typedNames) return { ok: false, say: 'Pick member names from the list.' };
  return checkTypedName(raw);
}
