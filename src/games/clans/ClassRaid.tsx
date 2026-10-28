import { useEffect, useState } from 'react';
import type { Action } from '../../../shared/clans/actions';
import { CONFIG } from '../../../shared/clans/config';
import { BUILDING_NAMES, PUSHES, PUSH_NAMES, TROOP_NAMES, empireOf, might, type BattleResult, type Push, type Take } from '../../../shared/clans/empire';
import { TROOP_KINDS, type Troops, type VillageBuilding } from '../../../shared/clans/types';
import { Bar } from './Bars';
import { pretendRaid, pretendTargets, type RaidChoice } from './places';
import { PUSH_HELP } from './Raid';
import { shieldEnds } from './shield';
import type { ServerReply } from './remote';
import type { Session } from './session';
import { bannerArt } from './art';

const MAX_TAKE = CONFIG.empire.raids.classmateLootMax;
const TAKES: { take: Take; label: string; help: string }[] = [
  { take: 'gold', label: 'Gold', help: `a small share (up to ${MAX_TAKE}%) of the gold in their purse that is not safe in their Strongroom` },
  { take: 'buildings', label: 'Buildings', help: 'knock a level or two off their buildings (Walls keep them safe, and so does the Strongroom)' },
];
const ENDING = {
  won: { title: 'The defenders give way!', text: 'Your army won the day.' },
  lost: { title: 'Your army falls back', text: 'The defenders held, so your army heads home.' },
  stalemate: { title: 'A stalemate', text: 'Neither side gave way, so nobody won.' },
} as const;

const troopList = (t: Troops) => {
  const bits = TROOP_KINDS.filter((k) => t[k] > 0).map((k) => `${t[k]} ${t[k] === 1 ? TROOP_NAMES[k].one : TROOP_NAMES[k].many}`);
  return bits.length ? bits.join(', ') : 'none';
};

interface Done { name: string; take: Take; result: BattleResult; gold: number; destroyed: VillageBuilding[] }

/**
 * Raid a classmate in your class. The server says who is allowed (and why not for the rest), and does the raid. On the
 * test page (no server) a pretend list stands in, using the very same rules. Names are clan names only.
 */
export function ClassRaid({ session, ask, onSession, onBack }: {
  session: Session;
  /** With a server: send an action and get its answer. Without one, the pretend raid is used. */
  ask?: (action: Action) => Promise<ServerReply>;
  onSession: (s: Session) => void;
  onBack: () => void;
}) {
  const [targets, setTargets] = useState<RaidChoice[] | null>(null);
  const [failed, setFailed] = useState('');
  const [pick, setPick] = useState('');
  const [take, setTake] = useState<Take>('gold');
  const [push, setPush] = useState<Push>('steady');
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
      const out = pretendRaid(session, chosen.id, take, push);
      setBusy(false);
      if ('ok' in out) return setSay(out.say);
      onSession(out.session);
      setDone({ name: chosen.name, take, result: out.result, gold: out.gold, destroyed: out.destroyed });
      setTargets(null);
      return;
    }
    ask({ type: 'raidClass', target: chosen.id, take, push }).then(
      (reply) => {
        setBusy(false);
        if (reply.ok && reply.result.type === 'raidClass') {
          const r = reply.result;
          setDone({ name: chosen.name, take: r.take, result: r.result, gold: r.gold, destroyed: r.destroyed });
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
      : done.take === 'gold' ? `You took ${done.gold} gold. It is in your purse.`
      : done.destroyed.length === 0 ? 'Their buildings were too strong to knock any down.'
      : `You knocked ${done.destroyed.length} ${done.destroyed.length === 1 ? 'level' : 'levels'} off their buildings: ${done.destroyed.map((b) => BUILDING_NAMES[b]).join(', ')}.`;
    body = (
      <div className="cq-panel cq-war" role="group" aria-label="How it went">
        <h3>Raid on the {done.name} clan: {end.title}</h3>
        <p>{end.text}</p>
        <p role="status">{prize}</p>
        <p>Troops that did not come home: {troopList(r.attackerLost)}. They lost some too.</p>
        <p className="cq-soft">They will read about it in the news, and their clan now rests behind a shield for a day.</p>
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
    body = <p role="status">Looking at your class…</p>;
  } else {
    body = (
      <div className="cq-land">
        <div className="cq-panel">
          <h3>Pick a clan in your class</h3>
          {targets.length === 0 ? <p>There are no other clans in your class yet.</p> : (
            <ul className="cq-kingdoms">
              {targets.map((t) => (
                <li key={t.id}>
                  <button type="button" className="cq-btn" disabled={!t.allowed} aria-pressed={chosen?.id === t.id} onClick={() => setPick(t.id)}>
                    {bannerArt(t.name) && <img className="cq-rowbanner" src={bannerArt(t.name)} alt="" />}{t.name}{t.allowed ? ': a fair match' : ''}
                  </button>
                  {!t.allowed && <span className="cq-soft"> {t.say}{t.shieldUntil ? ` Safe from raids until ${shieldEnds(t.shieldUntil)}.` : ''}</span>}
                </li>
              ))}
            </ul>
          )}
          <p className="cq-soft">You can raid <strong>one classmate a day</strong>, and a clan that was raided rests behind a shield the next day too. You can only raid a clan whose army is about the same size as yours. Nobody is named: you see clans, not people.</p>
        </div>
        <div className="cq-panel">
          <h3>What to go for</h3>
          <div className="cq-sides" role="group" aria-label="What to take">
            {TAKES.map((t) => <button key={t.take} type="button" className="cq-btn" aria-pressed={take === t.take} onClick={() => setTake(t.take)}>{t.label}</button>)}
          </div>
          <p className="cq-soft">{TAKES.find((t) => t.take === take)!.help}.</p>
          <h3>The battle plan</h3>
          <p className="cq-soft">Your army: {troopList(empireOf(session.clan).troops)} (strength {army}).</p>
          <div className="cq-sides" role="group" aria-label="How hard">{PUSHES.map((p) => <button key={p} type="button" className="cq-btn" aria-pressed={push === p} onClick={() => setPush(p)}>{PUSH_NAMES[p]}</button>)}</div>
          <p className="cq-soft">{PUSH_NAMES[push]}: {PUSH_HELP[push]}</p>
          <p className="cq-soft">A raid on a classmate takes at most {MAX_TAKE}%.</p>
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
          <p className="cq-soft">If you win, you take your pick: gold or buildings. Some troops on both sides don't come home. New clans are safe for three days.</p>
        </div>
      </div>
    );
  }

  return (
    <section className="cq-place" aria-label="Raid a classmate">
      <div className="cq-place__head">
        <h2>Raid a classmate</h2>
        <button type="button" className="cq-btn" onClick={onBack}>Back to My Village</button>
      </div>
      {body}
    </section>
  );
}
