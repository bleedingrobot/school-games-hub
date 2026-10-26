/**
 * "Choose your look": the 24 painted trainers as a group of radio buttons, so the arrow keys move between them and a
 * screen reader says "Girl 3, radio button, 15 of 24". The real radio inputs are hidden behind the pictures.
 * A look whose picture hasn't arrived shows its name instead.
 */
import { LOOKS } from '../../../shared/monsters/world/start';
import { lookPic } from './art/painted';

/** "girl-03" → "Girl 3". */
export const lookName = (look: string) => {
  const [kind, n] = look.split('-');
  return `${kind[0].toUpperCase()}${kind.slice(1)} ${Number(n)}`;
};

/** True when at least one look has its picture (with none, the game leaves the choice out). */
export const hasLooks = () => LOOKS.some((l) => lookPic(l));

export function LookPicker({ value, onChange, legend = 'Choose your look' }: { value?: string; onChange: (look: string) => void; legend?: string }) {
  return (
    <fieldset className="mp-looks">
      <legend>{legend}</legend>
      <div className="mp-looks__grid">
        {LOOKS.map((look) => {
          const pic = lookPic(look, true);
          return (
            <label key={look} className={`mp-look${value === look ? ' is-picked' : ''}`}>
              <input type="radio" name="mm-look" value={look} checked={value === look} onChange={() => onChange(look)} />
              {pic ? <img src={pic} alt={lookName(look)} decoding="async" draggable={false} /> : <span>{lookName(look)}</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
