/**
 * The avatar is a handful of short codes, e.g. { kind: 'robot', eyes: 'star', ... }.
 * That's all that gets saved, and the server only accepts short codes and colours,
 * so no text or pictures can sneak in. Unknown codes fall back to the defaults.
 */

export const AVATAR_OPTIONS = {
  kind: ['kid', 'bear', 'cat', 'robot', 'alien'],
  colour: [
    '#ffe0bd', '#f1c7a5', '#d9a57a', '#b57a4f', '#8d5a3b', '#5c3a24',
    '#2bb3a3', '#5b8def', '#9b6bff', '#ff8a5b', '#ffcf4a', '#7ed957', '#ff6fa8', '#a0a8c0',
  ],
  eyes: ['round', 'happy', 'sleepy', 'wink', 'star'],
  mouth: ['smile', 'grin', 'open', 'tongue'],
  top: ['none', 'short', 'curly', 'long', 'cap', 'beanie', 'crown', 'bow', 'antenna'],
  topColour: ['#3b2a20', '#7a4a26', '#e2b347', '#d2462e', '#1d1b3a', '#5b3cc4', '#2f9e44', '#ff6fa8', '#f5f5f5'],
  extra: ['none', 'glasses', 'freckles', 'blush', 'headphones'],
  bg: ['#2bb3a3', '#5b8def', '#9b6bff', '#ff8a5b', '#ffcf4a', '#7ed957', '#ff6fa8', '#1d1b3a'],
} as const;

export type AvatarPart = keyof typeof AVATAR_OPTIONS;
export type Avatar = { [P in AvatarPart]: (typeof AVATAR_OPTIONS)[P][number] };

export const DEFAULT_AVATAR: Avatar = {
  kind: 'kid',
  colour: '#f1c7a5',
  eyes: 'round',
  mouth: 'smile',
  top: 'short',
  topColour: '#3b2a20',
  extra: 'none',
  bg: '#2bb3a3',
};

export const PART_LABELS: Record<AvatarPart, string> = {
  kind: 'Character',
  colour: 'Colour',
  eyes: 'Eyes',
  mouth: 'Mouth',
  top: 'Hair or hat',
  topColour: 'Hair or hat colour',
  extra: 'Extras',
  bg: 'Background',
};

const PARTS = Object.keys(AVATAR_OPTIONS) as AvatarPart[];

/** Turns whatever the database holds into a complete, safe avatar. */
export function normaliseAvatar(saved: unknown): Avatar {
  const result = { ...DEFAULT_AVATAR } as Record<AvatarPart, string>;
  if (saved && typeof saved === 'object') {
    for (const part of PARTS) {
      const value = (saved as Record<string, unknown>)[part];
      if ((AVATAR_OPTIONS[part] as readonly string[]).includes(value as string)) {
        result[part] = value as string;
      }
    }
  }
  return result as Avatar;
}

export function randomAvatar(random: () => number = Math.random): Avatar {
  const result = {} as Record<AvatarPart, string>;
  for (const part of PARTS) {
    const options = AVATAR_OPTIONS[part];
    result[part] = options[Math.floor(random() * options.length)];
  }
  return result as Avatar;
}

/**
 * The look of the hub pages, picked by each pupil on their profile. It is saved as one more short code in the avatar
 * ({"theme":"menu"}), which the server's avatar check already accepts, so it follows the pupil to any Chromebook.
 */
export const THEMES = [
  { id: 'tidy', label: 'Tidy school' },
  { id: 'menu', label: 'Game menu' },
  { id: 'soft', label: 'Soft and bright' },
] as const;
export type HubTheme = (typeof THEMES)[number]['id'];
export const DEFAULT_THEME: HubTheme = 'tidy';

/** The theme saved with an avatar: missing or unknown is the default (Tidy school). */
export function themeOf(saved: unknown): HubTheme {
  const value = saved && typeof saved === 'object' ? (saved as Record<string, unknown>).theme : undefined;
  return THEMES.some((t) => t.id === value) ? (value as HubTheme) : DEFAULT_THEME;
}

/**
 * What to save: the avatar's parts and the theme together. Saving replaces the whole avatar, so each save carries both
 * (saving the avatar keeps the theme, and saving the theme keeps the avatar).
 */
export function avatarToSave(avatar: Avatar, theme: HubTheme): Avatar & { theme?: HubTheme } {
  return theme === DEFAULT_THEME ? { ...avatar } : { ...avatar, theme };
}
