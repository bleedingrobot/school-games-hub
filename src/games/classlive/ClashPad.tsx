/**
 * Colour Clash, the pupil's device (docs/CLASH-PLAN.md): a joystick (or arrow keys / WASD) runs their avatar over the
 * board and the database paints the tiles they cross in their team's colour (`link.clashPaint`, about every 0.4 s;
 * painting is decided there, not here). The bomb button brings a maths question; while it is open the avatar stands
 * still (James, 25 Nov 2026 NZ), and a right answer splats their colour round where they stand. Never shows anyone
 * else's results; the board shows the other pupils as dots.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AvatarImage } from '../../avatar/AvatarImage';
import {
  AVATAR_R, blankTiles, GRAB_R, MAP_WORDS, painting, POWER_WORDS, stepMove, TEAM_WORDS, type ClashPower, type ClashRound,
} from '../../../shared/classlive/clash';
import type { MoveState, Spot } from '../../../shared/classlive/corners';
import type { PlayerView, RoomView } from '../../../shared/classlive/server';
import type { PublicQuestion } from '../../../shared/maths/serverQuestions';
import { QuestionModal, type MarkedAnswer } from '../../maths/QuestionModal';
import { ClashBoard, ClashToken, clashPowerPic, teamColour, withTiles, type Splat } from './ClashBoard';
import { ClashGuide } from './ClashGuide';
import { Joystick, useKeys } from './CornersPad';
import type { ClassLiveLink } from './link';
import './controller.css';

type Mine = Extract<PlayerView['game'], { kind: 'clash' }>;
type Pub = Extract<RoomView['game'], { kind: 'clash' }>;
const SEND_MS = 400;
const factOf = (q: PublicQuestion, answer: number) => q.parts.map((p) => p.replace(/\?/g, String(answer))).join(' ');

export function ClashPad({ link, room, view, me, setMe, setView, clock, avatar }: {
  link: ClassLiveLink; room: number | null; view: RoomView; me: PlayerView | null;
  setMe: (m: PlayerView) => void; setView: (f: (v: RoomView | null) => RoomView | null) => void;
  clock: () => number;
  avatar?: unknown;
}) {
  const pub: Pub | null = view.game.kind === 'clash' ? view.game : null;
  const mg: Mine | null = me && me.game.kind === 'clash' ? me.game : null;
  const r = (pub?.round ?? null) as (ClashRound & { items: { id: number; x: number; y: number; power: ClashPower }[] }) | null;
  const keysDir = useKeys();
  const stickDir = useRef<Spot>({ x: 0, y: 0 });
  const pos = useRef<MoveState>({ p: mg?.spot ?? { x: 0.5, y: 0.5 }, v: { x: 0, y: 0 } });
  const placed = useRef(-1);
  const others = useRef<Spot[]>([]);
  const lastSent = useRef(0);
  const since = useRef<number | null>(null);
  const tilesRound = useRef(0);
  const [tiles, setTiles] = useState(blankTiles());
  const grabbing = useRef<number | null>(null);
  const [, setFrame] = useState(0);
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [asking, setAsking] = useState(false);
  const [splats, setSplats] = useState<Splat[]>([]);
  const [say, setSay] = useState<{ n: number; text: string; good?: boolean } | null>(null);
  const [guide, setGuide] = useState(false);
  const [shake, setShake] = useState(0);
  const sayN = useRef(0);
  const pendingMe = useRef<{ me?: PlayerView; view?: RoomView } | null>(null);
  const toast = useCallback((text: string, good?: boolean) => setSay({ n: ++sayN.current, text, good }), []);
  const tNow = () => (view.startedAt === null ? 0 : clock() - view.startedAt);

  if (mg && mg.placed !== placed.current) {
    placed.current = mg.placed;
    pos.current = { p: { ...mg.spot }, v: { x: 0, y: 0 } };
  }

  /** Save the spot (painting on the way) and take the tiles that changed. */
  const send = useCallback((p: Spot) => {
    if (room === null) return;
    void link.clashPaint(room, p.x, p.y, since.current).then((out) => {
      if (!out) return;
      others.current = out.spots;
      if (out.round !== tilesRound.current) {
        // A new round: a clean board.
        tilesRound.current = out.round;
        setTiles(withTiles(blankTiles(), out.tiles));
      } else if (out.tiles.length) setTiles((old) => withTiles(old, out.tiles));
      since.current = out.round !== tilesRound.current ? null : out.now - 50;
    }, () => undefined);
  }, [link, room]);

  const live = view.state === 'live' && !!r;
  const frozen = !!question || asking;

  useEffect(() => {
    if (room === null || !live) return;
    let id = 0;
    let last = performance.now();
    const loop = (ts: number) => {
      const dt = ts - last;
      last = ts;
      const t = tNow();
      const now = Date.now();
      if (r && painting(r, t) && !frozen) {
        const k = keysDir();
        const dir = k.x || k.y ? k : stickDir.current;
        const before = pos.current.p;
        const hitBefore = pos.current.hitAt;
        pos.current = stepMove(pos.current, dir, dt, r, t, !!mg && mg.speedTo !== null && t < mg.speedTo);
        if (pos.current.hitAt !== undefined && pos.current.hitAt !== hitBefore && pub) {
          toast(`💥 The ${MAP_WORDS[pub.map].roller.toLowerCase()} knocked you flying!`);
          try { navigator.vibrate?.(200); } catch { /* not on this device */ }
          setShake(Date.now());
        }
        const warped = Math.hypot(pos.current.p.x - before.x, pos.current.p.y - before.y) > 0.2;
        if (now - lastSent.current >= SEND_MS || warped) {
          lastSent.current = now;
          send(pos.current.p);
        }
        if (!mg?.held && grabbing.current === null) {
          const it = r.items.find((x) => Math.hypot(x.x - pos.current.p.x, x.y - pos.current.p.y) < GRAB_R + AVATAR_R);
          if (it) {
            grabbing.current = it.id;
            const p = pos.current.p;
            void link.clashPaint(room, p.x, p.y, since.current).then(() => link.send({ action: 'play', room, grab: it.id })).then((out) => {
              const b = out.body as { me?: PlayerView; view?: RoomView };
              if (b.me) setMe(b.me);
              if (b.view) setView(() => b.view as RoomView);
              if (out.status === 200 && b.me?.game.kind === 'clash' && b.me.game.held) toast(`${POWER_WORDS[b.me.game.held].emoji} Got ${POWER_WORDS[b.me.game.held].name}! Drop a bomb to switch it on.`, true);
            }, () => undefined).finally(() => { window.setTimeout(() => { grabbing.current = null; }, 600); });
          }
        }
      } else if (now - lastSent.current > 1000) {
        // Not painting (ready, counting, answering): keep the board up to date.
        lastSent.current = now;
        send(pos.current.p);
      }
      setFrame((f) => (f + 1) % 1_000_000);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, live, r, frozen, mg?.held, mg?.speedTo, send, link]);

  const t = tNow();
  const canBomb = live && !!r && painting(r, t) && !frozen && (mg ? clock() - (view.startedAt ?? 0) >= mg.nextAt : false);
  const bomb = async () => {
    if (room === null || asking || question) return;
    setAsking(true);
    // Save where we stand first: the bomb lands there.
    await link.clashPaint(room, pos.current.p.x, pos.current.p.y, since.current).catch(() => null);
    const out = await link.send({ action: 'ask', room }).catch(() => null);
    const b = out?.body as { question?: PublicQuestion; error?: string } | undefined;
    if (out?.status === 200 && b?.question) setQuestion(b.question);
    else if (b?.error) toast(String(b.error));
    setAsking(false);
  };
  // A question goes away when painting stops.
  const paintingNow = !!r && painting(r, t);
  useEffect(() => { if (question && !paintingNow) setQuestion(null); }, [question, paintingNow]);

  const onSubmit = async (value: number, ms: number): Promise<MarkedAnswer> => {
    const q = question as PublicQuestion;
    let out;
    try {
      out = await link.send({ action: 'answer', room, slot: q.slot, answer: value, ms });
    } catch {
      throw new Error('We lost the connection. Try again.');
    }
    const b = out.body as { right?: boolean; answer?: number; me?: PlayerView; view?: RoomView; error?: string; reason?: string };
    if (out.status !== 200) {
      if (b.reason === 'answered' || b.reason === 'not_now') setQuestion(null);
      throw new Error(String(b.error ?? 'Try again.'));
    }
    pendingMe.current = { me: b.me, view: b.view };
    return { correct: b.right === true, fact: factOf(q, b.answer as number), boxBefore: 0, boxAfter: 0, answer: b.answer as number };
  };
  const onDone = () => {
    const was = mg;
    const next = pendingMe.current;
    pendingMe.current = null;
    if (next?.me) setMe(next.me);
    if (next?.view) setView(() => next.view as RoomView);
    setQuestion(null);
    const now = next?.me?.game.kind === 'clash' ? next.me.game : null;
    if (now && was && now.bombs > was.bombs) {
      setSplats((s) => [...s, { key: Date.now(), x: pos.current.p.x, y: pos.current.p.y, r: now.streak >= 5 ? 3.6 : now.streak >= 3 ? 2.9 : 2.2, team: now.team }].slice(-4));
      window.setTimeout(() => setSplats((s) => s.slice(1)), 1000);
      try { navigator.vibrate?.(80); } catch { /* not on this device */ }
      if (was.held) toast(`${POWER_WORDS[was.held].emoji} ${POWER_WORDS[was.held].name}! ${POWER_WORDS[was.held].how}`, true);
      else toast(now.streak >= 3 ? `💥 ${now.streak} in a row: a bigger splat!` : '💣 Splat!', true);
      lastSent.current = 0;
    }
  };

  if (!pub || !mg) return <div className="cl-c-center"><p className="cl-c-say">Getting ready…</p></div>;
  const team = TEAM_WORDS[mg.team];
  const tc = { ['--tc' as string]: teamColour(mg.team) };
  const words = MAP_WORDS[pub.map];

  if (view.state === 'lobby') {
    return (
      <div className="cl-c-center" style={tc}>
        <h1 className="cl-c-title">You're on the <span className="cc-pad__team">{team.name}</span> team!</h1>
        <div className="cc-pad-me"><AvatarImage avatar={avatar ?? null} size={120} /></div>
        <p className="cl-c-say">Run over the floor to paint it {team.name.toLowerCase()}. Tap 💣 and answer a question to splat a big patch!</p>
        <p className="cl-c-say">Today's map: <b>{words.name}</b></p>
        <button type="button" className="cl-btn fc-guide-btn" onClick={() => setGuide(true)}>⚡ Power-ups and hazards</button>
        {guide && <ClashGuide map={pub.map} onClose={() => setGuide(false)} />}
      </div>
    );
  }
  if (view.state === 'over') {
    return (
      <div className="cl-c-center" style={tc}>
        <h1 className="cl-c-title">{mg.place === 1 ? `🏆 ${team.name} wins!` : mg.place ? `${team.name} came ${['', '1st', '2nd', '3rd', '4th'][mg.place]}` : 'Finished!'}</h1>
        <div className="cc-pad-me"><AvatarImage avatar={avatar ?? null} size={110} /></div>
        <ul className="cc-pad-stats">
          {([
            ['🎨', mg.painted, 'tiles painted'],
            ['💣', mg.bombs, 'paint bombs'],
            ['🔥', mg.bestStreak, 'right in a row, best'],
            ['🎁', mg.grabs, 'power-ups picked up'],
          ] as const).filter(([, n]) => n > 0).map(([e, n, w]) => <li key={w}><span aria-hidden="true">{e}</span> <b>{n}</b> {w}</li>)}
        </ul>
        <p className="cl-c-look">Look at the big screen!</p>
      </div>
    );
  }

  const ready = !!r && t < r.paintFrom;
  const counting = !!r && t >= r.paintTo;
  const left = r && paintingNow ? Math.max(0, Math.ceil((r.paintTo - t) / 1000)) : null;
  const here = pos.current.p;
  const speedOn = mg.speedTo !== null && t < mg.speedTo;
  const brushOn = mg.brushTo !== null && t < mg.brushTo;
  return (
    <div className="cc-pad cc-pad--run" style={tc}>
      <header className="cc-pad__top">
        <span className="cc-pad__team">{team.emoji} {team.name}</span>
        {left !== null ? <b className={`cc-pad__left ${left <= 5 ? 'is-low' : ''}`}>{left}</b> : <b>{ready ? 'Get ready…' : counting ? '👀 Look at the big screen!' : ''}</b>}
        <span>Round {r?.n ?? 0}</span>
      </header>
      <div className={`cc-pad__board ${Date.now() - shake < 500 ? 'cc-pad__hit' : ''}`}>
        <ClashBoard map={pub.map} round={r} t={t} tiles={tiles} splats={splats} dim={!paintingNow}>
          {others.current.map((o, i) => <span key={i} className="cc-dot" style={{ left: `${o.x * 100}%`, top: `${o.y * 100}%` }} />)}
          <ClashToken x={here.x} y={here.y} size={AVATAR_R * 2.3} team={mg.team} className={`cc-token--me ${frozen ? 'cc-token--frozen' : ''} ${speedOn ? 'cc-token--fast' : ''} ${brushOn ? 'cc-token--brush' : ''}`} label="You">
            <AvatarImage avatar={avatar ?? null} size={64} />
          </ClashToken>
        </ClashBoard>
      </div>
      <div className="cc-pad__controls">
        {mg.held && (
          <div className="cc-held" role="status">
            {clashPowerPic(mg.held) ? <img src={clashPowerPic(mg.held) as string} alt="" /> : <span className="cc-held__emoji" aria-hidden="true">{POWER_WORDS[mg.held].emoji}</span>}
            <span><b>{POWER_WORDS[mg.held].name}</b><br />Your next bomb switches it on.</span>
          </div>
        )}
        {(speedOn || brushOn) && <div className="cc-held" role="status"><span className="cc-held__emoji">{brushOn ? '🖌️' : '👟'}</span><b>{brushOn ? 'Big Brush ON' : 'Speed Shoes ON'}</b></div>}
        {paintingNow && !question && <Joystick onDir={(d) => { stickDir.current = d; }} />}
        <button type="button" className="cc-bomb" disabled={!canBomb} onClick={() => void bomb()} aria-label="Paint bomb: answer a question to splat your colour">
          <span aria-hidden="true">💣</span>{asking ? '…' : 'Bomb'}
        </button>
      </div>
      <div className="cl-c-fb cc-fb" aria-live="polite">
        {say && <div key={say.n} className={`cl-s-card${say.good ? ' cl-s-card--right' : ''}`}><p className="cl-s-card__text">{say.text}</p></div>}
      </div>
      {question && (
        <div className="cc-q">
          <QuestionModal
            key={question.slot}
            question={{ id: question.slot, parts: question.parts, spoken: question.spoken, prompt: question.prompt, choices: question.choices, choiceLabels: question.choiceLabels, input: question.input, maxLength: question.maxLength }}
            title={mg.held ? `💣 Bomb + ${POWER_WORDS[mg.held].name}` : '💣 Paint bomb'}
            note={mg.streak >= 2 ? `${mg.streak} in a row: keep going for a bigger splat!` : 'Answer right to splat your colour'}
            spot="Colour Clash" inline scribble={false} onSubmit={onSubmit} onDone={onDone}
          />
        </div>
      )}
    </div>
  );
}
