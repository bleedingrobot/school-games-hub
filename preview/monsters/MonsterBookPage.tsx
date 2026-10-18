/** Preview only: every monster in the book, three forms side by side, with a shiny toggle. */
import { useState } from 'react';
import { FAMILIES, MONSTER_BOOK, speciesOf } from '../../shared/monsters/monsterBook';
import { TYPE_LABEL, TYPES, type TypeId } from '../../shared/monsters/types';
import { AttackEffect, CriticalPop, DamageNumber, EFFECT_MS } from '../../src/games/monsters/art/Effects';
import { MonsterArt } from '../../src/games/monsters/art/MonsterArt';

/** Every attack effect, with a button to play it over a monster. */
function EffectsGallery() {
  const [playing, setPlaying] = useState<{ anim: string; n: number } | null>(null);
  const stand = { leaf: 'digibud-2', water: 'plusplash-2', fire: 'factorch-2', ice: 'divvy-2', spark: 'fractopus-2', stone: 'pebblepoint-2' } as const;
  return (
    <section aria-labelledby="fx-title">
      <h2 id="fx-title">Attack effects</h2>
      <p>Each type has three sizes: small for a basic move, bigger for its own moves, biggest for the final move.</p>
      <div className="mb-fx-grid">
        {TYPES.map((t) =>
          [1, 2, 3].map((n) => {
            const anim = `${t}-${n}`;
            const on = playing?.anim === anim;
            return (
              <div key={anim} className="mb-fx-cell">
                <div className="mb-fx-stage">
                  <MonsterArt species={stand[t]} size={110} still />
                  {on && <AttackEffect key={playing!.n} anim={anim} />}
                  {on && <DamageNumber key={`d${playing!.n}`} amount={12 * n} effect="strong" />}
                  {on && n === 3 && <CriticalPop key={`c${playing!.n}`} />}
                </div>
                <button type="button" onClick={() => { setPlaying({ anim, n: (playing?.n ?? 0) + 1 }); window.setTimeout(() => setPlaying((p) => (p?.anim === anim ? null : p)), EFFECT_MS[n - 1] + 900); }}>
                  Play {anim}
                </button>
              </div>
            );
          }),
        )}
      </div>
    </section>
  );
}

export function MonsterBookPage() {
  const [shiny, setShiny] = useState(false);
  const [type, setType] = useState<TypeId | 'all'>('all');
  const families = Object.entries(FAMILIES).filter(([, f]) => type === 'all' || f.type === type);
  return (
    <section className="mp-page">
      <h1>Monster book</h1>
      <p>All {MONSTER_BOOK.length} monsters: first form, grown form and last form of each family.</p>
      <div className="mp-controls">
        <label>
          Type{' '}
          <select value={type} onChange={(e) => setType(e.target.value as TypeId | 'all')}>
            <option value="all">All six</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input type="checkbox" checked={shiny} onChange={(e) => setShiny(e.target.checked)} /> Show shiny colours
        </label>
      </div>
      <div className="mb-book">
        {families.map(([id, f]) => (
          <article key={id} className={`mb-family mb-family--${f.type}`} aria-label={`${f.names[0]} family`}>
            <h2>
              {f.names[0]} <small>{TYPE_LABEL[f.type]}</small>
            </h2>
            <ol className="mb-forms">
              {[1, 2, 3].map((stage) => {
                const sp = speciesOf(`${id}-${stage}`);
                return (
                  <li key={sp.id}>
                    <MonsterArt species={sp.id} shiny={shiny} size={120} />
                    <strong>{sp.name}</strong>
                    <span>{sp.evolveAt ? `grows at level ${sp.evolveAt}` : 'fully grown'}</span>
                    <span className="mb-moves">{sp.attacks.map((a) => a.name).join(' · ')}</span>
                  </li>
                );
              })}
            </ol>
          </article>
        ))}
      </div>
      <EffectsGallery />
    </section>
  );
}
