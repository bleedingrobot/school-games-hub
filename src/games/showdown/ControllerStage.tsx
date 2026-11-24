/**
 * The right-hand side of a pupil's screen (James, 24 Nov 2026): the boss (or the Gold Rush mine), its health bar and what
 * is happening now (shield checks, weak spots, golden questions...), next to the question on the left. On a phone held
 * upright it is a short strip above the question. It only reads the room's view, so it never shows anyone's results.
 */
import { bossInfo } from '../../../shared/showdown/bosses';
import { arenaWords, rolesNeeded } from './arenaWords';
import type { RoomView } from '../../../shared/showdown/server';
import type { Role, ShowdownEvent, TeamId } from '../../../shared/showdown/types';
import { TREASURE } from './treasures';

const paintings = import.meta.glob('./art/paint/**/*.webp', { eager: true, import: 'default' }) as Record<string, string>;
const art = (folder: string, name: string) => paintings[`./art/paint/${folder}/${name}.webp`] ?? paintings[`./art/paint/${folder}/${name}-800.webp`];
const TEAM: Record<TeamId, string> = { red: 'Red', blue: 'Blue', gold: 'Gold', green: 'Green' };

/** What the pupil's last answer did, for the iPad's own animation: a strike flying at the boss, a shield going up, a heal. */
export interface StageAct {
  seq: number;
  right: boolean;
  role: Role;
  damage: number;
  times: number;
  weak: boolean;
  golden: boolean;
  streak: number;
  /** Gold Rush: the seam dug. */
  seam?: number;
  /** A Healer woke someone up with this answer. */
  woke: boolean;
}

export function actFrom(prev: StageAct | null, right: boolean, events: ShowdownEvent[], me: string, role: Role): StageAct {
  const hit = events.find((e): e is Extract<ShowdownEvent, { type: 'hit' }> => e.type === 'hit' && e.pupil === me);
  return {
    seq: (prev?.seq ?? 0) + 1,
    right,
    role: hit?.role ?? role,
    // The points it scored (what the big screen shows too); the raw damage is too small a number to feel like a hit.
    damage: hit?.points ?? 0,
    times: hit?.times ?? 1,
    weak: !!hit?.weakSpot,
    golden: !!hit?.golden,
    streak: hit?.streak ?? 0,
    seam: hit?.seam,
    woke: events.some((e) => e.type === 'revive' && e.pupil === me),
  };
}

type Notice = { key: string; text: string; tone: 'alarm' | 'good' | 'gold' | 'info' };

