/**
 * The right-hand side of a pupil's screen (James, 24 Nov 2026): the boss (or the Gold Rush mine), its health bar and what
 * is happening now (shield checks, weak spots, golden questions...), next to the question on the left. On a phone held
 * upright it is a short strip above the question. It only reads the room's view, so it never shows anyone's results.
 */
import { bossInfo } from '../../../shared/showdown/bosses';
import { arenaWords } from './arenaWords';
import type { RoomView } from '../../../shared/showdown/server';
import type { TeamId } from '../../../shared/showdown/types';

const paintings = import.meta.glob('./art/paint/**/*.webp', { eager: true, import: 'default' }) as Record<string, string>;
const art = (folder: string, name: string) => paintings[`./art/paint/${folder}/${name}.webp`] ?? paintings[`./art/paint/${folder}/${name}-800.webp`];
const TEAM: Record<TeamId, string> = { red: 'Red', blue: 'Blue', gold: 'Gold', green: 'Green' };

type Notice = { key: string; text: string; tone: 'alarm' | 'good' | 'gold' | 'info' };

/** What is happening right now, most urgent first, in the arena's own words. */
export function noticesFor(view: RoomView, t: number, team: TeamId | null, me: string): Notice[] {
  const W = arenaWords(view.arena);
  const N = W.notices;
  const out: Notice[] = [];
  if (view.pausedAt) out.push({ key: 'pause', text: '⏸ Paused. Look at the teacher.', tone: 'info' });
  if (view.state === 'lobby') {
    out.push({ key: 'lobby', text: view.arena === 'goldrush' ? '⛏ Grab your pickaxe! Waiting for the teacher…' : view.arena === 'skyclimb' ? '🧗 Rope on! Waiting for the teacher…' : view.arena === 'island' ? '🏝️ Find a spot on the island! Waiting for the teacher…' : view.arena === 'hill' ? '👑 Up the hill! Waiting for the teacher…' : `${bossInfo(view.bossId).roar} Waiting for the teacher…`, tone: 'info' });
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
  if (view.mode === 'teams4' && team && view.facing === team && view.arena !== 'skyclimb' && view.arena !== 'hill') out.push({ key: 'facing', text: `👀 The boss is facing ${TEAM[team]}!`, tone: 'alarm' });
  if (view.mode === 'teams2' && team && Math.abs(view.tug) > 0.1 && (view.arena ?? 'boss') === 'boss') {
    const winning = (view.tug < 0 && team === 'red') || (view.tug > 0 && team === 'blue');
    out.push({ key: 'tug', text: winning ? `💪 ${TEAM[team]} is pushing the boss back!` : '⚠️ The boss is coming your way! Push!', tone: winning ? 'good' : 'alarm' });
  }
  if (view.boss.phase > 1 && !out.length) out.push({ key: 'phase', text: N.phase(view.boss.phase === 3 ? 3 : 2), tone: 'info' });
  if (!out.length) out.push({ key: 'calm', text: N.calm, tone: 'info' });
  return out;
}

export function ControllerStage({ view, t, hit, team, me, streak = 0 }: { view: RoomView; t: number; hit: number; team: TeamId | null; me: string; streak?: number }) {
  const boss = bossInfo(view.bossId);
  const W = arenaWords(view.arena);
  const gr = view.arena === 'goldrush';
  const sky = view.arena === 'skyclimb';
  const isle = view.arena === 'island';
  const hill = view.arena === 'hill';
  const back = gr ? art('back', 'gold-rush') : sky ? art('back', 'sky-climb') : isle ? art('back', 'shrinking-island') : hill ? art('back', 'king-hill') : art('back', boss.backdrop);
  const bossImg = gr || sky || isle || hill ? null : art('bosses', `${view.bossId}-${view.boss.phase}`);
  const left = Math.max(0, Math.min(100, (view.boss.hp / Math.max(1, view.boss.max)) * 100));
  const pct = W.fills ? 100 - left : left;
  const name = W.goal ?? boss.name;
  const notices = noticesFor(view, t, team, me);
  const weak = view.weakSpotUntil > t;
  const wind = !!view.windUp && t < view.windUp.endsAt;
  const jumped = sky && hit > 0 && streak > 0 && streak % 3 === 0;
  return (
    <aside className={`sd-cs${gr ? ' sd-cs--gr' : ''}${sky ? ' sd-cs--sky' : ''}${isle ? ' sd-cs--isle' : ''}${hill ? ' sd-cs--hill' : ''}${weak ? ' sd-cs--weak' : ''}${wind ? ' sd-cs--wind' : ''}`} aria-label={gr ? 'The mine' : sky ? 'The climb' : isle ? 'The island' : hill ? 'The hill' : 'The boss'}>
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
        ) : bossImg ? (
          <img key={`b${hit}`} className={`sd-cs__boss${hit ? ' sd-cs__boss--hit' : ''}`} src={bossImg} alt="" aria-hidden="true" />
        ) : null}
        {hit > 0 && !sky && !isle && !hill && <span key={`h${hit}`} className="sd-cs__pow" aria-hidden="true">{gr ? '🪙' : '💥'}</span>}
      </div>
      <div className="sd-cs__bar" role="progressbar" aria-label={W.fills ? name : `${name} health`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
        <span className="sd-cs__name">{name}</span>
        <span className="sd-cs__track"><i style={{ transform: `scaleX(${pct / 100})` }} /></span>
        <span className="sd-cs__pct">{W.fills ? Math.floor(pct) : Math.ceil(pct)}%</span>
      </div>
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
