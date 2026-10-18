/**
 * The monster book as a screen: all 54 monsters in book order. The ones you have met or own show
 * in full; the others are a dark shape with a "?". Pick one to read its type, maths topic, family,
 * attacks and when it grows. Normal HTML (buttons, a list, a live detail panel), keyboard and touch.
 */
import { useState } from 'react';
import { TOPICS } from '../../../shared/maths/skillPacks';
import { FAMILIES, MONSTER_BOOK, speciesOf } from '../../../shared/monsters/monsterBook';
import { TYPE_LABEL, TYPE_TOPIC } from '../../../shared/monsters/types';
import { MonsterArt } from './art/MonsterArt';
import { TypeChip } from './ui';

export interface BookProps {
  seen: readonly string[];
  owned: readonly string[];
}

type Status = 'owned' | 'seen' | 'unknown';

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

  return (
    <div className="bk">
      <div className="bk-list">
        <p className="bk-count" aria-live="polite">
          <strong>{ownedCount}</strong> owned · <strong>{seenCount}</strong> met · {MONSTER_BOOK.length} in all
        </p>
        <ol className="bk-grid" aria-label="All the monsters">
          {MONSTER_BOOK.map((s, i) => {
            const st = status(s.id);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  className={`bk-tile bk-tile--${st}${selected === s.id ? ' is-selected' : ''}`}
                  aria-pressed={selected === s.id}
                  aria-label={st === 'unknown' ? `Number ${i + 1}, not met yet` : `Number ${i + 1}, ${s.name}, ${st === 'owned' ? 'owned' : 'met'}`}
                  onClick={() => setSelected(s.id)}
                >
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
              <dt>Type</dt>
              <dd><TypeChip species={shown.id} /> {TYPE_LABEL[shown.type]}</dd>
              <dt>Maths</dt>
              <dd>{topicLabel(TYPE_TOPIC[shown.type])}</dd>
              <dt>Family</dt>
              <dd>{FAMILIES[shown.family].names[0]} family, form {shown.stage} of 3</dd>
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
