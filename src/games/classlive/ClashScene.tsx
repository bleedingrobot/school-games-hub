/**
 * Colour Clash on the big screen (docs/CLASH-PLAN.md): the board with the paint (changed tiles read every 0.3 s from
 * the database), everyone's avatar gliding between saved spots, bombs splatting, the live team bars and the paint
 * clock; at each round's end a big count-up reveal of each team's paint and the round's winner; at the end the team
 * standings. Rounds run on the server's clock: this asks the server (`onTick`) just after each deadline.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AvatarImage } from '../../avatar/AvatarImage';
import {
  AVATAR_R, blankTiles, champions, MAP_WORDS, MECHANICS, POWER_WORDS, scoreTiles, standings, TEAM_WORDS, UNLOCK, type ClashGame, type ClashMechanic, type Team,
} from '../../../shared/classlive/clash';
import type { Spot } from '../../../shared/classlive/corners';
import type { ScreenView } from '../../../shared/classlive/server';
import type { ClassLiveSound } from './audio';
import { ClashBoard, ClashToken, teamColour, withTiles, type Splat } from './ClashBoard';
import type { ClassLiveLink } from './link';
import { painted } from './paintedArt';
import { LINES, next, type LineKey } from './voiceLines';

const lineOf = (key: string): string | null => (key in LINES ? next(key as LineKey) : null);

const MECH_ABOUT: Record<ClashMechanic, (w: (typeof MAP_WORDS)['park']) => string> = {
  items: () => 'Power-ups! Run over one, then drop a bomb to switch it on.',
  golden: () => 'Golden tiles! Each one counts 3.',
  portal: (w) => `${w.portal}s! Step in one to pop out of the other.`,
  goo: (w) => `${w.goo}! It slows you down.`,
  slip: (w) => `${w.slip}! You slide and can't stop fast.`,
  roller: (w) => `${w.roller}s! Get hit and you go flying.`,
  fountain: (w) => `${w.fountain} in the middle! Go round it: it can't be painted.`,
};

const teamsOf = (g: ClashGame) => ([1, 2, 3, 4] as Team[]).filter((t) => t <= g.teams);

export function ClashScene({ screen, game, link, room, clock, sound, say, onTick, over, onAgain }: {
  screen: ScreenView; game: ClashGame; link: ClassLiveLink; room: number | null;
  clock: () => number;
  sound: ClassLiveSound; say: (text: string, delay?: number) => void;
  onTick: () => void;
  over: boolean;
  onAgain: () => void;
}) {
  const t = screen.startedAt === null ? 0 : clock() - screen.startedAt;
  const r = game.round;
  const targets = useRef<Record<string, Spot>>({});
  const shown = useRef<Record<string, Spot>>({});
  const [, setFrame] = useState(0);
  const [avatars, setAvatars] = useState<Record<string, unknown>>({});
  const [tiles, setTiles] = useState(blankTiles());
  const tilesRound = useRef(0);
  const since = useRef<number | null>(null);
  const [splats, setSplats] = useState<Splat[]>([]);
  const [pops, setPops] = useState<{ key: number; at: Spot; text: string }[]>([]);
  const words = MAP_WORDS[game.map];

  const count = screen.people.length;
  useEffect(() => {
    if (!room) return;
    let live = true;
    void link.avatars(room).then((a) => { if (live && a) setAvatars(a); }, () => undefined);
    return () => { live = false; };
  }, [room, count, link]);

  // Spots and paint, every 0.3 s while painting (every 1.5 s otherwise).
  const paintingNow = !!r && r.result === null && t >= r.paintFrom && t < r.paintTo + 800;
  useEffect(() => {
    if (!room) return;
    let live = true;
    const read = () => {
      if (!over) void link.positions(room).then((p) => { if (live && p) targets.current = p; }, () => undefined);
      void link.clashBoard(room, since.current).then((b) => {
        if (!live || !b) return;
        if (b.round !== tilesRound.current) {
          tilesRound.current = b.round;
          if (since.current !== null) {
            // A new round: read the whole (clean) board next time.
            since.current = null;
            setTiles(blankTiles());
            return;
          }
          setTiles(withTiles(blankTiles(), b.tiles));
        } else if (b.tiles.length) setTiles((old) => withTiles(old, b.tiles));
        since.current = b.now - 50;
      }, () => undefined);
    };
    read();
    const id = window.setInterval(read, paintingNow ? 300 : 1500);
    return () => { live = false; window.clearInterval(id); };
  }, [room, paintingNow, over, link]);

  // Glide avatars.
  useEffect(() => {
    let id = 0;
    let last = performance.now();
    const loop = (ts: number) => {
      const dt = Math.min(0.1, (ts - last) / 1000);
      last = ts;
      const k = Math.min(1, dt * 9);
      for (const p of screen.people) {
        const goal = targets.current[p.id] ?? game.mine[p.id]?.spot;
        if (!goal) continue;
        const cur = shown.current[p.id];
        if (!cur || Math.hypot(goal.x - cur.x, goal.y - cur.y) > 0.3) shown.current[p.id] = { ...goal };
        else shown.current[p.id] = { x: cur.x + (goal.x - cur.x) * k, y: cur.y + (goal.y - cur.y) * k };
      }
      setFrame((f) => (f + 1) % 1_000_000);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [screen.people, game.mine]);

  // Deadlines: the first round, painting's end (a moment later, so last moves land), the next round.
  const deadline = !r ? 0 : r.result === null ? r.paintTo + 400 : r.countEnd + 50;
  const tick = useRef(onTick);
  tick.current = onTick;
  useEffect(() => {
    if (over || screen.startedAt === null) return;
    const wait = Math.max(50, deadline - t);
    const id = window.setTimeout(() => tick.current(), wait);
    const again = window.setTimeout(() => tick.current(), wait + 2500);
    return () => { window.clearTimeout(id); window.clearTimeout(again); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline, over, screen.startedAt]);

  // Sounds and Bella, once per moment.
  const phase = !r ? 'wait' : t < r.paintFrom ? 'ready' : r.result === null ? (t < r.paintTo ? 'paint' : 'wait') : 'count';
  const secLeft = r && phase === 'paint' ? Math.ceil((r.paintTo - t) / 1000) : null;
  const readyLeft = r && phase === 'ready' ? Math.ceil((r.paintFrom - t) / 1000) : null;
  const moment = useRef('');
  useEffect(() => {
    if (over || !r) return;
    const key = `${r.n}:${phase}`;
    if (moment.current === key) return;
    moment.current = key;
    if (phase === 'ready') {
      const fresh = MECHANICS.find((m) => UNLOCK[m] === r.n);
      say((fresh ? lineOf(`clash_${fresh}`) : null) ?? lineOf(r.n === 1 ? 'clashStart' : 'clashReady') ?? 'Get ready to paint!', 200);
    } else if (phase === 'paint') {
      sound.play('start');
    } else if (phase === 'count' && r.result) {
      sound.play('drumroll');
      say(lineOf('clashCount') ?? "Time's up! Let's count the paint!", 100);
      const w = r.result.winners;
      window.setTimeout(() => {
        sound.play(w.length ? 'land' : 'safe');
        const one = w.length === 1 ? lineOf(`clashWin${TEAM_WORDS[w[0]].name}`) : null;
        say(one ?? (w.length > 1 ? (lineOf('clashTie') ?? "It's a tie!") : w.length ? `${TEAM_WORDS[w[0]].name} wins the round!` : 'No paint at all!'));
      }, 3200);
    }
  }, [phase, r, over, say, sound]);
  const lastTick = useRef<number | null>(null);
  useEffect(() => {
    const n = secLeft ?? readyLeft;
    if (n === null || n === lastTick.current) return;
    lastTick.current = n;
    if (n <= 5 && n > 0) sound.play(n <= 3 ? 'tickLast' : 'tick');
    if (secLeft === 10) say(lineOf('clashTen') ?? 'Ten seconds left!');
  }, [secLeft, readyLeft, sound, say]);

  // Bombs, grabs, power-ups: splats and pops (from the screen's events, once each).
  const seenSeq = useRef<number | null>(null);
  useEffect(() => {
    if (seenSeq.current === null) { seenSeq.current = screen.seq; return; }
    const fresh = screen.events.filter((e) => e.seq > (seenSeq.current as number));
    if (!fresh.length) return;
    seenSeq.current = fresh[fresh.length - 1].seq;
    const add: { key: number; at: Spot; text: string }[] = [];
    const boom: Splat[] = [];
    for (const e of fresh) {
      const at = 'pupil' in e && typeof e.pupil === 'string' ? (shown.current[e.pupil] ?? { x: 0.5, y: 0.5 }) : { x: 0.5, y: 0.5 };
      if (e.type === 'clash_bomb') { boom.push({ key: e.seq, x: e.x, y: e.y, r: e.r, team: e.team }); sound.play('flip'); }
      else if (e.type === 'clash_grab') { sound.play('grab'); add.push({ key: e.seq, at, text: POWER_WORDS[e.power].emoji }); }
      else if (e.type === 'clash_power') { sound.play('power'); add.push({ key: e.seq, at, text: `${POWER_WORDS[e.power].emoji} ${POWER_WORDS[e.power].name}!` }); }
    }
    if (boom.length) {
      setSplats((s) => [...s, ...boom].slice(-12));
      window.setTimeout(() => setSplats((s) => s.filter((x) => !boom.includes(x))), 1000);
    }
    if (add.length) {
      setPops((p) => [...p, ...add].slice(-8));
      window.setTimeout(() => setPops((p) => p.filter((x) => !add.includes(x))), 1800);
    }
  }, [screen.events, screen.seq, sound]);

  const live = useMemo(() => scoreTiles(tiles, r?.golden ?? [], !!r?.hole), [tiles, r]);
  const teams = teamsOf(game);
  const most = Math.max(1, ...teams.map((tm) => live.score[tm]));
  const fresh = r ? MECHANICS.find((m) => UNLOCK[m] === r.n) : undefined;
  const nameOf = (id: string) => (screen.showNames ? screen.people.find((p) => p.id === id)?.name ?? null : null);

  return (
    <div className={`cc-scene cc-scene--${game.map}`}>
      <div className="cc-stage">
        <ClashBoard map={game.map} round={r} t={t} tiles={tiles} splats={splats} dim={phase !== 'paint'}>
          {screen.people.map((p) => {
            const m = game.mine[p.id];
            const at = shown.current[p.id] ?? m?.spot;
            if (!at || !m) return null;
            const cls = `${m.speedTo !== null && t < m.speedTo ? 'cc-token--fast' : ''} ${m.brushTo !== null && t < m.brushTo ? 'cc-token--brush' : ''}`;
            return (
              <ClashToken key={p.id} x={at.x} y={at.y} size={AVATAR_R * 1.8} team={m.team} className={cls} label={nameOf(p.id)}>
                <AvatarImage avatar={avatars[p.id] ?? null} size={64} />
              </ClashToken>
            );
          })}
          {pops.map((p) => <span key={p.key} className="cc-pop" style={{ left: `${p.at.x * 100}%`, top: `${p.at.y * 100}%` }}>{p.text}</span>)}
        </ClashBoard>
        <aside className="cc-side">
          <div className="cc-side__map">{words.name}</div>
          <div className="cc-side__round">{r ? `Round ${r.n}` : 'Get ready!'}</div>
          {!over && secLeft !== null && <div className={`cc-clock ${secLeft <= 10 ? 'cc-clock--low' : ''}`} role="timer">⏱ {secLeft}</div>}
          {fresh && phase !== 'count' && <div className="cc-new" key={fresh}><b>New!</b> {MECH_ABOUT[fresh](words)}</div>}
          <div className="cc-teams">
            {teams.map((tm) => {
              const banner = painted('clash-fx', `team-${TEAM_WORDS[tm].name.toLowerCase()}`);
              return (
                <div key={tm} className="cc-team" style={{ ['--tc' as string]: teamColour(tm) }}>
                  <span className="cc-team__name">{banner ? <img src={banner} alt="" width={28} height={28} /> : TEAM_WORDS[tm].emoji} {TEAM_WORDS[tm].name}</span>
                  <span className="cc-team__bar"><i style={{ width: `${(100 * live.score[tm]) / most}%` }} /></span>
                  <span className="cc-team__wins" title="Rounds won">🏆 {game.wins[tm]}</span>
                </div>
              );
            })}
          </div>
        </aside>
      </div>
      {!over && readyLeft !== null && <div className="cc-count" key={`r${readyLeft}`}>{readyLeft > 3 ? 'Get ready…' : readyLeft}</div>}
      {!over && secLeft !== null && secLeft <= 5 && <div className="cc-count cc-count--low cc-count--small" key={`s${secLeft}`}>{secLeft}</div>}
      {!over && phase === 'count' && r?.result && <Reveal game={game} n={r.n} score={r.result.score} winners={r.result.winners} />}
      {over && <ClashFinish screen={screen} game={game} avatars={avatars} onAgain={onAgain} />}
    </div>
  );
}

/** The round's count: bars race up to each team's paint, then the winner. */
function Reveal({ game, n, score, winners }: { game: ClashGame; n: number; score: number[]; winners: Team[] }) {
  const teams = teamsOf(game);
  const top = Math.max(1, ...teams.map((t) => score[t]));
  const [shownN, setShownN] = useState(teams.map(() => 0));
  useEffect(() => {
    const start = performance.now();
    let id = 0;
    const step = (ts: number) => {
      const k = Math.min(1, (ts - start) / 3000);
      const e = 1 - (1 - k) ** 3;
      setShownN(teams.map((t) => Math.round(score[t] * e)));
      if (k < 1) id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);
  return (
    <div className="cc-reveal" role="dialog" aria-label={`Round ${n} count`}>
      <div className="cc-reveal__box">
        <h2 className="cc-reveal__title">Round {n}: count the paint!</h2>
        {teams.map((t, i) => (
          <div key={t} className={`cc-reveal__row ${winners.includes(t) ? 'cc-reveal__row--win' : ''}`} style={{ ['--tc' as string]: teamColour(t), ['--w' as string]: `${(100 * score[t]) / top}%` }}>
            <span>{TEAM_WORDS[t].emoji} {TEAM_WORDS[t].name}</span>
            <span className="cc-reveal__bar"><i /></span>
            <b>{shownN[i]}</b>
          </div>
        ))}
        <div className="cc-reveal__winner">
          {winners.length === 0 ? 'No paint at all!' : winners.length > 1 ? `🤝 A tie: ${winners.map((w) => TEAM_WORDS[w].name).join(' and ')}!` : `🏆 ${TEAM_WORDS[winners[0]].name} wins the round!`}
        </div>
      </div>
    </div>
  );
}

/** Team standings (round wins, then paint), each team's pupils, and class facts. No maths results by name. */
function ClashFinish({ screen, game, avatars, onAgain }: { screen: ScreenView; game: ClashGame; avatars: Record<string, unknown>; onAgain: () => void }) {
  const list = standings(game);
  const champs = champions(game);
  const win = painted('clash', 'win');
  const ids = screen.people.map((p) => p.id);
  const sum = (f: (id: string) => number) => ids.reduce((a, id) => a + f(id), 0);
  const painters = (team: Team) => ids.filter((id) => game.mine[id]?.team === team).sort((a, b) => (game.mine[b]?.painted ?? 0) - (game.mine[a]?.painted ?? 0));
  const topPainter = screen.showNames ? [...ids].sort((a, b) => (game.mine[b]?.painted ?? 0) - (game.mine[a]?.painted ?? 0))[0] : undefined;
  const facts = [
    `🎨 ${sum((id) => game.mine[id]?.painted ?? 0)} tiles painted`,
    `💣 ${sum((id) => game.mine[id]?.bombs ?? 0)} paint bombs`,
    sum((id) => game.mine[id]?.powersUsed ?? 0) > 0 && `⚡ ${sum((id) => game.mine[id]?.powersUsed ?? 0)} power-ups switched on`,
    `🔁 ${game.history.length} ${game.history.length === 1 ? 'round' : 'rounds'}`,
  ].filter(Boolean) as string[];
  return (
    <div className="cl-finish cc-finish" role="dialog" aria-label="Finish" style={win ? { backgroundImage: `url(${win})`, backgroundSize: 'cover' } : undefined}>
      <h2 className="cl-finish__title">{champs.length === 1 ? `${TEAM_WORDS[champs[0]].emoji} ${TEAM_WORDS[champs[0]].name} wins Colour Clash!` : champs.length ? 'A tie at the top!' : 'Colour Clash is over!'}</h2>
      <p className="cl-finish__sub">{MAP_WORDS[game.map].name}</p>
      <div className="cc-standings">
        {list.map((s) => (
          <div key={s.team} className={`cc-stand cc-stand--${s.place}`} style={{ ['--tc' as string]: teamColour(s.team) }}>
            <span className="cc-stand__place">{['', '🥇', '🥈', '🥉', '4'][s.place]}</span>
            <span className="cc-stand__name">{TEAM_WORDS[s.team].name}</span>
            <span>🏆 {s.wins} {s.wins === 1 ? 'round' : 'rounds'} · 🎨 {s.tiles}</span>
            <span className="cc-stand__who">{painters(s.team).slice(0, 10).map((id) => <AvatarImage key={id} avatar={avatars[id] ?? null} size={34} />)}</span>
          </div>
        ))}
      </div>
      <p className="fc-facts">{facts.map((f, i) => <span key={i}>{f}</span>)}</p>
      {topPainter && (game.mine[topPainter]?.painted ?? 0) > 0 && (
        <ul className="fc-awards">
          <li><span className="fc-awards__emoji" aria-hidden="true">🖌️</span><span className="fc-awards__title">Top painter</span><b className="fc-awards__who">{screen.people.find((p) => p.id === topPainter)?.name}</b><span className="fc-awards__what">{game.mine[topPainter]?.painted} tiles</span></li>
        </ul>
      )}
      <div className="cl-finish__row">
        <button type="button" className="cl-btn cl-btn--go cl-btn--big" onClick={onAgain}>Back to Class Live</button>
      </div>
    </div>
  );
}