/** What is happening right now, most urgent first, in the arena's own words. */
export function noticesFor(view: RoomView, t: number, team: TeamId | null, me: string, myRole: Role | null = null): Notice[] {
  const W = arenaWords(view.arena);
  const N = W.notices;
  const out: Notice[] = [];
  if (view.pausedAt) out.push({ key: 'pause', text: '⏸ Paused. Look at the teacher.', tone: 'info' });
  // The roles the class (or my team) is short of, the same call as the big screen's, so pupils see it on their own iPad.
  if (view.mode !== 'solo' && view.state !== 'over') {
    const canSwap = view.state === 'lobby' || view.roleSwapUntil > t;
    const who = team && view.mode !== 'class' ? `${TEAM[team]} needs` : 'We need';
    for (const role of rolesNeeded(view.roles?.[team && view.mode !== 'class' ? team : 'all'])) {
      if (myRole === role) continue;
      const name = W.roles[role].name;
      out.push({ key: `need-${role}`, text: `${W.roles[role].emoji} ${who} ${role === 'guard' ? `more ${name}s` : `a ${name}`}!${canSwap ? ` Tap your role to be one.` : ''}`, tone: 'alarm' });
    }
  }
  if (view.state === 'lobby') {
    out.push({ key: 'lobby', text: view.arena === 'goldrush' ? '⛏ Grab your pickaxe! Waiting for the teacher…' : view.arena === 'skyclimb' ? '🧗 Rope on! Waiting for the teacher…' : view.arena === 'island' ? '🏝️ Find a spot on the island! Waiting for the teacher…' : view.arena === 'hill' ? '👑 Up the hill! Waiting for the teacher…' : view.arena === 'auction' ? '🪙 The auction is about to open! Waiting for the teacher…' : `${bossInfo(view.bossId).roar} Waiting for the teacher…`, tone: 'info' });
    return out;
  }
  const mySpot = view.island?.spots[me];
  if (view.state === 'live' && mySpot && mySpot[2] > 0) out.push({ key: 'rock', text: `🪨 You're on a rock! Right answers swim you back (${mySpot[2] - 1}/2)`, tone: 'alarm' });
  const c = view.crown;
  if (view.state === 'live' && c) {
    const mine = c.holder !== null && (c.team ? c.holder === team : c.holder === me);
    if (mine) out.push({ key: 'crown', text: c.team ? `👑 ${TEAM[c.holder as TeamId]} wears the crown! Keep answering to keep it` : '👑 You wear the crown! Keep answering to keep it', tone: 'gold' });
    else if (c.holder === null && view.boss.hp < view.boss.max) out.push({ key: 'crown', text: '👑 The crown is up for grabs! Answer fast to take it', tone: 'gold' });
  }
  const lot = view.state === 'live' ? view.auction?.lot : null;
  if (lot && t < lot.endsAt) {
    const mine = lot.topBy === me;
    const ours = !mine && !!team && lot.topTeam === team;
    out.push({ key: 'lot', text: mine ? `🔨 You're the top bid! (${lot.top})` : ours ? `🔨 ${TEAM[team!]} leads the bidding!` : `🔔 ${TREASURE[lot.kind].name} for sale! Bid below`, tone: mine || ours ? 'good' : 'gold' });
  }
  const w = view.windUp;
  if (w && t < w.endsAt) {
    const g = w.groups[team ?? ''] ?? w.groups.all ?? w.groups[me];
    const secs = Math.max(0, Math.ceil((w.endsAt - t) / 1000));
    const held = g?.done === 'held';
    out.push({ key: 'wind', text: held ? N.heldNote : `${N.wind} ${secs}s${g ? ` · ${Math.min(g.got, g.needed)}/${g.needed}` : ''}`, tone: held ? 'good' : 'alarm' });
  }
  if (view.enrageUntil > t) out.push({ key: 'enrage', text: N.enrage, tone: 'alarm' });
  if (view.weakSpotUntil > t) out.push({ key: 'weak', text: N.weak, tone: 'gold' });
  if (view.goldenFrom !== null && t >= view.goldenFrom && t < view.goldenUntil) out.push({ key: 'golden', text: '⭐ Golden question time!', tone: 'gold' });
  if (view.finalStarted) out.push({ key: 'final', text: '⏱️ Final 30 seconds! Go go go!', tone: 'alarm' });
  if (view.mode === 'teams4' && team && view.facing === team && view.arena !== 'skyclimb' && view.arena !== 'hill' && view.arena !== 'auction') out.push({ key: 'facing', text: `👀 The boss is facing ${TEAM[team]}!`, tone: 'alarm' });
  if (view.mode === 'teams2' && team && Math.abs(view.tug) > 0.1 && (view.arena ?? 'boss') === 'boss') {
    const winning = (view.tug < 0 && team === 'red') || (view.tug > 0 && team === 'blue');
    out.push({ key: 'tug', text: winning ? `💪 ${TEAM[team]} is pushing the boss back!` : '⚠️ The boss is coming your way! Push!', tone: winning ? 'good' : 'alarm' });
  }
  if (view.boss.phase > 1 && !out.length) out.push({ key: 'phase', text: N.phase(view.boss.phase === 3 ? 3 : 2), tone: 'info' });
  if (!out.length) out.push({ key: 'calm', text: N.calm, tone: 'info' });
  // A shield check is the most urgent thing on the screen: first after a pause.
  const wi = out.findIndex((n) => n.key === 'wind');
  if (wi > 0) out.splice(view.pausedAt ? 1 : 0, 0, ...out.splice(wi, 1));
  return out;
}

