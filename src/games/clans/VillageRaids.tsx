/**
 * Village Raids (docs/CLANS-PVP-PLAN.md; whole school since play anyone stage 5): pick a rival (the three closest in
 * strength are shown big, with a traffic light; then my class, then the rest of the school with a search), answer the
 * siege question, watch the siege, then the heroes fight (Fight.tsx). This week's whole-school Banners board sits beside
 * the rivals. Display only: the rules are shared/clans/raids.ts, and the server (or, on the test page, the very
 * same rules in places.ts) decides everything. Clans are shown by name only, never a pupil.
 */
import { useEffect, useState } from 'react';
import type { ShownFight } from '../../../shared/clans/actions';
import { CONFIG } from '../../../shared/clans/config';
import { BUILDING_NAMES, empireOf } from '../../../shared/clans/empire';
import { LIGHT_NAMES, type BoardRow, type Rival } from '../../../shared/clans/raids';
import { ClassTag, SchoolPlayerList } from '../../components/SchoolPlayerList';
import { bannerArt } from './art';
import { LadderAsk, type Asker } from './LadderAsk';
import { pretendRaidList } from './places';
import { Embers, RaidSiegeStage } from './RaidStage';
import type { Session } from './session';

/** How a raid start went: the open fight and the siege, or why not. */
export type RaidGo =
  | { ok: true; resumed: boolean; open: ShownFight; breach: number; tower: number; right: boolean | null }
  | { ok: false; say: string };

type Phase = { t: 'list' } | { t: 'ask'; rival: Rival } | { t: 'working' } | { t: 'siege'; rival: Rival; go: Extract<RaidGo, { ok: true }>; skipped: boolean };

const pct = (x: number) => Math.round(x * 100);
const R = CONFIG.classRaids;

