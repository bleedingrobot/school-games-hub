import { useState } from 'react';
import { CONFIG } from '../../../shared/clans/config';
import { KINGDOMS, PUSHES, PUSH_NAMES, TROOP_NAMES, empireOf, kingdomById, might, type Kingdom, type Push } from '../../../shared/clans/empire';
import { lootShare } from '../../../shared/clans/moments';
import { TROOP_KINDS, type Troops } from '../../../shared/clans/types';
import { Bar } from './Bars';
import { Moment } from './Moment';
import { kingdomScene, sceneArt } from './art';
import { LIGHT_WORDS, kingdomLight } from './nextStep';
import { canRaid, sendArmy, type WarDone } from './places';
import type { Session, Change } from './session';

const B = CONFIG.empire.battle;
export const PUSH_HELP = {
  careful: 'Your troops hit softer, but fewer of them are hurt.',
  steady: 'A bit of both. A good choice to start with.',
  bold: 'Your troops hit harder, but more of them are hurt.',
} as const;

type Phase = { t: 'plan' } | { t: 'loot'; kingdom: Kingdom } | { t: 'result'; kingdom: Kingdom; war: WarDone };

const troopList = (t: Troops) => {
  const bits = TROOP_KINDS.filter((k) => t[k] > 0).map((k) => `${t[k]} ${t[k] === 1 ? TROOP_NAMES[k].one : TROOP_NAMES[k].many}`);
  return bits.length ? bits.join(', ') : 'none';
};

/** The words for how a battle ended. Nobody is hurt in the story: it is about the armies giving way. */
const ENDING = {
  won: { title: 'The defenders give way!', text: 'Your army won the day.' },
  lost: { title: 'Your army falls back', text: 'The defenders held, so your army heads home to try again.' },
  stalemate: { title: 'A stalemate', text: 'Neither side gave way, so nobody won.' },
} as const;

/** A wide painting (a kingdom, or the battlefield), the 800 copy on phones. Decoration: the words say the same. */
function Wide({ art, id, sizes = '(max-width: 760px) 100vw, 360px' }: { art: { wide?: string; small?: string }; id: string; sizes?: string }) {
  if (!art.wide) return null;
  return <img className="cq-wide-art" src={art.wide} srcSet={art.small && art.small !== art.wide ? `${art.small} 800w, ${art.wide} 1600w` : undefined} sizes={sizes} alt="" data-art={id} />;
}

