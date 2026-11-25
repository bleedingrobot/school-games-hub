/**
 * Four Corners on the big screen (docs/CORNERS-PLAN.md): the board with everyone's avatar gliding between saved spots
 * (read every 0.3 s), the countdown, the big tumbling dice, the jail, the safe-rounds board and the podium. Rounds run
 * on the server's clock: this asks the server (`onTick`) just after each deadline so it moves on.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AvatarImage } from '../../avatar/AvatarImage';
import {
  AVATAR_R, cornerOf, JAIL_RIGHT, MAP_WORDS, MECHANICS, podium, POWER_WORDS, UNLOCK, type Corner, type CornersGame, type Mechanic, type Power, type Spot,
} from '../../../shared/classlive/corners';
import type { ScreenView } from '../../../shared/classlive/server';
import type { ClassLiveSound } from './audio';
import { CORNER_COLOURS, CORNER_NAMES, CornersBoard, Token } from './CornersBoard';
import type { ClassLiveLink } from './link';
import { painted } from './paintedArt';
import { LINES, next, type LineKey } from './voiceLines';

/** A Bella line by key, if there is one (lines are looked up by name, e.g. mechanic lines per map). */
export const lineOf = (key: string): string | null => (key in LINES ? next(key as LineKey) : null);

const MECH_ABOUT: Record<Mechanic, (w: (typeof MAP_WORDS)['snow']) => string> = {
  items: () => 'Power-ups! Grab one, then answer a question in a corner to switch it on.',
  storm: (w) => `${w.storm}! It slows you down.`,
  teleport: (w) => `${w.teleport}s! Step in one to warp to the other.`,
  ice: (w) => `${w.ice}! You slide and can't stop fast.`,
  fog: (w) => `${w.fog}! The big screen can't see you at the end.`,
  roller: (w) => `${w.roller}s! Two roll through the corners and knock you flying.`,
  hole: (w) => `${w.hole} in the middle! Go round it.`,
  gate: (w) => `${w.gate}! One corner shuts before the end.`,
  twist: () => 'Twist rolls! Two corners, or a lucky roll.',
};

type Person = ScreenView['people'][number];