export function VillageRaids({ session, ask, onStart, onFight, onBack, onDuels }: {
  session: Session;
  /** With a server: send an action and get its answer. Without one (the test page), pretend classmates stand in. */
  ask?: Asker;
  onStart: (target: string) => Promise<RaidGo>;
  onFight: (open: ShownFight) => void;
  onBack: () => void;
  /** Over to the Duel Arena (live duels with classmates). */
  onDuels?: () => void;
}) {
  const [list, setList] = useState<{ targets: Rival[]; board: BoardRow[]; left: number } | null>(null);
  const [failed, setFailed] = useState('');
  const [say, setSay] = useState('');
  const [phase, setPhase] = useState<Phase>({ t: 'list' });
  const raidsOn = session.raidsOn !== false;
  const e = empireOf(session.clan);

  const load = () => {
    setFailed('');
    if (!ask) return setList(pretendRaidList(session));
    ask({ type: 'raidTargets' }).then(
      (reply) => {
        if (reply.ok && reply.result.type === 'raidTargets') setList({ targets: reply.result.targets, board: reply.result.board, left: reply.result.left });
        else setFailed(reply.ok ? 'We could not get the list.' : reply.say);
      },
      () => setFailed("We couldn't reach the server for the list. Please try again."),
    );
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [ask ? 0 : session]);

  const begin = async (rival: Rival, skipped: boolean) => {
    setPhase({ t: 'working' });
    setSay('');
    const go = await onStart(rival.id).catch((): RaidGo => ({ ok: false, say: "We couldn't reach the server, so the raid didn't start. Please try again." }));
    if (!go.ok) {
      setSay(go.say);
      setPhase({ t: 'list' });
      return load();
    }
    if (go.resumed) return onFight(go.open);
    setPhase({ t: 'siege', rival, go, skipped });
  };
  const pick = (rival: Rival) => {
    if (ask) setPhase({ t: 'ask', rival });
    else void begin(rival, true);
  };

  if (phase.t === 'ask') {
    return (
      <section className="cq-place" aria-label="The siege question">
        <LadderAsk kind="raid" ask={ask!} title="Storm the walls!" note={`A right answer makes your army hit ${pct(R.siege.rightBoost - 1)}% harder. No timer, nothing lost.`}
          onDone={() => void begin(phase.rival, false)} onSkip={() => void begin(phase.rival, true)} />
      </section>
    );
  }
  if (phase.t === 'working') return <section className="cq-place cq-march" aria-label="Village Raids"><p role="status"><span aria-hidden="true">⚔️</span> Marching to the village…</p></section>;
  if (phase.t === 'siege') return <RaidSiegeStage name={phase.rival.name} breach={phase.go.breach} tower={phase.go.tower} right={phase.go.right} skipped={phase.skipped} onFight={() => onFight(phase.go.open)} />;

  const left = list?.left ?? Math.max(0, R.perDay - e.raidsToday);
  const suggested = list?.targets.filter((t) => t.suggested) ?? [];
  const others = list?.targets.filter((t) => !t.suggested) ?? [];
  const rival = (t: Rival, big: boolean) => (
    <>
      {big && bannerArt(t.name) && <img className="cq-rival__banner" src={bannerArt(t.name)} alt="" />}
      <span className="cq-rival__name">{t.name}<ClassTag player={t} /></span>
      <span className={`cq-light cq-light--${t.light}`}>{LIGHT_NAMES[t.light]}</span>
      <button type="button" className={big ? 'cq-btn cq-btn--hot' : 'cq-btn'} disabled={t.raided || left === 0} onClick={() => pick(t)} aria-label={`Raid the ${t.name} clan (${LIGHT_NAMES[t.light]})`}>
        {t.raided ? 'Raided today' : 'Raid!'}
      </button>
    </>
  );
  const rivalClass = (t: Rival, big: boolean) => `cq-rival cq-rival--${t.light} ${big ? 'cq-rival--big' : ''} ${t.raided ? 'is-raided' : ''}`;

  let body: React.ReactNode;
  if (!raidsOn) body = <p className="cq-panel" role="status">Your teacher has switched Village Raids off for now. You can still raid the computer kingdoms.</p>;
  else if (failed) {
    body = (
      <div className="cq-panel" role="alert">
        <p>{failed}</p>
        <button type="button" className="cq-btn cq-btn--hot" onClick={load}>Try again</button>
      </div>
    );
  } else if (!list) body = <p role="status">Looking for villages…</p>;
  else {
    body = (
      <div className="cq-raids">
        <Embers />
        <div className="cq-panel cq-raids__rivals">
          <h3>{left > 0 ? `Pick a village to raid: ${left} ${left === 1 ? 'raid' : 'raids'} left today` : `That's all ${R.perDay} raids for today. Come back tomorrow!`}</h3>
          {list.targets.length === 0 ? <p>There are no other clans to raid yet.</p> : (
            <>
              <ul className="cq-rivals">{suggested.map((t) => <li key={t.id} className={rivalClass(t, true)}>{rival(t, true)}</li>)}</ul>
              {others.length > 0 && (
                <details className="cq-rivals__more">
                  <summary>More villages to raid ({others.length})</summary>
                  <SchoolPlayerList
                    people={others}
                    label="More villages to raid"
                    searchLabel="Find a clan or class"
                    listClassName="cq-rivals cq-rivals--small"
                    row={(t) => <div className={rivalClass(t, false)}>{rival(t, false)}</div>}
                  />
                </details>
              )}
            </>
          )}
          {say && <p className="cq-warn" role="alert">{say}</p>}
          <p className="cq-soft"><strong>Nobody loses anything.</strong> A win earns {R.reward.won.gold} gold and {R.reward.won.banners} Banners ({R.reward.wonTough.gold} and {R.reward.wonTough.banners} against a Tough one); a loss still earns {R.reward.lost.gold} gold and {R.reward.lost.banners} Banner. When your village holds off a raid, you earn {R.reward.held.gold} gold and {R.reward.held.banners} Banners.</p>
          <p className="cq-soft">Your {BUILDING_NAMES.forge} and army break their walls. Their {BUILDING_NAMES.walls} and {BUILDING_NAMES.tower} fight back. Your {BUILDING_NAMES.strongroom} adds gold to every raid.</p>
        </div>
        <div className="cq-panel cq-raids__board">
          <h3>Banners this week</h3>
          <ol className="cq-board">
            {list.board.map((r, i) => (
              <li key={`${r.place}-${r.name}`} className={r.me ? 'is-me' : undefined} style={{ '--i': i } as React.CSSProperties}>
                <span className="cq-board__place">{r.place}</span>
                <span className="cq-board__name">{r.name}{r.me ? ' (you)' : ''}</span>
                <span className="cq-board__count">{r.banners} {r.banners === 1 ? 'Banner' : 'Banners'}</span>
              </li>
            ))}
          </ol>
          <p className="cq-soft">The top clans in the whole school. The board starts again every Monday.</p>
        </div>
      </div>
    );
  }

  return (
    <section className="cq-place" aria-label="Village Raids">
      <div className="cq-place__head">
        <h2>Village Raids</h2>
        {onDuels && <button type="button" className="cq-btn cq-btn--hot" onClick={onDuels}>⚔️ Live duels</button>}
        <button type="button" className="cq-btn" onClick={onBack}>Back to My Village</button>
      </div>
      {body}
    </section>
  );
}