export function ControllerStage({ view, t, hit, act = null, team, me, role = null, streak = 0, coins = 0, vault = 0, onBid, bidSaid = null }: { view: RoomView; t: number; hit: number; act?: StageAct | null; team: TeamId | null; me: string; role?: Role | null; streak?: number; coins?: number; vault?: number; onBid?: (amount: number) => void; bidSaid?: { text: string; good: boolean } | null }) {
  const boss = bossInfo(view.bossId);
  const W = arenaWords(view.arena);
  const gr = view.arena === 'goldrush';
  const sky = view.arena === 'skyclimb';
  const isle = view.arena === 'island';
  const hill = view.arena === 'hill';
  const auc = view.arena === 'auction';
  const back = gr ? art('back', 'gold-rush') : sky ? art('back', 'sky-climb') : isle ? art('back', 'shrinking-island') : hill ? art('back', 'king-hill') : auc ? art('back', 'auction-house') : art('back', boss.backdrop);
  const bossImg = gr || sky || isle || hill || auc ? null : art('bosses', `${view.bossId}-${view.boss.phase}`);
  const left = Math.max(0, Math.min(100, (view.boss.hp / Math.max(1, view.boss.max)) * 100));
  const pct = W.fills ? 100 - left : left;
  const name = W.goal ?? boss.name;
  const notices = noticesFor(view, t, team, me, role);
  const weak = view.weakSpotUntil > t;
  const wind = !!view.windUp && t < view.windUp.endsAt;
  const jumped = sky && hit > 0 && streak > 0 && streak % 3 === 0;
  return (
    <aside className={`sd-cs${gr ? ' sd-cs--gr' : ''}${sky ? ' sd-cs--sky' : ''}${isle ? ' sd-cs--isle' : ''}${hill ? ' sd-cs--hill' : ''}${auc ? ' sd-cs--auc' : ''}${weak ? ' sd-cs--weak' : ''}${wind ? ' sd-cs--wind' : ''}`} aria-label={gr ? 'The mine' : sky ? 'The climb' : isle ? 'The island' : hill ? 'The hill' : auc ? 'The auction' : 'The boss'}>
      <div className="sd-cs__scene">
        {back && <img className="sd-cs__back" src={back} alt="" aria-hidden="true" />}
        {gr ? (
          <div className="sd-cs__seams" aria-hidden="true">
            {view.seams.map((s) => {
              const img = art('goldrush', `seam-${s.kind}`);
              return (
                <span key={s.id} className={`sd-cs__seam sd-cs__seam--${s.kind}`} style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%` }}>
                  {img && <img src={img} alt="" />}
                  <i style={{ transform: `scaleX(${Math.max(0, s.left / Math.max(1, s.size))})` }} />
                </span>
              );
            })}
          </div>
        ) : sky ? (
          <SkyMini pct={pct} hit={hit} jumped={jumped} team={team} wind={wind} weak={weak} />
        ) : isle && view.island ? (
          <IsleMini island={view.island} me={me} hit={hit} pct={pct} wind={wind} weak={weak} team={team} />
        ) : hill && view.crown ? (
          <HillMini crown={view.crown} me={me} team={team} hit={hit} pct={pct} wind={wind} weak={weak} />
        ) : auc && view.auction ? (
          <AuctionMini auction={view.auction} me={me} team={team} hit={hit} t={t} wind={wind} weak={weak} />
        ) : bossImg ? (
          <BossMini img={bossImg} act={act} wind={wind} weak={weak} phase={view.boss.phase} />
        ) : null}
        {gr && act && <DigFx key={`d${act.seq}`} act={act} seam={view.seams.find((s) => s.id === act.seam) ?? null} />}
        {act && !gr && !bossImg && act.right && act.damage > 0 && <span key={`n${act.seq}`} className={`sd-cs__num sd-cs__num--soft${act.times > 1 ? ' sd-cs__num--big' : ''}`} aria-hidden="true">+{act.damage}</span>}
      </div>
      <div className="sd-cs__bar" role="progressbar" aria-label={W.fills ? name : `${name} health`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
        <span className="sd-cs__name">{name}</span>
        <span className="sd-cs__track"><i style={{ transform: `scaleX(${pct / 100})` }} /></span>
        <span className="sd-cs__pct">{W.fills ? Math.floor(pct) : Math.ceil(pct)}%</span>
      </div>
      {auc && view.state === 'live' && <BidPanel view={view} t={t} me={me} team={team} coins={coins} vault={vault} onBid={onBid} said={bidSaid} />}
      <ul className="sd-cs__notices" aria-live="polite">
        {notices.map((n) => <li key={n.key} className={`sd-cs__notice sd-cs__notice--${n.tone}`}>{n.text}</li>)}
      </ul>
    </aside>
  );
}

/** Sky Climb on the iPad: the cliff, the summit flag, and the pupil's climber on the rope at the class's height. */
function SkyMini({ pct, hit, jumped, team, wind, weak }: { pct: number; hit: number; jumped: boolean; team: TeamId | null; wind: boolean; weak: boolean }) {
  const climber = art('skyclimb', 'climber');
  const flag = art('skyclimb', 'summit-flag');
  // Like the big screen: height grows with the square root of the climb, so early steps show.
  const y = 88 - Math.sqrt(Math.max(0, pct) / 100) * 74;
  return (
    <div className={`sd-cs__sky${team ? ` sd-cs__sky--${team}` : ''}`} aria-hidden="true">
      <span className="sd-cs__rope" />
      <span className="sd-cs__flag">{flag ? <img src={flag} alt="" /> : '🚩'}</span>
      <span key={`c${hit}`} className={`sd-cs__climber${hit ? ' sd-cs__climber--step' : ''}${jumped ? ' sd-cs__climber--jump' : ''}`} style={{ top: `${y}%` }}>
        {climber ? <img src={climber} alt="" /> : <b>🧗</b>}
      </span>
      {jumped && <span key={`j${hit}`} className="sd-cs__jump" style={{ top: `${y}%` }}>JUMP!</span>}
      {hit > 0 && !jumped && <span key={`u${hit}`} className="sd-cs__up" style={{ top: `${y}%` }}>⬆</span>}
      {weak && <span className="sd-cs__updraft"><i /><i /><i /><i /></span>}
      {wind && <span className="sd-cs__storm"><i /><i /><i /><i /><i /><i /><i /><i /></span>}
    </div>
  );
}

/** Shrinking Island on the iPad: the island (smaller as the round goes on), everyone as a dot, me as the big one, the raft. */
function IsleMini({ island, me, hit, pct, wind, weak, team }: { island: NonNullable<RoomView['island']>; me: string; hit: number; pct: number; wind: boolean; weak: boolean; team: TeamId | null }) {
  const mine = island.spots[me];
  const at = (s: [number, number, number]) => {
    const rad = (s[0] * Math.PI) / 180;
    const d = s[2] > 0 ? Math.max(s[1], island.shore + 0.12) : s[1];
    return { left: `${50 + Math.cos(rad) * d * 40}%`, top: `${50 + Math.sin(rad) * d * 34}%` };
  };
  return (
    <div className={`sd-cs__isle${team ? ` sd-cs__sky--${team}` : ''}`} aria-hidden="true">
      <span className="sd-cs__sea" />
      <span className="sd-cs__land" style={{ width: `${island.shore * 80}%`, height: `${island.shore * 68}%` }}><i>🌴</i></span>
      {Object.entries(island.spots).filter(([id]) => id !== me).map(([id, s]) => <span key={id} className={`sd-cs__dot${s[2] > 0 ? ' sd-cs__dot--rock' : ''}`} style={at(s)} />)}
      {mine && (
        <span key={`m${hit}`} className={`sd-cs__me${mine[2] > 0 ? ' sd-cs__me--rock' : ''}${hit ? ' sd-cs__me--step' : ''}`} style={at(mine)}>
          {mine[2] > 0 && <i className="sd-cs__rock">🪨</i>}<b>⭐</b>
        </span>
      )}
      <span className="sd-cs__raft" style={{ '--built': pct / 100 } as React.CSSProperties}><i /><b>⛵</b></span>
      {hit > 0 && <span key={`p${hit}`} className="sd-cs__plank" style={mine ? at(mine) : undefined}>🪵</span>}
      {weak && <span className="sd-cs__crate">📦</span>}
      {wind && <span className="sd-cs__wave" />}
    </div>
  );
}

/** King of the Hill on the iPad: the castle going up on the hilltop, the throne, and the crown on whoever wears it. */
function HillMini({ crown, me, team, hit, pct, wind, weak }: { crown: NonNullable<RoomView['crown']>; me: string; team: TeamId | null; hit: number; pct: number; wind: boolean; weak: boolean }) {
  const mine = crown.holder !== null && (crown.team ? crown.holder === team : crown.holder === me);
  const crownImg = art('hill', 'crown');
  const throne = art('hill', 'throne');
  const myPts = crown.contenders.find(([who]) => who === (crown.team ? team : me))?.[1] ?? 0;
  const best = crown.contenders[0]?.[1] ?? 0;
  return (
    <div className={`sd-cs__hill${team ? ` sd-cs__sky--${team}` : ''}${mine ? ' sd-cs__hill--king' : ''}`} aria-hidden="true">
      <span className="sd-cs__mound" />
      <span className="sd-cs__castle" style={{ '--built': pct / 100 } as React.CSSProperties}><i /></span>
      <span className="sd-cs__throne">{throne ? <img src={throne} alt="" /> : '🪑'}</span>
      <span key={`c${crown.since}`} className={`sd-cs__crown${crown.holder === null ? ' sd-cs__crown--free' : ''}${mine ? ' sd-cs__crown--mine' : ''}`}>
        {crownImg ? <img src={crownImg} alt="" /> : '👑'}
      </span>
      {!mine && <span className="sd-cs__race"><i style={{ transform: `scaleX(${best ? Math.min(1, myPts / best) : 0})` }} /></span>}
      {hit > 0 && <span key={`s${hit}`} className="sd-cs__stone">🧱</span>}
      {weak && <span className="sd-cs__double">×2</span>}
      {wind && <span className="sd-cs__charger">🏇</span>}
    </div>
  );
}

/** Auction House on the iPad: the treasure on sale under the spotlight, the leading bid, and the hammer's timer. */
function AuctionMini({ auction, me, team, hit, t, wind, weak }: { auction: NonNullable<RoomView['auction']>; me: string; team: TeamId | null; hit: number; t: number; wind: boolean; weak: boolean }) {
  const lot = auction.lot;
  const img = lot && lot.kind !== 'mystery' ? art('auction', lot.kind) : undefined;
  const mine = !!lot && lot.topBy === me;
  const left = lot ? Math.max(0, lot.endsAt - t) : 0;
  return (
    <div className={`sd-cs__auc${team ? ` sd-cs__sky--${team}` : ''}${mine ? ' sd-cs__auc--mine' : ''}`} aria-hidden="true">
      <span className="sd-cs__aucspot" />
      <span className="sd-cs__aucplinth" />
      {lot ? (
        <span key={`l${lot.id}`} className={`sd-cs__lot sd-cs__lot--${lot.kind}`}>{img ? <img src={img} alt="" /> : lot.kind === 'mystery' ? <b>?</b> : TREASURE[lot.kind].emoji}</span>
      ) : (
        <span className="sd-cs__lotwait">{auction.nextAt !== null ? `Next treasure in ${Math.max(0, Math.ceil((auction.nextAt - t) / 1000))}s` : 'Fill the treasury!'}</span>
      )}
      {lot && <span key={`b${lot.top}`} className="sd-cs__lottop">{lot.top ? `${lot.top} 🪙` : `from ${lot.min} 🪙`}</span>}
      {lot && <span className="sd-cs__lottime"><i style={{ transform: `scaleX(${left / 20000})` }} /></span>}
      {hit > 0 && <span key={`c${hit}`} className="sd-cs__coin">🪙</span>}
      {weak && <span className="sd-cs__double">×2</span>}
      {wind && <span className="sd-cs__thief">🦹</span>}
    </div>
  );
}

/** The bid buttons: raise the leading bid by 10, 25 or 50 coins (or open the bidding), with my coins and treasure. */
function BidPanel({ view, t, me, team, coins, vault, onBid, said }: { view: RoomView; t: number; me: string; team: TeamId | null; coins: number; vault: number; onBid?: (amount: number) => void; said: { text: string; good: boolean } | null }) {
  const a = view.auction;
  const lot = a?.lot && t < a.lot.endsAt ? a.lot : null;
  const mine = (a?.sold ?? []).filter((x) => x.by === me);
  const blocked = !lot ? 'No treasure on sale right now' : lot.topBy === me ? "You're the top bid!" : team && lot.topTeam === team ? 'Your team is winning this one' : null;
  const amounts = lot ? [...new Set((a?.steps ?? [10, 25, 50]).map((st) => (lot.top ? lot.top + st : lot.min + st - 10)))] : [];
  return (
    <div className="sd-cs__bid">
      <div className="sd-cs__purse"><b>🪙 {coins}</b><span>{mine.length ? `${mine.map((x) => TREASURE[x.kind].emoji).join('')} worth ${vault}` : 'No treasure yet'}</span></div>
      {lot && !blocked ? (
        <div className="sd-cs__bidbtns">
          {amounts.map((n) => <button key={n} type="button" className="sd-cs__bidbtn" disabled={n > coins} onClick={() => onBid?.(n)}>Bid {n}</button>)}
        </div>
      ) : (
        <p className="sd-cs__bidwait">{blocked}</p>
      )}
      {said && lot && <p key={said.text} className={`sd-cs__bidsaid${said.good ? ' sd-cs__bidsaid--good' : ''}`}>{said.text}</p>}
    </div>
  );
}

const ROLE_WEAPON: Record<Role, string> = { striker: '⚔️', guard: '🛡️', healer: '✨' };

/**
 * The boss on the iPad, alive: it breathes and sways, embers drift past, and each of the pupil's answers plays out on it.
 * A Striker's blade flies in and lands with a flash, sparks and the damage; a Guard's shield rises and glows; a Healer's
 * light rises in sparkles (and hearts when they woke someone). A miss whooshes past and the boss laughs. In a wind-up the
 * boss rears up and glows red while sparks are pulled in; in a weak spot a target ring pulses on it.
 */
function BossMini({ img, act, wind, weak, phase }: { img: string; act: StageAct | null; wind: boolean; weak: boolean; phase: number }) {
  const a = act;
  const hitNow = !!a && a.right;
  const tone = a?.golden ? ' sd-cs__fx--gold' : a?.weak ? ' sd-cs__fx--crit' : '';
  return (
    <div className={`sd-cs__arena sd-cs__arena--p${phase}${wind ? ' sd-cs__arena--wind' : ''}`} aria-hidden="true">
      <span className="sd-cs__embers">{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ '--x': `${8 + i * 12}%`, '--d': `${(i * 0.73) % 4}s`, '--s': `${3.5 + (i % 3)}s` } as React.CSSProperties} />)}</span>
      {wind && <span className="sd-cs__charge">{Array.from({ length: 10 }, (_, i) => <i key={i} style={{ '--a': `${i * 36}deg`, '--d': `${(i % 5) * 0.12}s` } as React.CSSProperties} />)}</span>}
      <span className="sd-cs__bosswrap">
        <img key={a ? `b${a.seq}` : 'b'} className={`sd-cs__boss${hitNow ? (a!.times > 1 || a!.weak ? ' sd-cs__boss--bighit' : ' sd-cs__boss--hit') : a && !a.right ? ' sd-cs__boss--laugh' : ''}`} src={img} alt="" />
      </span>
      {weak && <span className="sd-cs__target"><i /></span>}
      {a && (
        <span key={`fx${a.seq}`} className={`sd-cs__fx sd-cs__fx--${a.right ? a.role : 'miss'}${tone}`}>
          {!a.right ? (
            <>
              <b className="sd-cs__shot sd-cs__shot--miss">{ROLE_WEAPON[a.role]}</b>
              <em className="sd-cs__ha">Ha!</em>
            </>
          ) : (
            <>
              {a.role === 'guard' && <span className="sd-cs__dome" />}
              {a.role === 'healer' && <span className="sd-cs__rise">{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ '--x': `${10 + i * 10}%`, '--d': `${(i % 4) * 0.08}s` } as React.CSSProperties}>{a.woke && i % 3 === 0 ? '💚' : '✦'}</i>)}</span>}
              <b className="sd-cs__shot">{ROLE_WEAPON[a.role]}</b>
              <span className="sd-cs__impact"><i />{Array.from({ length: 10 }, (_, i) => <s key={i} style={{ '--a': `${i * 36}deg`, '--r': `${48 + (i % 3) * 18}px` } as React.CSSProperties} />)}</span>
              {a.damage > 0 && <span className={`sd-cs__num${a.times > 1 ? ' sd-cs__num--big' : ''}`}>{a.damage}{a.times > 1 && <small>×{Math.round(a.times * 10) / 10}</small>}</span>}
              {a.weak && <span className="sd-cs__crit">CRIT!</span>}
              {a.role === 'guard' && <span className="sd-cs__tag">Shield up!</span>}
              {a.role === 'healer' && <span className="sd-cs__tag">{a.woke ? 'Woke a friend!' : 'Healing light!'}</span>}
              {a.streak >= 3 && <span className="sd-cs__combo">COMBO ×{a.streak}</span>}
            </>
          )}
        </span>
      )}
    </div>
  );
}

/** Gold Rush on the iPad: the pickaxe swings at the seam the pupil dug, with gold chips flying and what it paid. */
function DigFx({ act, seam }: { act: StageAct; seam: { x: number; y: number } | null }) {
  const x = `${(seam?.x ?? 0.5) * 100}%`;
  const y = `${(seam?.y ?? 0.5) * 100}%`;
  return (
    <span className={`sd-cs__dig${act.right ? '' : ' sd-cs__dig--miss'}`} style={{ left: x, top: y }} aria-hidden="true">
      <b className="sd-cs__pick">⛏</b>
      {act.right && <span className="sd-cs__impact"><i />{Array.from({ length: 8 }, (_, i) => <s key={i} style={{ '--a': `${i * 45}deg`, '--r': `${36 + (i % 3) * 14}px` } as React.CSSProperties} />)}</span>}
      {act.right && act.damage > 0 && <span className={`sd-cs__num sd-cs__num--gold${act.times > 1 ? ' sd-cs__num--big' : ''}`}>+{act.damage}</span>}
      {!act.right && <em className="sd-cs__ha">Clunk!</em>}
    </span>
  );
}
