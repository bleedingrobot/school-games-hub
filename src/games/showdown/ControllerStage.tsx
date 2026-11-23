/**
 * The right-hand side of a pupil's screen (James, 24 Nov 2026): the boss (or the Gold Rush mine), its health bar and what
 * is happening now (shield checks, weak spots, golden questions...), next to the question on the left. On a phone held
 * upright it is a short strip above the question. It only reads the room's view, so it never shows anyone's results.
 */
import { bossInfo } from '../../../shared/showdown/bosses';
import type { RoomView } from '../../../shared/showdown/server';
import type { TeamId } from '../../../shared/showdown/types';

const paintings = import.meta.glob('./art/paint/**/*.webp', { eager: true, import: 'default' }) as Record<string, string>;
const art = (folder: string, name: string) => paintings[`./art/paint/${folder}/${name}.webp`] ?? paintings[`./art/paint/${folder}/${name}-800.webp`];
const TEAM: Record<TeamId, string> = { red: 'Red', blue: 'Blue', gold: 'Gold', green: 'Green' };

type Notice = { key: string; text: string; tone: 'alarm' | 'good' | 'gold' | 'info' };

/** What is happening right now, most urgent first. */
export function noticesFor(view: RoomView, t: number, gr: boolean, team: TeamId | null, me: string): Notice[] {
  const out: Notice[] = [];
  if (view.pausedAt) out.push({ key: 'pause', text: '⏸ Paused. Look at the teacher.', tone: 'info' });
  if (view.state === 'lobby') {
    out.push({ key: 'lobby', text: gr ? '⛏ Grab your pickaxe! Waiting for the teacher…' : `${bossInfo(view.bossId).roar} Waiting for the teacher…`, tone: 'info' });
    return out;
  }
  const w = view.windUp;
  if (w && t < w.endsAt) {
    const g = w.groups[team ?? ''] ?? w.groups.all ?? w.groups[me];
    const secs = Math.max(0, Math.ceil((w.endsAt - t) / 1000));
    const held = g?.done === 'held';
    out.push({
      key: 'wind',
      text: held ? (gr ? '🛡️ The roof holds!' : '🛡️ Shield held!') : `${gr ? '⚠️ Cave-in! Prop up the roof!' : '🛡️ The boss is winding up! Shield up!'} ${secs}s${g ? ` · ${Math.min(g.got, g.needed)}/${g.needed}` : ''}`,
      tone: held ? 'good' : 'alarm',
    });
  }
  if (view.enrageUntil > t) out.push({ key: 'enrage', text: gr ? '🌋 The mountain rumbles!' : '😡 The boss is enraged!', tone: 'alarm' });
  if (view.weakSpotUntil > t) out.push({ key: 'weak', text: gr ? '💰 Mother lode! Double gold!' : '🎯 Weak spot! Double damage!', tone: 'gold' });
  if (view.goldenFrom !== null && t >= view.goldenFrom && t < view.goldenUntil) out.push({ key: 'golden', text: '⭐ Golden question time!', tone: 'gold' });
  if (view.finalStarted) out.push({ key: 'final', text: '⏱️ Final 30 seconds! Go go go!', tone: 'alarm' });
  if (view.mode === 'teams4' && team && view.facing === team) out.push({ key: 'facing', text: `👀 The boss is facing ${TEAM[team]}!`, tone: 'alarm' });
  if (view.mode === 'teams2' && team && Math.abs(view.tug) > 0.1) {
    const winning = (view.tug < 0 && team === 'red') || (view.tug > 0 && team === 'blue');
    out.push({ key: 'tug', text: winning ? `💪 ${TEAM[team]} is pushing the boss back!` : '⚠️ The boss is coming your way! Push!', tone: winning ? 'good' : 'alarm' });
  }
  if (!gr && view.boss.phase > 1 && !out.length) out.push({ key: 'phase', text: view.boss.phase === 3 ? '🔥 Last phase! Finish it!' : '💢 The boss is getting angry!', tone: 'info' });
  if (!out.length) out.push({ key: 'calm', text: gr ? '⛏ Keep digging!' : '⚔️ Keep hitting the boss!', tone: 'info' });
  return out;
}

export function ControllerStage({ view, t, gr, hit, team, me }: { view: RoomView; t: number; gr: boolean; hit: number; team: TeamId | null; me: string }) {
  const boss = bossInfo(view.bossId);
  const back = gr ? art('back', 'gold-rush') : art('back', boss.backdrop);
  const bossImg = gr ? null : art('bosses', `${view.bossId}-${view.boss.phase}`);
  const pct = Math.max(0, Math.min(100, (view.boss.hp / Math.max(1, view.boss.max)) * 100));
  const name = gr ? 'Gold left in the mountain' : boss.name;
  const notices = noticesFor(view, t, gr, team, me);
  const weak = view.weakSpotUntil > t;
  const wind = !!view.windUp && t < view.windUp.endsAt;
  return (
    <aside className={`sd-cs${gr ? ' sd-cs--gr' : ''}${weak ? ' sd-cs--weak' : ''}${wind ? ' sd-cs--wind' : ''}`} aria-label={gr ? 'The mine' : 'The boss'}>
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
        ) : bossImg ? (
          <img key={`b${hit}`} className={`sd-cs__boss${hit ? ' sd-cs__boss--hit' : ''}`} src={bossImg} alt="" aria-hidden="true" />
        ) : null}
        {hit > 0 && <span key={`h${hit}`} className="sd-cs__pow" aria-hidden="true">{gr ? '🪙' : '💥'}</span>}
      </div>
      <div className="sd-cs__bar" role="progressbar" aria-label={`${name} health`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
        <span className="sd-cs__name">{name}</span>
        <span className="sd-cs__track"><i style={{ transform: `scaleX(${pct / 100})` }} /></span>
        <span className="sd-cs__pct">{Math.ceil(pct)}%</span>
      </div>
      <ul className="sd-cs__notices" aria-live="polite">
        {notices.map((n) => <li key={n.key} className={`sd-cs__notice sd-cs__notice--${n.tone}`}>{n.text}</li>)}
      </ul>
    </aside>
  );
}
