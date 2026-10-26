import { useEffect, useState } from 'react';
import type { Action } from '../../../shared/clans/actions';
import { CONFIG } from '../../../shared/clans/config';
import { PUSHES, PUSH_NAMES, TROOP_NAMES, empireOf, might, type BattlePlan, type BattleResult, type Take } from '../../../shared/clans/empire';
import { TROOP_KINDS, type BuildingKind, type Troops } from '../../../shared/clans/types';
import type { TargetEntry } from '../../../shared/clans/village';
import { Bar } from './Bars';
import { pretendRaid, pretendTargets } from './places';
import type { ServerReply } from './remote';
import type { Session } from './session';
import { bannerArt } from './art';

const B = CONFIG.empire.battle;
const LOOTS = B.lootChoices.filter((n) => n <= CONFIG.empire.raids.classmateLootMax);
const ROUNDS = Array.from({ length: B.maxRounds }, (_, i) => i + 1);
const TAKES: { take: Take; label: string; help: string }[] = [
  { take: 'gold', label: 'Gold', help: 'a share of the gold in their vault' },
  { take: 'land', label: 'Land', help: 'a share of their empty land' },
  { take: 'buildings', label: 'Buildings', help: 'knock some of their buildings down (walls keep them safe)' },
];
const PUSH_HELP = { careful: 'hits softer, but takes less', steady: 'in the middle', bold: 'hits harder, but takes more' } as const;
const ENDING = {
  won: { title: 'The defenders give way!', text: 'Your army won the day.' },
  lost: { title: 'Your army falls back', text: 'The defenders held, so your army heads home.' },
  stalemate: { title: 'A stalemate', text: 'Neither side gave way, so nobody won.' },
} as const;

const troopList = (t: Troops) => {
  const bits = TROOP_KINDS.filter((k) => t[k] > 0).map((k) => `${t[k]} ${t[k] === 1 ? TROOP_NAMES[k].one : TROOP_NAMES[k].many}`);
  return bits.length ? bits.join(', ') : 'none';
};

interface Done { name: string; take: Take; result: BattleResult; gold: number; land: number; destroyed: BuildingKind[] }

/**
 * Raid a classmate in your village. The server says who is allowed (and why not for the rest), and does the raid. On the
 * test page (no server) a pretend list stands in, using the very same rules. Names are clan names only.
 */
