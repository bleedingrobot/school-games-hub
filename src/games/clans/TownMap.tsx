import { sceneArt } from './art';

/** The places on the town map. `screen` is the screen it opens. */
export type TownPlace = 'mines' | 'market' | 'myvillage' | 'training' | 'church' | 'quest' | 'news' | 'scoreboard' | 'monster';

/**
 * Where each place is on the painted town (`scenes/town`, docs/clans-town-art), as a share of the picture's width and height.
 * On a phone the label drops the words in `before`, so the labels don't run into each other.
 */
const SPOTS: { id: TownPlace; label: string; before?: string; x: number; y: number }[] = [
  { id: 'mines', label: 'Mines', before: 'The ', x: 12, y: 38 },
  { id: 'market', label: 'Market', before: 'The ', x: 22, y: 63 },
  { id: 'news', label: 'News', before: "Herald's ", x: 36, y: 41 },
  { id: 'myvillage', label: 'My Village', x: 54, y: 46 },
  { id: 'training', label: 'Training', before: 'The ', x: 47, y: 79 },
  { id: 'monster', label: 'Monster', before: "The ", x: 56, y: 15 },
  { id: 'scoreboard', label: 'Heroes', before: 'Hall of ', x: 76, y: 25 },
  { id: 'church', label: 'Church', before: 'The ', x: 84, y: 54 },
  { id: 'quest', label: 'Quest', before: "Today's ", x: 87, y: 81 },
];

export const hasTownMap = () => !!sceneArt('town').wide;

/**
 * The painted town at the top of the home screen: tap a place to go there (as in Dragon Maths). It is the way round town
 * for everyone: each place is a real button, reached with Tab and read out with its full name and note. `notes` add a short word under a label ("2 fights", "done today"); `off` places are faded and can't be tapped;
 * `hot` places glow (something to do there now). A place missing from `shown` is not on the map today (the monster outside its week).
 */
export function TownMap({ onGo, shown, off = [], hot = [], notes = {} }: {
  onGo: (place: TownPlace) => void; shown: TownPlace[]; off?: TownPlace[]; hot?: TownPlace[]; notes?: Partial<Record<TownPlace, string>>;
}) {
  const art = sceneArt('town');
  if (!art.wide) return null;
  return (
    <nav className="cq-town" aria-label="Places in town">
      <picture>
        <source media="(max-width: 900px)" srcSet={art.small} />
        <img src={art.wide} alt="" draggable={false} />
      </picture>
      {SPOTS.filter((s) => shown.includes(s.id)).map((s) => (
        <button
          key={s.id} type="button" data-place={s.id}
          aria-label={`${s.before ?? ''}${s.label}${s.id === 'scoreboard' ? ' (scoreboard)' : ''}${notes[s.id] ? `, ${notes[s.id]}` : ''}`}
          className={`cq-town__spot${hot.includes(s.id) ? ' cq-town__spot--hot' : ''}`}
          style={{ left: `${s.x}%`, top: `${s.y}%` }} disabled={off.includes(s.id)} onClick={() => onGo(s.id)}
        >
          <span className="cq-town__label">
            {s.before && <span className="cq-town__long">{s.before}</span>}{s.label}
            {notes[s.id] && <small>{notes[s.id]}</small>}
          </span>
        </button>
      ))}
    </nav>
  );
}
