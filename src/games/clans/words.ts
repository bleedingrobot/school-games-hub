/** Names come from word lists (the hub's rule: nobody types a name). */
export const MEMBER_NAMES = [
  'Aria', 'Bram', 'Cleo', 'Dax', 'Elin', 'Finn', 'Gwen', 'Hugo', 'Isla', 'Jory', 'Kira', 'Leif', 'Mira', 'Nico', 'Orla', 'Pip',
  'Quill', 'Rowan', 'Sage', 'Tam', 'Una', 'Vik', 'Wren', 'Xara', 'Yuri', 'Zed', 'Ember', 'Moss', 'Tilly', 'Bodhi', 'Kiri', 'Hemi',
];
export const CLAN_ADJECTIVES = ['Red', 'Silver', 'Brave', 'Golden', 'Swift', 'Jolly', 'Mighty', 'Clever', 'Misty', 'Bold', 'Lucky', 'Iron'];
export const CLAN_NOUNS = ['Banner', 'Foxes', 'Lanterns', 'Wolves', 'Shields', 'Owls', 'Pennants', 'Bears', 'Falcons', 'Hammers', 'Stars', 'Rangers'];

export const clanNameFrom = (adjective: number, noun: number) =>
  `${CLAN_ADJECTIVES[((adjective % CLAN_ADJECTIVES.length) + CLAN_ADJECTIVES.length) % CLAN_ADJECTIVES.length]} ${CLAN_NOUNS[((noun % CLAN_NOUNS.length) + CLAN_NOUNS.length) % CLAN_NOUNS.length]}`;
