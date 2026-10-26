/** A new game: choose your look and pick the two types you start with (no typing). */
import { useState } from 'react';
import { HowToPlayBody } from './HowToPlay';
import { startTeam, starterFor } from '../../../shared/monsters/world/start';
import { TYPE_LABEL, TYPES, type TypeId } from '../../../shared/monsters/types';
import type { Monster } from '../../../shared/monsters/rules';
import { MonsterArt } from './art/MonsterArt';
import { hasLooks, LookPicker } from './LookPicker';
import { nameOf } from './text';

export function StartScreen({ onStart }: { onStart: (picks: [TypeId, TypeId], team: Monster[], look?: string) => void }) {
  const [picks, setPicks] = useState<[TypeId, TypeId]>(['water', 'fire']);
  const [look, setLook] = useState<string>();
  const team = startTeam(picks);
  return (
    <section className="mp-start" aria-labelledby="mm-start-title">
      <h1 id="mm-start-title">Maths Monsters</h1>
      <p>Welcome to Harbour Town! Pick the two monsters you start with. Every attack and every catch is a maths question, and each type asks its own kind.</p>
      <div className="mp-start__picks">
        {[0, 1].map((i) => (
          <label key={i}>
            Monster {i + 1}{' '}
            <select value={picks[i]} onChange={(e) => setPicks(i === 0 ? [e.target.value as TypeId, picks[1]] : [picks[0], e.target.value as TypeId])}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]} ({nameOf(starterFor(t, 0).species)})
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <p className="mp-start__team" aria-hidden="true">
        {team.map((m, i) => (
          <MonsterArt key={i} species={m.species} size={72} still />
        ))}
      </p>
      {/* Only once the painted looks are there; optional, and you can change it later in the Menu. */}
      {hasLooks() && <LookPicker value={look} onChange={setLook} />}
      <p>
        <button type="button" className="button button--primary" onClick={() => onStart(picks, team, look)}>
          Start walking
        </button>
      </p>
      <details className="mp-start__howto">
        <summary>How to play</summary>
        <HowToPlayBody />
      </details>
    </section>
  );
}
