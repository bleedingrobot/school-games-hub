import { sceneArt } from './art';

/** The places on the town map. `screen` is the screen it opens. */
export type TownPlace = 'mines' | 'market' | 'myvillage' | 'training' | 'church' | 'quest' | 'news' | 'scoreboard' | 'monster';

/**
 * Where each place is on the painted town (`scenes/town`, docs/clans-town-art), as a share of the picture's width and height.
 * The words in `drop` ("The", "My", "Herald's") are never shown, so the labels stay small over the painting (James,
 * 16 Nov 2026); screen readers still say the full name. On a phone the label also drops the words in `before`.
 * `key` is the letter that goes there (James, 22 Nov 2026), shown as a small pill on the label's corner while the game's
 * keys are on (never on touch screens); `useGameKeys` in ClanQuest presses it through `data-key`.
 */
const SPOTS: { id: TownPlace; label: string; key: string; drop?: string; before?: string; x: number; y: number }[] = [
  { id: 'mines', label: 'Mines', key: 'm', drop: 'The ', x: 12, y: 38 },
  { id: 'market', label: 'Market', key: 'k', drop: 'The ', x: 22, y: 63 },
  { id: 'news', label: 'News', key: 'n', drop: "Herald's ", x: 36, y: 41 },
  { id: 'myvillage', label: 'Village', key: 'v', drop: 'My ', x: 54, y: 46 },
  { id: 'training', label: 'Training', key: 't', drop: 'The ', x: 47, y: 79 },
  { id: 'monster', label: 'Monster', key: 'o', drop: 'The ', x: 56, y: 15 },
  { id: 'scoreboard', label: 'Heroes', key: 'h', before: 'Hall of ', x: 76, y: 25 },
  { id: 'church', label: 'Church', key: 'c', drop: 'The ', x: 84, y: 54 },
  { id: 'quest', label: 'Quest', key: 'q', before: "Today's ", x: 87, y: 81 },
];

export const hasTownMap = () => !!sceneArt('town').wide;

/**
 * The painted town at the top of the home screen: tap a place to go there (as in Dragon Maths). It is the way round town
 * for everyone: each place is a real button, reached with Tab and read out with its full name and note. `notes` add a short word under a label ("2 fights", "done today"); `off` places are faded and can't be tapped;
 * `hot` places glow (something to do there now). A place missing from `shown` is not on the map today (the monster outside its week).
 */
export function TownMap({ onGo, shown, off = [], hot = [], notes = {}, top }: {
  /** The game's title and the clan's gold, followers and fame, laid over the top of the painting. */
  top?: React.ReactNode;
  onGo: (place: TownPlace) => void; shown: TownPlace[]; off?: TownPlace[]; hot?: TownPlace[]; notes?: Partial<Record<TownPlace, string>>;
}) {
  const art = sceneArt('town');
  if (!art.wide) return null;
  return (
    <div className="cq-town">
      {/* The same painting, blurred, behind the map: fills the window's edges when its shape isn't the map's. */}
      <img className="cq-town__blur" src={art.small ?? art.wide} alt="" aria-hidden="true" draggable={false} />
      {top}
      <nav aria-label="Places in town" className="cq-town__paper">
      <picture>
        <source media="(max-width: 900px)" srcSet={art.small} />
        <img src={art.wide} alt="" draggable={false} />
      </picture>
      {SPOTS.filter((s) => shown.includes(s.id)).map((s) => (
        <button
          key={s.id} type="button" data-place={s.id} data-key={s.key}
          aria-label={`${s.drop ?? ''}${s.before ?? ''}${s.label}${s.id === 'scoreboard' ? ' (scoreboard)' : ''}${notes[s.id] ? `, ${notes[s.id]}` : ''}`}
          className={`cq-town__spot${hot.includes(s.id) ? ' cq-town__spot--hot' : ''}`}
          style={{ left: `${s.x}%`, top: `${s.y}%` }} disabled={off.includes(s.id)} onClick={() => onGo(s.id)}
        >
          <span className="cq-town__label">
            {s.before && <span className="cq-town__long">{s.before}</span>}{s.label}
            {notes[s.id] && <small>{notes[s.id]}</small>}
            <kbd className="cq-town__key" aria-hidden="true">{s.key.toUpperCase()}</kbd>
          </span>
        </button>
      ))}
      </nav>
    </div>
  );
}