/** The tumbling dice: spins for a while, then lands on the rolled corner's face (a star for a lucky roll). */
function Dice({ face, landed, two }: { face: Corner | 'star'; landed: boolean; two?: Corner | null }) {
  const faces: { key: string; colour: string; text: string }[] = [
    ...CORNER_NAMES.map((n, i) => ({ key: String(i), colour: CORNER_COLOURS[i], text: n })),
    { key: 'star', colour: '#a855f7', text: '★' },
    { key: 'x', colour: '#f97316', text: '?' },
  ];
  const facePic = (k: string) => painted('corners-fx', `dice-${k === 'star' ? 'star' : CORNER_NAMES[Number(k)]?.toLowerCase()}`);
  const one = (f: Corner | 'star', i: number) => (
    <div key={i} className={`fc-dice ${landed ? 'fc-dice--landed' : ''}`} data-face={String(f)}>
      <div className="fc-dice__cube">
        {faces.map((x, j) => {
          const pic = facePic(x.key);
          return (
            <div key={x.key} className={`fc-dice__face fc-dice__face--${j}`} style={{ ['--fc' as string]: x.colour, ...(pic ? { backgroundImage: `url(${pic})` } : {}) }}>
              {!pic && <span>{x.text}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
  return <div className="fc-dicebox" aria-hidden="true">{one(face, 0)}{two !== undefined && two !== null && one(two, 1)}</div>;
}

export function CornersScene({ screen, game, link, room, clock, sound, say, onTick, over, onAgain }: {
  screen: ScreenView; game: CornersGame; link: ClassLiveLink; room: number | null;
  /** Server time now (ms). */
  clock: () => number;
  sound: ClassLiveSound; say: (text: string, delay?: number) => void;
  /** Ask the server to move the game on (a deadline passed). */
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
  const words = MAP_WORDS[game.map];

  // Everyone's avatar (again when more join).
  const count = screen.people.length;
  useEffect(() => {
    if (!room) return;
    let live = true;
    void link.avatars(room).then((a) => { if (live && a) setAvatars(a); }, () => undefined);
    return () => { live = false; };
  }, [room, count, link]);

  // Saved spots, every 0.3 s while a round runs (every 2 s otherwise).
  const running = !!r && r.caught === null && !over;
  useEffect(() => {
    if (!room || over) return;
    let live = true;
    const read = () => void link.positions(room).then((p) => { if (live && p) targets.current = p; }, () => undefined);
    read();
    const id = window.setInterval(read, running ? 300 : 2000);
    return () => { live = false; window.clearInterval(id); };
  }, [room, running, over, link]);

  // Glide every avatar towards its newest spot, every frame.
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

  // Ask the server just after each deadline: the run's end (a moment later, so last moves land), then the next round.
  const deadline = !r ? 4000 : r.caught === null ? r.runEnd + 450 : r.showEnd + 50;
  const tick = useRef(onTick);
  tick.current = onTick;
  useEffect(() => {
    if (over || screen.startedAt === null) return;
    const wait = Math.max(50, deadline - t);
    const id = window.setTimeout(() => tick.current(), wait);
    // And again if the reply got lost.
    const again = window.setTimeout(() => tick.current(), wait + 2500);
    return () => { window.clearTimeout(id); window.clearTimeout(again); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline, over, screen.startedAt]);

  // Sounds and Bella, once per moment.
  const phase = !r ? 'ready' : r.caught === null ? (t < r.runEnd ? 'run' : 'wait') : t < r.rollEnd ? 'roll' : t < r.showEnd ? 'show' : 'wait';
  const secLeft = r && phase === 'run' ? Math.ceil((r.runEnd - t) / 1000) : null;
  const moment = useRef('');
  useEffect(() => {
    if (over || !r) return;
    const key = `${r.n}:${phase}`;
    if (moment.current === key) return;
    moment.current = key;
    if (phase === 'run') {
      sound.play('start');
      const fresh = MECHANICS.find((m) => UNLOCK[m] === r.n);
      const mech = fresh ? lineOf(`mech_${game.map}_${fresh}`) : null;
      say(mech ?? lineOf(r.n === 1 ? 'startCorners' : 'runNow') ?? 'Run to a corner!', 300);
    } else if (phase === 'roll') {
      sound.play('drumroll');
      say(r.twist === 'two' ? (lineOf('twoCorners') ?? 'Two corners this time!') : (lineOf('rollDice') ?? 'Here comes the dice!'), 100);
      window.setTimeout(() => sound.play('dice'), 600);
    } else if (phase === 'show') {
      sound.play('land');
      const called = r.twist === 'lucky' ? lineOf('lucky') : r.rolled.length ? lineOf(`corner${CORNER_NAMES[r.rolled[0]]}`) : null;
      say(called ?? (r.twist === 'lucky' ? 'Lucky roll! Everyone in a corner is safe!' : `The ${CORNER_NAMES[r.rolled[0] ?? 0].toLowerCase()} corner!`), 150);
      const caught = r.caught?.length ?? 0;
      window.setTimeout(() => sound.play((caught ? 'caught' : 'safe')), 1200);
      if (r.saved.length) window.setTimeout(() => say(lineOf('shieldSaved') ?? 'A shield saved someone!'), 2600);
      else if (caught === 0) window.setTimeout(() => say(lineOf('nobodyCaught') ?? 'Nobody caught!'), 2600);
      else if (caught >= Math.max(4, screen.people.length / 3)) window.setTimeout(() => say(lineOf('lotsCaught') ?? 'Lots of you are off to jail!'), 2600);
    }
  }, [phase, r, over, game.map, say, sound, screen.people.length]);
  const lastTick = useRef<number | null>(null);
  useEffect(() => {
    if (secLeft === null || secLeft === lastTick.current) return;
    lastTick.current = secLeft;
    if (secLeft <= 5 && secLeft > 0) sound.play((secLeft <= 3 ? 'tickLast' : 'tick'));
    if (secLeft === 3) say(lineOf('hurry') ?? 'Three seconds!');
  }, [secLeft, sound, say]);

  // Grabs, power-ups and escapes: little pops (from the screen's events, once each).
  const seenSeq = useRef<number | null>(null);
  const [pops, setPops] = useState<{ key: number; at: Spot; text: string }[]>([]);
  useEffect(() => {
    const evs = screen.events;
    if (seenSeq.current === null) { seenSeq.current = screen.seq; return; }
    const fresh = evs.filter((e) => e.seq > (seenSeq.current as number));
    if (!fresh.length) return;
    seenSeq.current = fresh[fresh.length - 1].seq;
    const add: { key: number; at: Spot; text: string }[] = [];
    for (const e of fresh) {
      const at = 'pupil' in e && typeof e.pupil === 'string' ? (shown.current[e.pupil] ?? { x: 0.5, y: 0.5 }) : { x: 0.5, y: 0.5 };
      // (Events of other games never reach this screen: the casts only narrow the shared event type.)
      if (e.type === 'grab') { sound.play('grab'); add.push({ key: e.seq, at, text: POWER_WORDS[e.power as Power].emoji }); }
      else if (e.type === 'power') { sound.play('power'); add.push({ key: e.seq, at, text: `${POWER_WORDS[e.power as Power].emoji} ${POWER_WORDS[e.power as Power].name}!` }); }
      else if (e.type === 'escape') sound.play('escape');
    }
    if (fresh.some((e) => e.type === 'escape')) say(lineOf('escape') ?? 'Out of jail!', 800);
    if (add.length) {
      setPops((p) => [...p, ...add].slice(-8));
      window.setTimeout(() => setPops((p) => p.filter((x) => !add.includes(x))), 1800);
    }
  }, [screen.events, screen.seq, sound, say]);

  const nameOf = (p: Person) => (screen.showNames ? p.name : null);
  const jailed = screen.people.filter((p) => game.mine[p.id]?.jailedIn !== null && game.mine[p.id] !== undefined);
  const free = screen.people.filter((p) => !jailed.includes(p));
  const showRoll = r && r.caught !== null && (phase === 'roll' || phase === 'show');
  const landed = phase === 'show';
  // Catching shows once the dice lands: before that, the caught are still on the board.
  const justCaught = new Set(r?.caught ?? []);
  const onBoard = landed ? free : screen.people.filter((p) => !jailed.includes(p) || justCaught.has(p.id));
  const inJail = landed || !r || r.caught === null ? jailed : jailed.filter((p) => !justCaught.has(p.id));
  const fresh = r ? MECHANICS.find((m) => UNLOCK[m] === r.n) : undefined;
  const top = useMemo(() => {
    if (!screen.showNames) return [];
    return [...screen.people].filter((p) => (game.mine[p.id]?.score ?? 0) > 0).sort((a, b) => (game.mine[b.id]?.score ?? 0) - (game.mine[a.id]?.score ?? 0)).slice(0, 5);
  }, [screen.people, screen.showNames, game.mine]);
  const jailPic = painted('corners', `jail-${game.map}`);

  return (
    <div className={`fc-scene fc-scene--${game.map}`}>
      <div className="fc-stage">
        <CornersBoard map={game.map} round={r} t={t} flash={landed && r ? r.rolled : null}>
          {onBoard.map((p) => {
            const m = game.mine[p.id];
            const at = shown.current[p.id] ?? m?.spot;
            if (!at || !m) return null;
            const n = r?.n ?? 0;
            const cls = [
              m.shieldIn === n ? 'fc-token--shield' : '', m.speedTo !== null && n <= m.speedTo ? 'fc-token--fast' : '',
              m.ghostTo !== null && n <= m.ghostTo ? 'fc-token--ghost' : '', landed && justCaught.has(p.id) ? 'fc-token--caught' : '',
              landed && r?.saved.includes(p.id) ? 'fc-token--saved' : '', landed && !justCaught.has(p.id) && cornerOf(at) !== null && !r?.saved.includes(p.id) ? 'fc-token--safe' : '',
            ].join(' ');
            return (
              <Token key={p.id} x={at.x} y={at.y} size={AVATAR_R * 1.8} className={cls} label={nameOf(p)}>
                <AvatarImage avatar={avatars[p.id] ?? null} size={64} />
              </Token>
            );
          })}
          {pops.map((p) => <span key={p.key} className="fc-pop" style={{ left: `${p.at.x * 100}%`, top: `${p.at.y * 100}%` }}>{p.text}</span>)}
        </CornersBoard>

        <aside className="fc-side">
          <div className="fc-side__map">{words.name}</div>
          <div className="fc-side__round">{r ? `Round ${r.n}` : 'Get ready!'}</div>
          {fresh && phase === 'run' && <div className="fc-new" key={fresh}><b>New!</b> {MECH_ABOUT[fresh](words)}</div>}
          {r?.swap && phase === 'run' && <div className="fc-new fc-new--swap"><b>🔁 Second half!</b> Change corners every round: you can't stay in the corner you were in last time.</div>}
          {top.length > 0 && phase !== 'roll' && (
            <div className="fc-best">
              <h3>Most safe rounds</h3>
              <ol>{top.map((p) => <li key={p.id}><span>{p.name}</span><b>{game.mine[p.id]?.score ?? 0}</b></li>)}</ol>
            </div>
          )}
          <div className={`fc-jail ${jailPic ? 'fc-jail--painted' : ''}`} style={jailPic ? { backgroundImage: `url(${jailPic})` } : undefined} aria-label={words.jail}>
            <h3>🔒 {words.jail} <span>{inJail.length}</span></h3>
            <div className="fc-jail__cells">
              {inJail.map((p) => {
                const m = game.mine[p.id];
                return (
                  <div key={p.id} className="fc-jail__who">
                    <AvatarImage avatar={avatars[p.id] ?? null} size={44} />
                    <span className="fc-jail__locks" aria-label={`${m?.jailRight ?? 0} of ${JAIL_RIGHT} right`}>
                      {Array.from({ length: JAIL_RIGHT }, (_, i) => <i key={i} className={i < (m?.jailRight ?? 0) ? 'on' : ''} />)}
                    </span>
                    {nameOf(p) && <small>{nameOf(p)}</small>}
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>

      {!over && (phase === 'ready' || (phase === 'run' && secLeft !== null)) && (
        <div className={`fc-count ${secLeft !== null && secLeft <= 3 ? 'fc-count--low' : ''}`} key={secLeft ?? 'ready'} role="timer">
          {phase === 'ready' ? 'Get ready…' : secLeft}
        </div>
      )}
      {!over && showRoll && r && (
        <div className={`fc-rollbox ${landed ? 'fc-rollbox--landed' : ''}`}>
          <Dice face={r.twist === 'lucky' ? 'star' : (r.rolled[0] ?? 0)} two={r.twist === 'two' ? r.rolled[1] : null} landed={landed} />
          {landed && (
            <div className="fc-callout">
              {r.twist === 'lucky'
                ? '★ Lucky roll! Everyone in a corner is safe'
                : r.rolled.map((c) => CORNER_NAMES[c]).join(' and ') + (r.rolled.length > 1 ? ' corners!' : ' corner!')}
              <small>{(r.caught?.length ?? 0) === 0 ? 'Nobody caught!' : `${r.caught?.length} off to ${words.jail.toLowerCase()}`}{r.saved.length ? ` · 🛡️ ${r.saved.length} saved by a shield` : ''}{r.stayed?.length ? ` · 🔁 ${r.stayed.length} stayed put` : ''}</small>
            </div>
          )}
        </div>
      )}
      {over && <CornersFinish screen={screen} game={game} avatars={avatars} onAgain={onAgain} />}
    </div>
  );
}

/** The podium (names only when shown), safe rounds, and a few true shout-outs. */
function CornersFinish({ screen, game, avatars, onAgain }: { screen: ScreenView; game: CornersGame; avatars: Record<string, unknown>; onAgain: () => void }) {
  const top = podium(game, screen.people.map((p) => p.id));
  const byId = (id: string) => screen.people.find((p) => p.id === id);
  const ids = screen.people.map((p) => p.id);
  const m = (id: string) => game.mine[id];
  const names = (list: string[]) => {
    const n = list.map((id) => byId(id)?.name).filter(Boolean) as string[];
    return n.length > 2 ? `${n.slice(0, 2).join(', ')} and ${n.length - 2} more` : n.join(' and ');
  };
  /** The top pupils on a stat (ties share it); low: smallest wins. */
  const top1 = (f: (id: string) => number | undefined, low = false) => {
    let v: number | null = null;
    for (const id of ids) { const x = f(id); if (x !== undefined && x > 0 && (v === null || (low ? x < v : x > v))) v = x; }
    return v === null ? null : { v, who: ids.filter((id) => f(id) === v) };
  };
  const award = (emoji: string, title: string, f: (id: string) => number | undefined, say: (v: number) => string, low = false) => {
    const t = top1(f, low);
    return t ? { emoji, title, who: names(t.who), what: say(t.v) } : null;
  };
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const accuracy = (id: string) => {
    const r = m(id)?.right ?? 0;
    const w = m(id)?.wrong ?? 0;
    return r + w >= 5 ? Math.round((100 * r) / (r + w)) : undefined;
  };
  const untouched = ids.filter((id) => (m(id)?.caught ?? 0) === 0 && (m(id)?.safe ?? 0) > 0);
  const awards = screen.showNames ? [
    award('🍀', 'Luckiest', (id) => m(id)?.lucky, (v) => plural(v, 'lucky escape')),
    award('🎁', 'Power-up collector', (id) => m(id)?.grabs, (v) => `picked up ${v}`),
    award('⚡', 'Power player', (id) => m(id)?.powersUsed, (v) => `switched on ${v}`),
    award('🌀', 'Teleport traveller', (id) => m(id)?.warps, (v) => plural(v, 'warp')),
    award('🧮', 'Maths whizz', (id) => m(id)?.right, (v) => plural(v, 'right answer')),
    award('🔥', 'Hot streak', (id) => ((m(id)?.bestStreak ?? 0) >= 3 ? m(id)?.bestStreak : undefined), (v) => `${v} right in a row`),
    award('⏱️', 'Fastest answer', (id) => m(id)?.fastMs, (v) => `${(v / 1000).toFixed(1)} seconds`, true),
    award('🎯', 'Sharpshooter', accuracy, (v) => `${v}% right`),
    award('🔓', 'Great escaper', (id) => m(id)?.escapes, (v) => `got out ${plural(v, 'time')}`),
    award('🔑', 'Kind friend', (id) => m(id)?.freed, (v) => `freed ${v} from jail`),
    award('🦸', 'Lone ranger', (id) => m(id)?.alone, (v) => `${plural(v, 'round')} with a corner to themselves`),
    untouched.length > 0 && untouched.length < ids.length ? { emoji: '🛡️', title: 'Never caught', who: names(untouched), what: '' } : null,
  ].filter((x): x is { emoji: string; title: string; who: string; what: string } => !!x) : [];
  // Facts about the whole class (no names, so they show even with names off).
  const rolls = game.rolls ?? [0, 0, 0, 0];
  const most = Math.max(...rolls);
  const fav = most > 0 ? rolls.indexOf(most) : -1;
  const sum = (f: (id: string) => number | undefined) => ids.reduce((n, id) => n + (f(id) ?? 0), 0);
  const facts = [
    fav >= 0 && `🎲 The dice picked ${CORNER_NAMES[fav]} most (${plural(most, 'time')})`,
    (game.caughtAll ?? 0) > 0 && `🚔 ${plural(game.caughtAll ?? 0, 'trip')} to jail`,
    sum((id) => m(id)?.escapes) > 0 && `🔓 ${plural(sum((id) => m(id)?.escapes), 'escape')}`,
    sum((id) => m(id)?.right) > 0 && `🧮 ${plural(sum((id) => m(id)?.right), 'right answer')}`,
    sum((id) => m(id)?.powersUsed) > 0 && `⚡ ${plural(sum((id) => m(id)?.powersUsed), 'power-up')} switched on`,
    sum((id) => m(id)?.warps) > 0 && `🌀 ${plural(sum((id) => m(id)?.warps), 'teleport')}`,
  ].filter(Boolean) as string[];
  const rounds = game.round?.n ?? 0;
  return (
    <div className="cl-finish fc-finish" role="dialog" aria-label="Finish">
      <h2 className="cl-finish__title">Four Corners is over!</h2>
      <p className="cl-finish__sub">{rounds} {rounds === 1 ? 'round' : 'rounds'} on the {MAP_WORDS[game.map].name}</p>
      {screen.showNames && top.length > 0 && (
        <div className="fc-podium">
          {([2, 1, 3] as const).map((place) => (
            <div key={place} className={`fc-podium__step fc-podium__step--${place}`}>
              <div className="fc-podium__who">
                {top.filter((x) => x.place === place).slice(0, 3).map((x) => (
                  <span key={x.player}><AvatarImage avatar={avatars[x.player] ?? null} size={place === 1 ? 72 : 56} /><b>{byId(x.player)?.name}</b></span>
                ))}
              </div>
              <div className="fc-podium__block">{place}</div>
            </div>
          ))}
        </div>
      )}
      {facts.length > 0 && <p className="fc-facts">{facts.map((f, i) => <span key={i}>{f}</span>)}</p>}
      {awards.length > 0 && (
        <ul className="fc-awards">
          {awards.map((a, i) => (
            <li key={a.title} style={{ animationDelay: `${0.4 + i * 0.12}s` }}>
              <span className="fc-awards__emoji" aria-hidden="true">{a.emoji}</span>
              <span className="fc-awards__title">{a.title}</span>
              <b className="fc-awards__who">{a.who}</b>
              {a.what && <span className="fc-awards__what">{a.what}</span>}
            </li>
          ))}
        </ul>
      )}
      <div className="cl-finish__row">
        <button type="button" className="cl-btn cl-btn--go cl-btn--big" onClick={onAgain}>Back to Class Live</button>
      </div>
    </div>
  );
}