export function ClassRaid({ session, ask, onSession, onBack }: {
  session: Session;
  /** With a server: send an action and get its answer. Without one, the pretend raid is used. */
  ask?: (action: Action) => Promise<ServerReply>;
  onSession: (s: Session) => void;
  onBack: () => void;
}) {
  const [targets, setTargets] = useState<TargetEntry[] | null>(null);
  const [failed, setFailed] = useState('');
  const [pick, setPick] = useState('');
  const [take, setTake] = useState<Take>('gold');
  const [plan, setPlan] = useState<BattlePlan>({ rounds: 3, push: 'steady', loot: LOOTS[LOOTS.length - 1] });
  const [done, setDone] = useState<Done | null>(null);
  const [say, setSay] = useState('');
  const [busy, setBusy] = useState(false);
  const army = might(empireOf(session.clan).troops);
  const raidsOn = session.raidsOn !== false;

  const load = () => {
    setFailed('');
    if (!ask) {
      setTargets(pretendTargets(session));
      return;
    }
    ask({ type: 'raidTargets' }).then(
      (reply) => {
        if (reply.ok && reply.result.type === 'raidTargets') setTargets(reply.result.targets);
        else setFailed(reply.ok ? 'We could not get the list.' : reply.say);
      },
      () => setFailed("We couldn't reach the server for the list. Please try again."),
    );
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);
  const first = targets?.find((t) => t.allowed);
  const chosen = targets?.find((t) => t.id === pick) ?? first ?? null;

  const send = () => {
    if (!chosen || !chosen.allowed || busy) return;
    setBusy(true);
    setSay('');
    if (!ask) {
      const out = pretendRaid(session, chosen.id, take, plan);
      setBusy(false);
      if ('ok' in out) return setSay(out.say);
      onSession(out.session);
      setDone({ name: chosen.name, take, result: out.result, gold: out.gold, land: out.land, destroyed: out.destroyed });
      setTargets(null);
      return;
    }
    ask({ type: 'raidClass', target: chosen.id, take, plan }).then(
      (reply) => {
        setBusy(false);
        if (reply.ok && reply.result.type === 'raidClass') {
          const r = reply.result;
          setDone({ name: chosen.name, take: r.take, result: r.result, gold: r.gold, land: r.land, destroyed: r.destroyed });
          setTargets(null);
        } else if (!reply.ok) {
          setSay(reply.say);
          load();
        }
      },
      () => { setBusy(false); setSay("We couldn't reach the server, so the raid didn't go out. Please try again."); },
    );
  };

  let body: React.ReactNode;
  if (done) {
    const r = done.result;
    const end = ENDING[r.outcome];
    const prize = r.outcome !== 'won' ? 'You did not win anything this time.'
      : done.take === 'gold' ? `You took ${done.gold} gold. It is in your vault.`
      : done.take === 'land' ? `You took ${done.land} ${done.land === 1 ? 'plot' : 'plots'} of land.`
      : `You knocked down ${done.destroyed.length} ${done.destroyed.length === 1 ? 'building' : 'buildings'}.`;
    body = (
      <div className="cq-panel cq-war" role="group" aria-label="How it went">
        <h3>Raid on the {done.name} clan: {end.title}</h3>
        <p>{end.text}</p>
        <p role="status">{prize}</p>
        <p>Troops that did not come home: {troopList(r.attackerLost)}. They lost some too.</p>
        <p className="cq-soft">They will read about it in the village news, and their clan rests behind a shield for a day.</p>
        <ol className="cq-rounds">
          {r.rounds.map((rd) => (
            <li key={rd.round}>
              <Bar label={`Round ${rd.round}: your army`} value={rd.attacker} max={r.startAttacker} kind="hp" />
              <Bar label={`Round ${rd.round}: ${done.name}`} value={rd.defender} max={r.startDefender} kind="sp" />
            </li>
          ))}
        </ol>
        <div className="cq-actions"><button type="button" className="cq-btn cq-btn--hot" autoFocus onClick={() => { setDone(null); load(); }}>Carry on</button></div>
      </div>
    );
  } else if (!raidsOn) {
    body = <p className="cq-panel" role="status">Your teacher has switched raids on classmates off for now. You can still raid the computer kingdoms.</p>;
  } else if (failed) {
    body = (
      <div className="cq-panel" role="alert">
        <p>{failed}</p>
        <button type="button" className="cq-btn cq-btn--hot" onClick={load}>Try again</button>
      </div>
    );
  } else if (!targets) {
    body = <p role="status">Looking at your village…</p>;
  } else {
    body = (
      <div className="cq-land">
        <div className="cq-panel">
          <h3>Pick a clan in your village</h3>
          {targets.length === 0 ? <p>There are no other clans in your village yet.</p> : (
            <ul className="cq-kingdoms">
              {targets.map((t) => (
                <li key={t.id}>
                  <button type="button" className="cq-btn" disabled={!t.allowed} aria-pressed={chosen?.id === t.id} onClick={() => setPick(t.id)}>
                    {bannerArt(t.name) && <img className="cq-rowbanner" src={bannerArt(t.name)} alt="" />}{t.name}{t.allowed ? ': a fair match' : ''}
                  </button>
                  {!t.allowed && <span className="cq-soft"> {t.say}</span>}
                </li>
              ))}
            </ul>
          )}
          <p className="cq-soft">You can only raid a clan whose army is about the same size as yours. Nobody is named: you see clans, not people.</p>
        </div>
        <div className="cq-panel">
          <h3>What to go for</h3>
          <div className="cq-sides" role="group" aria-label="What to take">
            {TAKES.map((t) => <button key={t.take} type="button" className="cq-btn" aria-pressed={take === t.take} onClick={() => setTake(t.take)}>{t.label}</button>)}
          </div>
          <p className="cq-soft">{TAKES.find((t) => t.take === take)!.help}.</p>
          <h3>The battle plan</h3>
          <p className="cq-soft">Your army: {troopList(empireOf(session.clan).troops)} (strength {army}).</p>
          <div className="cq-sides" role="group" aria-label="Rounds">Rounds {ROUNDS.map((n) => <button key={n} type="button" className="cq-btn" aria-pressed={plan.rounds === n} aria-label={`${n} ${n === 1 ? 'round' : 'rounds'}`} onClick={() => setPlan({ ...plan, rounds: n })}>{n}</button>)}</div>
          <div className="cq-sides" role="group" aria-label="How hard">How hard {PUSHES.map((p) => <button key={p} type="button" className="cq-btn" aria-pressed={plan.push === p} onClick={() => setPlan({ ...plan, push: p })}>{PUSH_NAMES[p]}</button>)}</div>
          <p className="cq-soft">{PUSH_NAMES[plan.push]}: {PUSH_HELP[plan.push]}.</p>
          <div className="cq-sides" role="group" aria-label="Loot">Share you ask for {LOOTS.map((n) => <button key={n} type="button" className="cq-btn" aria-pressed={plan.loot === n} aria-label={`Ask for ${n} percent`} onClick={() => setPlan({ ...plan, loot: n })}>{n}%</button>)}</div>
          <p className="cq-soft">Raids on classmates take at most {CONFIG.empire.raids.classmateLootMax}%. You can raid a classmate once a day.</p>
        </div>
        <div className="cq-panel">
          <h3>Send the army</h3>
          <div className="cq-actions">
            <button type="button" className="cq-btn cq-btn--hot" disabled={!chosen || !chosen.allowed || busy || army === 0} onClick={send}>
              {chosen ? `Raid the ${chosen.name} clan` : 'Pick a clan first'}
            </button>
          </div>
          {army === 0 && <p className="cq-warn">You need some troops to send.</p>}
          {say && <p className="cq-warn" role="alert">{say}</p>}
          <p className="cq-soft">If you win, you take the share you asked for. Some troops on both sides don't come home. New clans are safe for three days, and a clan that was just raided gets a day's shield.</p>
        </div>
      </div>
    );
  }

  return (
    <section className="cq-place" aria-label="Raid a classmate">
      <div className="cq-place__head">
        <h2>Raid a classmate</h2>
        <button type="button" className="cq-btn" onClick={onBack}>Back to the empire</button>
      </div>
      {body}
    </section>
  );
}