/** Raid a kingdom, or have a Practice battle with it: pick the kingdom, make the battle plan, see how it went. */
export function Raid({ session, onChange, onBack }: { session: Session; onChange: Change; onBack: () => void }) {
  const { clan, settings } = session;
  const e = empireOf(clan);
  const [phase, setPhase] = useState<Phase>({ t: 'plan' });
  const [kingdomId, setKingdomId] = useState(KINGDOMS[0].id);
  const [push, setPush] = useState<Push>('steady');
  const kingdom = kingdomById(kingdomId)!;
  const noRaid = canRaid(session);
  const army = might(e.troops);

  const go = (k: Kingdom, friendly: boolean) => {
    const war = sendArmy(session, k.id, push, friendly);
    if ('ok' in war) return;
    onChange(war.session, { type: friendly ? 'war' : 'raid', kingdom: k.id, push });
    setPhase({ t: 'result', kingdom: k, war });
  };
  const startRaid = () => {
    if (lootShare(settings, kingdom.treasury, B.loot)) setPhase({ t: 'loot', kingdom });
    else go(kingdom, false);
  };

  let body: React.ReactNode;
  if (phase.t === 'loot') {
    const q = lootShare(settings, phase.kingdom.treasury, B.loot)!;
    body = <Moment key="loot" question={q} title="How much loot?" note={`${phase.kingdom.name} has ${phase.kingdom.treasury} gold in its treasury. A win takes ${B.loot}%.`} doneLabel="Send the army!" onDone={() => go(phase.kingdom, false)} />;
  } else if (phase.t === 'result') {
    const { war, kingdom: k } = phase;
    const r = war.result;
    const end = ENDING[r.outcome];
    body = (
      <div className="cq-panel cq-war" role="group" aria-label="How it went">
        <Wide art={war.friendly ? sceneArt('battlefield') : kingdomScene(k.id)} id={war.friendly ? 'battlefield' : k.id} sizes="(max-width: 1100px) 100vw, 1100px" />
        <h3>{war.friendly ? 'Practice battle' : 'Raid'} on {k.name}: {end.title}</h3>
        <p>{end.text}</p>
        {war.friendly ? (
          <p className="cq-note">This was only practice. Nobody lost anything and nobody won anything, and it did not use up today's raid.</p>
        ) : (
          <>
            <p role="status">{r.outcome === 'won' ? <>You won <strong>{war.gold} gold</strong> of loot. It is in your purse.</> : 'You did not win any loot this time.'}</p>
            <p>Troops that did not come home: {troopList(r.attackerLost)}.</p>
          </>
        )}
        <p className="cq-soft">Strength left after each round (you start with {r.startAttacker}, they start with {r.startDefender}):</p>
        <ol className="cq-rounds">
          {r.rounds.map((rd) => (
            <li key={rd.round}>
              <Bar label={`Round ${rd.round}: your army`} value={rd.attacker} max={r.startAttacker} kind="hp" />
              <Bar label={`Round ${rd.round}: ${k.name}`} value={rd.defender} max={r.startDefender} kind="sp" />
            </li>
          ))}
        </ol>
        <div className="cq-actions"><button type="button" className="cq-btn cq-btn--hot" autoFocus onClick={() => setPhase({ t: 'plan' })}>Carry on</button></div>
      </div>
    );
  } else {
    body = (
      <div className="cq-land">
        <div className="cq-panel">
          <h3>Pick a kingdom</h3>
          <ul className="cq-kingdoms">
            {KINGDOMS.map((k) => (
              <li key={k.id}>
                <button type="button" className="cq-btn" aria-pressed={kingdomId === k.id} onClick={() => setKingdomId(k.id)}>{k.name}: {k.feel} <span className="cq-soft">({LIGHT_WORDS[kingdomLight(army, k)]})</span></button>
              </li>
            ))}
          </ul>
          <Wide key={kingdom.id} art={kingdomScene(kingdom.id)} id={kingdom.id} />
          <p><strong>{kingdom.name}</strong> is {kingdom.feel}. {kingdom.blurb} It keeps about {kingdom.treasury} gold in its treasury.</p>
        </div>
        <div className="cq-panel">
          <h3>The battle plan</h3>
          <p className="cq-soft">Your army: {troopList(e.troops)} (strength {army}). The battle is {B.rounds} rounds. A win takes {B.loot}% of what the kingdom keeps in its treasury.</p>
          <div className="cq-sides" role="group" aria-label="How hard">{PUSHES.map((p) => <button key={p} type="button" className="cq-btn" aria-pressed={push === p} onClick={() => setPush(p)}>{PUSH_NAMES[p]}</button>)}</div>
          <p className="cq-soft">{PUSH_NAMES[push]}: {PUSH_HELP[push]}</p>
        </div>
        <div className="cq-panel">
          <h3>Send the army</h3>
          <div className="cq-actions">
            <button type="button" className="cq-btn cq-btn--hot" disabled={noRaid !== null} onClick={startRaid}>Raid {kingdom.name}</button>
            <button type="button" className="cq-btn" disabled={army === 0} onClick={() => go(kingdom, true)}>Practice battle with {kingdom.name}</button>
          </div>
          {noRaid && <p className="cq-warn">{noRaid}</p>}
          <p className="cq-soft">A raid can win gold, but some troops don't come home. You can raid once a day. A practice battle is only for practice: nothing is won or lost, and it doesn't use up your raid.</p>
        </div>
      </div>
    );
  }

  return (
    <section className="cq-place" aria-label="Raid a kingdom">
      <div className="cq-place__head">
        <h2>Raid a kingdom</h2>
        <button type="button" className="cq-btn" onClick={onBack}>Back to My Village</button>
      </div>
      {body}
    </section>
  );
}
