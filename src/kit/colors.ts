/**
 * Colours for the kit's pictures. A game passes any CSS colour (`currentColor`, `#2f6fb5`, `var(--wk-gold)`) for a part,
 * or sets the CSS variable `--kit-<part>` on a parent and passes nothing. With neither, the picture uses the text
 * colour, so it is readable in any game's look. No game words in here.
 */
export type KitColors<Part extends string> = Partial<Record<Part, string>>;

export function kitColor<Part extends string>(colors: KitColors<Part> | undefined, part: Part, fallback = 'currentColor'): string {
  return colors?.[part] ?? `var(--kit-${part}, ${fallback})`;
}
