/**
 * Names pupils type for their sun, planets and system in the Star Forge (James, 3 Nov 2026: kids name their own
 * planets, no naughty words; classmates see them in the gallery). Checked here, by the server and the screen alike.
 * The word lists are copied from Clan Quest's hero names (shared/clans/words.ts), so the two games refuse the same words.
 */
export const TYPED_NAME_MIN = 2;
export const TYPED_NAME_MAX = 14;

/** Letters only, up to three words joined by a space, dash or apostrophe ("Te Ahi", "Nova-Prime", "Big Blue Ball"). */
const NAME_SHAPE = /^[A-Za-z]+(?:[ '-][A-Za-z]+){0,2}$/;

// Refused anywhere inside a name. Each letter may be typed more than once ("fuuuck" is caught, "Bob" is not "boob").
const NEVER_INSIDE = [
  'fuck', 'fuk', 'fck', 'shit', 'cunt', 'bitch', 'bastard', 'wank', 'twat', 'bollock', 'nigg', 'fagot', 'faggot',
  'retard', 'slut', 'whore', 'porn', 'penis', 'vagina', 'boob', 'dildo', 'hitler', 'pedo', 'sexy', 'horny',
  'poop', 'pussy', 'skank', 'tits', 'arsehole', 'asshole', 'dickhead', 'killyourself', 'bullshit', 'motherf',
];
// Refused as a whole name or a whole word only, because they are inside ordinary names ("Cassius", "Dickens", "Grape").
const NEVER_ALONE = [
  'ass', 'arse', 'butt', 'bum', 'poo', 'pee', 'piss', 'cock', 'dick', 'tit', 'hell', 'damn', 'crap', 'sex', 'fag', 'hoe',
  'nob', 'knob', 'prick', 'wee', 'weewee', 'willy', 'fart', 'stupid', 'dumb', 'idiot', 'loser', 'ugly', 'fat', 'kill', 'die',
  'dead', 'gay', 'homo', 'nude', 'naked', 'drug', 'drugs', 'weed', 'beer', 'vape', 'rape', 'kys', 'kkk', 'shag', 'puta', 'nazi',
  'bomb', 'gun', 'smelly', 'stinky', 'hate', 'sucks', 'suck', 'nerd', 'dork', 'balls', 'butthole', 'poopoo', 'boobs',
];

/** "boob" becomes b+o+o+b+: the same letters in order, each typed one or more times. */
const stretchy = (word: string) => [...word].map((ch) => `${ch}+`).join('');
const insideRule = new RegExp(NEVER_INSIDE.map(stretchy).join('|'));
const aloneRule = new RegExp(`^(?:${NEVER_ALONE.map(stretchy).join('|')})$`);
const lettersOf = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

/** A typed name, tidied (spaces trimmed, each word starting with a capital), or why it can't be used, in pupil words. */
export function checkTypedName(raw: unknown): { ok: true; name: string } | { ok: false; say: string } {
  if (typeof raw !== 'string') return { ok: false, say: 'Type a name.' };
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (trimmed === '') return { ok: false, say: 'Type a name.' };
  if (trimmed.length < TYPED_NAME_MIN) return { ok: false, say: `A name needs at least ${TYPED_NAME_MIN} letters.` };
  if (trimmed.length > TYPED_NAME_MAX) return { ok: false, say: `A name can be up to ${TYPED_NAME_MAX} letters long.` };
  if (!NAME_SHAPE.test(trimmed)) return { ok: false, say: 'Use letters only, up to three words.' };
  const whole = lettersOf(trimmed);
  const parts = trimmed.split(/[ '-]/).map(lettersOf);
  if (insideRule.test(whole) || aloneRule.test(whole) || parts.some((p) => aloneRule.test(p))) {
    return { ok: false, say: 'Please pick a kinder name.' };
  }
  const name = trimmed.replace(/(^|[ '-])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());
  return { ok: true, name };
}
