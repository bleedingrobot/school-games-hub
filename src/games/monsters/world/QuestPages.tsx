/**
 * The menu pages for quests (docs/MONSTERS-QUESTS-PLAN.md): the quest log, the egg basket, the
 * Tinker and the notice board. Plain HTML in the menu's Sheet; every change goes through the pure
 * rules in shared/monsters/world/questWorld.ts.
 */
import { BIT_NAME, canMake, describeBits, RECIPES } from '../../../../shared/monsters/quests/bits';
import { coldWords, daysHad, daysNeeded, EGG_LABEL, eggWarmth, HATCH_SPOTS, isReady } from '../../../../shared/monsters/quests/eggs';
import { QUESTS } from '../../../../shared/monsters/quests/quests';
import { TYPES } from '../../../../shared/monsters/types';
import { spottedNote } from '../../../../shared/monsters/world/weather';
import type { GameMap, WorldState } from '../../../../shared/monsters/world/types';
import { boardToday, handIn, hatchHere, make, questOf, spotHere, type QuestOptions, type QuestResult } from '../../../../shared/monsters/world/questWorld';

interface PageProps {
  world: WorldState;
  apply: (r: QuestResult) => void;
}

/** Your bits, one row of chips. */
function BitsRow({ world }: { world: WorldState }) {
  const bits = questOf(world).bits;
  return (
    <ul className="mq-bits" aria-label="Your bits">
      {TYPES.map((t) => (
        <li key={t} className={`mq-bit mq-bit--${t}`}>
          <b>{bits[t] ?? 0}</b> {BIT_NAME[t][1]}
        </li>
      ))}
    </ul>
  );
}

export function QuestLogPage({ world }: { world: WorldState }) {
  const q = questOf(world);
  const started = QUESTS.filter((quest) => q.quests[quest.id]);
  const done = QUESTS.filter((quest) => q.flags.includes(`quest-done:${quest.id}`));
  return (
    <div className="mq">
      <BitsRow world={world} />
      {!started.length && !done.length && <p className="mb-empty">No quests yet. Look out for people who need help in each area!</p>}
      {started.map((quest) => {
        const st = q.quests[quest.id];
        return (
          <section key={quest.id} className="mq-quest" aria-label={quest.title}>
            <h3>{quest.title}</h3>
            <ol className="mq-steps">
              {quest.steps.map((step, i) => (
                <li key={i} className={i < st.step ? 'is-done' : i === st.step ? 'is-now' : ''}>
                  {step.hint.replace('{left}', String((step.count ?? 1) - (i === st.step ? st.n : 0)))}
                  {i < st.step && <span className="sr-only"> (done)</span>}
                </li>
              ))}
            </ol>
          </section>
        );
      })}
      {done.length > 0 && (
        <section className="mq-quest" aria-label="Finished quests">
          <h3>Finished</h3>
          <ul className="mq-done">{done.map((quest) => <li key={quest.id}>{quest.title}</li>)}</ul>
        </section>
      )}
    </div>
  );
}

export function EggPage({ world, apply, map, opts }: PageProps & { map: GameMap; opts: QuestOptions }) {
  const q = questOf(world);
  const here = spotHere(world, map);
  const playDays = opts.playDays ?? 0;
  return (
    <div className="mq">
      {opts.day && eggWarmth(q, opts.day) === 'cooling' && <p className="mq-cold" role="status">{coldWords.cooling}</p>}
      {!q.eggs.length && <p className="mb-empty">Your basket is empty. Quests, puzzles and nests in the bonus areas give eggs.</p>}
      <ul className="mq-eggs">
        {q.eggs.map((egg) => {
          const ready = isReady(egg, playDays);
          const spot = HATCH_SPOTS[egg.kind];
          const atSpot = here === spot.spot && map.id === spot.map;
          const need = daysNeeded(egg);
          const had = daysHad(egg, playDays);
          return (
            <li key={egg.id} className={`mq-egg mq-egg--${egg.kind}${ready ? ' is-ready' : ''}`}>
              <span className="mq-egg__shape" aria-hidden="true" />
              <div>
                <strong>{EGG_LABEL[egg.kind][0].toUpperCase() + EGG_LABEL[egg.kind].slice(1)}</strong>
                <span className="mq-pips" aria-label={`${had} of ${need} days`}>
                  {Array.from({ length: need }, (_, i) => <span key={i} className={i < had ? 'is-on' : ''} />)}
                </span>
                <small>{ready ? (atSpot ? 'Ready, and this is the place!' : `Ready! It wants ${spot.wants}: ${spot.place}.`) : `Keep playing on different days. ${need - had} to go.`}{egg.warmed ? ' Warmed.' : ''}</small>
              </div>
              {ready && atSpot && (
                <button type="button" className="mb-btn mb-btn--primary" onClick={() => apply(hatchHere(world, map, egg.id, opts))}>Hatch</button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mb-empty">{q.eggs.length} of 3 eggs. A day of play is a day you answer at least one question. Eggs go cold after 4 days in a row with no battles.</p>
    </div>
  );
}

export function TinkerPage({ world, apply }: PageProps) {
  const q = questOf(world);
  return (
    <div className="mq">
      <BitsRow world={world} />
      <ul className="mq-recipes">
        {RECIPES.filter((r) => !r.needs || r.needs.every((f) => q.flags.includes(f)) || (r.flag && q.flags.includes(r.flag))).map((r) => {
          const can = canMake(q, r);
          const made = r.flag ? q.flags.includes(r.flag) : false;
          return (
            <li key={r.id} className="mq-recipe">
              <div>
                <strong>{r.name}</strong>
                <small>{made ? 'Made!' : r.anyBits ? `Any ${r.anyBits} bits` : describeBits(r.cost)}</small>
              </div>
              <button type="button" className="mb-btn" disabled={made || 'why' in can} onClick={() => apply(make(world, r.id))}>
                {made ? 'Made' : 'Make'}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mb-empty">Wild monsters drop bits when you win. Special parts from quests unlock more things to make.</p>
    </div>
  );
}

export function BoardPage({ world, apply, opts }: PageProps & { opts: QuestOptions }) {
  const jobs = boardToday(world, opts);
  return (
    <div className="mq">
      {opts.day && <p className="mq-spotted"><span aria-hidden="true">⭐ </span>{spottedNote(opts.day)}</p>}
      {!jobs.length && <p className="mb-empty">The board is empty right now.</p>}
      <ul className="mq-jobs">
        {jobs.map(({ job, n, done }, i) => (
          <li key={i} className={done ? 'is-done' : ''}>
            <span>{job.hint.replace('Notice board: ', '').replace('{left}', String(Math.max(0, (job.count ?? 1) - n)))}</span>
            {done ? <b>Done</b> : job.do === 'bring' ? (
              <button type="button" className="mb-btn" onClick={() => apply(handIn(world, opts))}>Hand in</button>
            ) : <small>{n} of {job.count ?? 1}</small>}
          </li>
        ))}
      </ul>
      <p className="mb-empty">New jobs every day.</p>
    </div>
  );
}
