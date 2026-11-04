/**
 * The monster book as a screen: all the monsters in book order. The ones you have met or own show
 * in full; the others are a dark shape with a "?". Each tile shows how rare
 * the monster is: stars and a coloured tile for uncommon, rare and ultra rare. Pick one to read its type, maths topic, family,
 * attacks and when it grows. Normal HTML (buttons, a list, a live detail panel), keyboard and touch.
 */
import { useState } from 'react';
import { TOPICS } from '../../../shared/maths/skillPacks';
import { MONSTER_BOOK, speciesOf, type Rarity } from '../../../shared/monsters/monsterBook';
import { TYPE_LABEL, TYPE_TOPIC } from '../../../shared/monsters/types';
import { MonsterArt } from './art/MonsterArt';
import { TypeChip } from './ui';

export interface BookProps {
  seen: readonly string[];
  owned: readonly string[];
}

type Status = 'owned' | 'seen' | 'unknown';

/** Commons are plain; the rarer a monster, the more stars and the brighter its tile. */
const RARITY_LABEL: Record<Rarity, string> = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', ultra: 'Ultra rare' };
const RARITY_STARS: Record<Rarity, string> = { common: '', uncommon: '★', rare: '★★', ultra: '★★★' };

function RarityChip({ rarity }: { rarity: Rarity }) {
  return <span className={`bk-rarity bk-rarity--${rarity}`}>{RARITY_STARS[rarity] && <span aria-hidden="true">{RARITY_STARS[rarity]} </span>}{RARITY_LABEL[rarity]}</span>;
}

const topicLabel = (id: string) => TOPICS.find((t) => t.id === id)?.label ?? id;

export function MonsterBookScreen({ seen, owned }: BookProps) {
  const status = (id: string): Status => (owned.includes(id) ? 'owned' : seen.includes(id) ? 'seen' : 'unknown');
  const [selected, setSelected] = useState(() => (MONSTER_BOOK.find((s) => status(s.id) !== 'unknown') ?? MONSTER_BOOK[0]).id);
  const shown = speciesOf(selected);
  const shownStatus = status(selected);
  const number = MONSTER_BOOK.findIndex((s) => s.id === selected) + 1;
  const ownedCount = MONSTER_BOOK.filter((s) => status(s.id) === 'owned').length;
  const seenCount = MONSTER_BOOK.filter((s) => status(s.id) !== 'unknown').length;
  const before = shown.stage > 1 ? speciesOf(`${shown.family}-${shown.stage - 1}`) : null;
  const next = shown.evolvesTo ? speciesOf(shown.evolvesTo) : null;
  // Rare families have two forms and ultra rares one, so count the forms from the book itself.
  const forms = MONSTER_BOOK.filter((s) => s.family === shown.family);

  return (
    <div className="bk">
      <div className="bk-list">
        <p className="bk-count" aria-live="polite">
          <strong>{ownedCount}</strong> owned · <strong>{seenCount}</strong> met · {MONSTER_BOOK.length} in all
        </p>
        <p className="bk-key" aria-hidden="true">
          <RarityChip rarity="common" /> <RarityChip rarity="uncommon" /> <RarityChip rarity="rare" /> <RarityChip rarity="ultra" />
        </p>
        <ol className="bk-grid" aria-label="All the monsters">
          {MONSTER_BOOK.map((s, i) => {
            const st = status(s.id);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  className={`bk-tile bk-tile--${st} bk-tile--${s.rarity}${selected === s.id ? ' is-selected' : ''}`}
                  aria-pressed={selected === s.id}
                  aria-label={`${st === 'unknown' ? `Number ${i + 1}, not met yet` : `Number ${i + 1}, ${s.name}, ${st === 'owned' ? 'owned' : 'met'}`}${s.rarity === 'common' ? '' : `, ${RARITY_LABEL[s.rarity].toLowerCase()}`}`}
                  onClick={() => setSelected(s.id)}
                >
                  {s.rarity !== 'common' && <span className="bk-stars" aria-hidden="true">{RARITY_STARS[s.rarity]}</span>}
                  <span className={st === 'unknown' ? 'bk-dark' : 'bk-art'} aria-hidden="true">
                    <MonsterArt species={s.id} size={52} still nameless={st === 'unknown'} />
                  </span>
                  <span className="bk-name" aria-hidden="true">{st === 'unknown' ? '?' : s.name}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      <section className="bk-detail" aria-label="About this monster" aria-live="polite" tabIndex={0}>
        {shownStatus === 'unknown' ? (
          <>
            <div className="bk-detail__art bk-dark" aria-hidden="true"><MonsterArt species={shown.id} size={110} still nameless /></div>
            <h3>? ? ?</h3>
            <p className="bk-sub">Number {number}</p>
            <p><RarityChip rarity={shown.rarity} /></p>
            <p>You have not met this monster yet. Look for it in the long grass, in a Tower, or ask a trainer!</p>
          </>
        ) : (
          <>
            <div className="bk-detail__art"><MonsterArt species={shown.id} size={110} /></div>
            <h3>{shown.name}</h3>
            <p className="bk-sub">
              Number {number} · {shownStatus === 'owned' ? 'You own one' : 'Met, not owned yet'}
            </p>
            <dl className="bk-facts">
              <dt>Rarity</dt>
              <dd><RarityChip rarity={shown.rarity} /></dd>
              <dt>Type</dt>
              <dd><TypeChip species={shown.id} /> {TYPE_LABEL[shown.type]}</dd>
              <dt>Maths</dt>
              <dd>{topicLabel(TYPE_TOPIC[shown.type])}</dd>
              <dt>Family</dt>
              <dd>{forms.length > 1 ? `${forms[0].name} family, form ${shown.stage} of ${forms.length}` : 'One of a kind'}</dd>
              <dt>Attacks</dt>
              <dd>{shown.attacks.map((a) => a.name).join(', ')}</dd>
              <dt>Growth</dt>
              <dd>
                {next ? `Grows into ${next.name} at level ${shown.evolveAt}.` : 'Fully grown.'}
                {before ? ` Grew from ${before.name}.` : ''}
              </dd>
            </dl>
          </>
        )}
      </section>
    </div>
  );
}
