/**
 * A fight against a classmate (docs/ARCHERY-PLAN.md, section 7, Stage 6): the same picture and HUD as a bot fight,
 * but every turn goes through the server, which plays it with the game's own engine. Both screens replay the fight's
 * turn list with the same engine and show each new turn as it arrives, so both pupils see the same arrows, blasts,
 * goo and shards. One round: win it, win the fight (James, 22 Oct 2026).
 *
 * Each turn has DUEL_TURN_MS on the server's clock, shown as a plain countdown (a warning colour for the last 10 s,
 * nothing flashing). When it runs out, either screen asks the server to use the turn up; the server checks its own
 * clock. On the classmate's turn the controls are off.
 *
 * No aiming help of any kind (James, 21 Oct 2026): angle and power are plain numbers. Angles are shown from the way
 * your archer faces, so the right-hand archer's 50° is the same lob as the left-hand archer's 50°.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSound } from '../../sound';
import { playSound } from '../sounds';
import { ARROWS, arrowKind } from '../../../shared/archery/arrows';
import { APPLE_HEALTH, DUEL_GRACE_MS, DUEL_MAX_TIMEOUTS, MAX_ANGLE, MAX_POWER, START_HEALTH } from '../../../shared/archery/config';
import { duelOpen, duelScores, duelSetup, seatOf, type DuelRow } from '../../../shared/archery/duel';
import { startFight, takeShot, type FightRun } from '../../../shared/archery/fight';
import { copyLand } from '../../../shared/archery/land';
import { DUEL_POINTS, DUEL_WIN_POINTS } from '../../../shared/archery/points';
import type { Archer, ArrowId, Shot, ShotRecord } from '../../../shared/archery/types';
import type { DuelResult } from '../../data/archery';
import { ShieldPips } from './FightScreen';
import { loadPrefs, savePrefs, wantsLessMotion, type ArcheryPrefs } from './prefs';
import type { FightView, ViewInsets } from './renderer';
import { ARROW_SHORT, WORLD_HINTS, WORLD_NAMES, windWords } from './text';
import './archery.css';

type Phase = 'loading' | 'aim' | 'wait' | 'sending' | 'flying' | 'over';

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Seconds left on a turn, shown whole (never below 0). */
const secondsLeft = (deadline: string, now: number) => Math.max(0, Math.ceil((Date.parse(deadline) - now) / 1000));

export function DuelScreen({ duel, me, serverNow, onShot, onTimesUp, onLeave, onReply, onDone }: {
  duel: DuelRow;
  me: string;
  serverNow: () => number;
  onShot: (version: number, shot: Shot) => Promise<DuelResult>;
  onTimesUp: () => Promise<DuelResult>;
  onLeave: () => Promise<DuelResult>;
  /** Every reply's fight goes back to the game (it keeps the newest). */
  onReply: (r: DuelResult) => void;
  /** Back to the game after the fight. */
  onDone: () => void;
}) {
  // The game only opens a fight the pupil is in.
  const seat: number = Math.max(0, seatOf(duel, me));
  const other = 1 - seat;
  const them = seat === 0 ? duel.name_b : duel.name_a;
  const world = duel.world;
  const setup = useMemo(() => duelSetup(world, [duel.packs[0] ?? { quiver: {}, shield: null }, duel.packs[1] ?? { quiver: {}, shield: null }]), [duel.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const run = useMemo<FightRun>(() => startFight(duel.seed, setup), [duel.seed, setup]);
  /** How many of the fight's turns the picture has shown (and the run has played). */
  const shown = useRef(0);
  const [, setVersion] = useState(0);
  const bump = () => setVersion((v) => v + 1);
  const duelRef = useRef(duel);
  duelRef.current = duel;

  const [prefs, setPrefs] = useState<ArcheryPrefs>(() => loadPrefs());
  const lessMotion = wantsLessMotion(prefs);
  const { soundOn } = useSound();
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;
  const beep = useCallback((s: Parameters<typeof playSound>[0]) => {
    if (soundRef.current) playSound(s);
  }, []);

  const [phase, setPhase] = useState<Phase>('loading');
  const phaseRef = useRef<Phase>('loading');
  phaseRef.current = phase;
  /** Angle as shown: from the way your archer faces (0 straight ahead, 90 straight up). */
  const [aim, setAim] = useState({ angle: 55, power: 60 });
  const aimRef = useRef(aim);
  aimRef.current = aim;
  const [arrow, setArrow] = useState<ArrowId>('plain');
  const [eatApple, setEatApple] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [shooter, setShooter] = useState(0);
  /** The turn being shown was used up by the timer. */
  const [passing, setPassing] = useState(false);
  const [message, setMessage] = useState('');
  const [problem, setProblem] = useState('');
  const [now, setNow] = useState(() => serverNow());

  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const top = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const viewRef = useRef<FightView | null>(null);
  const gone = useRef(false);
  const playing = useRef(false);
  const timesUpSent = useRef(-1);
  const heading = useRef<HTMLHeadingElement>(null);
  const dialogHeading = useRef<HTMLHeadingElement>(null);

  /** The engine's angle for the angle shown (the right-hand archer faces left). */
  const toEngine = (shownAngle: number) => (seat === 0 ? shownAngle : MAX_ANGLE - shownAngle);
  const round = run.round;
  const mine = round.archers[seat];
  const theirs = round.archers[other];
  const left = (id: ArrowId | 'apple' | 'umbrella') => Math.max(0, (setup.players[seat].quiver[id] ?? 0) - (run.used[seat][id] ?? 0));
  const packed = ARROWS.filter((a) => !a.unlimited && (setup.players[seat].quiver[a.id] ?? 0) > 0);
  const specialsLeft = packed.reduce((n, a) => n + left(a.id), 0);
  const applesLeft = left('apple');
  const arrowLeft = arrow === 'plain' ? Infinity : left(arrow);
  const stabbed = (mine.shardsBy ?? -1) >= 0 && !mine.popped;
  const score = duelScores(run)[seat];
  const caughtUp = shown.current >= duel.turns.length;
  const fightOver = !duelOpen(duel) && caughtUp;

  useEffect(() => {
    gone.current = false;
    return () => {
      gone.current = true;
    };
  }, []);

  // The picture: made once. A fight opened part-way (a reload) catches up without the animations.
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    let view: FightView | null = null;
    let dead = false;
    for (; shown.current < duelRef.current.turns.length; shown.current++) takeShot(run, duelRef.current.turns[shown.current]);
    void import('./renderer')
      .then((m) => {
        if (dead) return;
        const names: [string, string] = seat === 0 ? ['You', them] : [them, 'You'];
        view = m.createFightView(el, { lessMotion, simple: prefs.simple, names, looks: seat === 0 ? ['hero', 'rival'] : ['rival', 'hero'] });
        viewRef.current = view;
        resize();
        view.setRound(run.round);
        view.setAim(seat, toEngine(aimRef.current.angle), 0.15);
        void wait(lessMotion ? 150 : 1100).then(() => {
          if (dead) return;
          setPhase('wait');
          void catchUp();
        });
      })
      .catch(() => {
        if (!dead) setProblem('Your device could not draw the battlefield. Try another browser, or ask your teacher.');
      });
    return () => {
      dead = true;
      view?.dispose();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  useEffect(() => {
    viewRef.current?.setOptions({ lessMotion, simple: prefs.simple });
  }, [lessMotion, prefs.simple]);

  const resize = useCallback(() => {
    const el = stage.current;
    const view = viewRef.current;
    if (!el || !view) return;
    const r = el.getBoundingClientRect();
    const t = top.current?.getBoundingClientRect();
    const b = bottom.current?.getBoundingClientRect();
    const insets: ViewInsets = { top: t ? Math.max(0, t.bottom - r.top) : 0, bottom: b ? Math.max(0, r.bottom - b.top) : 0, left: 0, right: 0 };
    view.resize(r.width, r.height, insets);
  }, []);

  useEffect(() => {
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => resize());
    for (const el of [stage.current, top.current, bottom.current]) if (el) observer?.observe(el);
    window.addEventListener('resize', resize);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [resize]);

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);

  const over = phase === 'over';
  useEffect(() => {
    if (over || settingsOpen || pickerOpen || leaveOpen || problem) dialogHeading.current?.focus();
  }, [over, settingsOpen, pickerOpen, leaveOpen, problem]);

  useEffect(() => {
    if (phase === 'aim') viewRef.current?.setAim(seat, toEngine(aim.angle), 0.15);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aim.angle, phase]);

  // New turns from the server (mine or theirs): show them one at a time, in order.
  useEffect(() => {
    if (phaseRef.current !== 'loading') void catchUp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duel.turns.length, duel.status]);

  /** Shows every turn the picture hasn't shown yet, then whoever's turn it is. */
  async function catchUp() {
    if (playing.current || !viewRef.current) return;
    playing.current = true;
    try {
      while (!gone.current && shown.current < duelRef.current.turns.length) {
        const turn = duelRef.current.turns[shown.current];
        shown.current++;
        await showTurn(turn);
      }
    } finally {
      playing.current = false;
    }
    if (gone.current) return;
    const d = duelRef.current;
    if (!duelOpen(d) || run.winner !== null) {
      setPhase('over');
      const w = d.winner;
      if (d.ending === 'finished' && w !== null) {
        viewRef.current?.celebrate(w);
        beep(w === seat ? 'win' : 'end');
      }
      bump();
      return;
    }
    startTurn();
  }

  /** Whoever's turn it is now: you aim, or you wait for your classmate. */
  function startTurn() {
    const turn = run.round.turn;
    viewRef.current?.setTurn(turn);
    bump();
    if (turn === seat) {
      setPhase('aim');
      viewRef.current?.setAim(seat, toEngine(aimRef.current.angle), 0.15);
      if ((run.round.archers[seat].shardsBy ?? -1) >= 0) setMessage(`Glass shards! Hit ${them} this turn, or you pop.`);
    } else setPhase('wait');
  }

  /** Plays one turn in the run and shows it (a classmate's arrow swings their bow round first). */
  async function showTurn(turn: Shot) {
    const view = viewRef.current;
    const player = run.round.turn;
    const landBefore = copyLand(run.round.land);
    const archersBefore: [Archer, Archer] = [{ ...run.round.archers[0] }, { ...run.round.archers[1] }];
    if (player !== seat && !turn.pass) await view?.aimTo(player, turn.angle, turn.power / MAX_POWER, lessMotion ? 0 : 650);
    const taken = takeShot(run, turn, true);
    if (!taken.record) return;
    setShooter(player);
    setPassing(!!turn.pass);
    setPhase('flying');
    setMessage(turn.pass ? (player === seat ? 'Your time ran out, so your turn was used up.' : `${them}'s time ran out.`) : '');
    if (!turn.pass) beep('flick');
    const rec = taken.record;
    const ended = taken.ended ?? run.round;
    await view?.playShot({ player, record: rec, landBefore, landAfter: copyLand(ended.land), archersBefore, gooAfter: ended.goo });
    if (gone.current) return;
    if (rec.damage[0] + rec.damage[1] > 0) beep('boom');
    const words = describe(player, rec);
    if (words) setMessage(turn.pass ? `${player === seat ? 'Your time ran out.' : `${them}'s time ran out.`} ${words}` : words);
    bump();
  }

  function describe(player: number, rec: ShotRecord): string {
    const { damage, after } = rec;
    const name = (i: number) => (i === seat ? 'You' : them);
    const obj = (i: number) => (i === seat ? 'you' : them);
    const who = name(player);
    const otherOne = 1 - player;
    const parts: string[] = [];
    if (!rec.shot.pass) {
      if (rec.apple > 0) parts.push(`${who} ate an Apple (+${rec.apple}).`);
      const hit = damage[otherOne] - rec.goo[otherOne];
      if (hit > 0) parts.push(`${who} hit ${obj(otherOne)} for ${hit}.`);
      else parts.push(rec.hit.kind === 'gone' ? `${who} shot off the edge.` : `${who} missed.`);
      const self = damage[player] - rec.goo[player] - rec.sting;
      if (self > 0) parts.push(`${who} got hurt too (${self}).`);
    }
    for (const i of [0, 1]) if (rec.goo[i] > 0) parts.push(`The goo stung ${obj(i)} (${rec.goo[i]}).`);
    for (const i of [0, 1]) if (rec.umbrella[i]) parts.push(`${i === seat ? 'Your' : `${them}'s`} Umbrella opened.`);
    if (rec.glass === 'broke') parts.push(`${who} hit back and broke the glass shards${rec.sting ? ` (they stung for ${rec.sting})` : ''}.`);
    if (rec.glass === 'popped') parts.push(`${who === 'You' ? "You didn't" : `${them} didn't`} hit back, so the glass shards popped ${obj(player)}!`);
    if ((after[otherOne].shardsBy ?? -1) === player && rec.shot.arrow === 'glass' && !rec.shot.pass) {
      parts.push(`Glass shards stuck in ${obj(otherOne)}! ${otherOne === seat ? 'Hit back next turn, or you pop.' : `${them} must hit back next turn, or pop.`}`);
    }
    if (after[otherOne].popped && rec.glass !== 'popped') parts.push(`${name(otherOne)} popped!`);
    return parts.join(' ');
  }

  async function shoot() {
    if (phaseRef.current !== 'aim' || !viewRef.current) return;
    const d = duelRef.current;
    if (Date.parse(d.deadline) <= serverNow()) return;
    const a = aimRef.current;
    const use: ArrowId = arrow !== 'plain' && left(arrow) <= 0 ? 'plain' : arrow;
    const apple = eatApple && applesLeft > 0 && mine.health < START_HEALTH;
    if (use !== 'plain' && left(use) <= 1) setArrow('plain');
    else if (use !== arrow) setArrow('plain');
    setEatApple(false);
    setPhase('sending');
    setMessage('');
    const r = await onShot(d.version, { angle: toEngine(a.angle), power: a.power, arrow: use, ...(apple ? { apple: true } : {}) });
    if (gone.current) return;
    onReply(r);
    if (!r.ok) {
      setMessage(r.message);
      // Still my turn (a hiccup): aim again. Otherwise the new state shows itself.
      if ((phaseRef.current as Phase) === 'sending') {
        if (r.duel && r.duel.version !== d.version) setPhase('wait');
        else setPhase('aim');
      }
    }
  }

  // The turn clock, by the server's clock. When a turn's time has run out (plus a little for slow Wi-Fi), this screen
  // asks the server to use it up; the other screen may ask too, and the server takes the first.
  const ticking = duel.status === 'playing' && !over;
  useEffect(() => {
    if (!ticking) return;
    const timer = setInterval(() => {
      const t = serverNow();
      setNow(t);
      const d = duelRef.current;
      if (d.status === 'playing' && t > Date.parse(d.deadline) + DUEL_GRACE_MS && timesUpSent.current !== d.version) {
        timesUpSent.current = d.version;
        // A moment's random wait, so both screens rarely ask at the same instant.
        void wait(Math.random() * 800).then(async () => {
          if (gone.current || duelRef.current.version !== d.version) return;
          const r = await onTimesUp();
          if (!gone.current) onReply(r);
        });
      }
    }, 250);
    return () => clearInterval(timer);
  }, [ticking, serverNow, onTimesUp, onReply]);

  function nudge(which: 'angle' | 'power', by: number) {
    if (phaseRef.current !== 'aim') return;
    setAim((a) => ({ ...a, [which]: clamp(a[which] + by, 0, which === 'angle' ? MAX_ANGLE : MAX_POWER) }));
  }

  function changePrefs(next: ArcheryPrefs) {
    setPrefs(next);
    savePrefs(next);
  }

  async function leaveNow() {
    setLeaveOpen(false);
    const r = await onLeave();
    if (gone.current) return;
    onReply(r);
    if (!r.ok) setMessage(r.message);
  }

  // Keys: ← → turn the bow that way, ↑ ↓ power, Shift for steps of 5, space to shoot.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || settingsOpen || pickerOpen || leaveOpen || over) return;
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement) return;
      const step = e.shiftKey ? 5 : 1;
      const towardsLeft = seat === 0 ? step : -step;
      if (e.key === 'ArrowLeft') nudge('angle', towardsLeft);
      else if (e.key === 'ArrowRight') nudge('angle', -towardsLeft);
      else if (e.key === 'ArrowUp') nudge('power', step);
      else if (e.key === 'ArrowDown') nudge('power', -step);
      else if (e.key === ' ' && !(t instanceof HTMLButtonElement)) void shoot();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Touch aiming: drag back from your archer. Only the numbers and the archer's pose change; nothing is drawn.
  const drag = useRef<{ id: number } | null>(null);
  function pullFrom(e: React.PointerEvent): { angle: number; power: number } | null {
    const view = viewRef.current;
    const el = stage.current;
    const hands = view?.archerOnScreen(seat);
    if (!view || !el || !hands) return null;
    const r = el.getBoundingClientRect();
    const dx = hands.x - (e.clientX - r.left);
    const dy = hands.y - (e.clientY - r.top);
    let angle = Math.round((Math.atan2(-dy, dx) * 180) / Math.PI);
    if (angle < 0) angle = angle < -90 ? 180 : 0;
    const reach = Math.max(90, Math.min(r.width, r.height) * 0.4);
    const power = Math.round(clamp(Math.sqrt(dx * dx + dy * dy) / reach, 0, 1) * MAX_POWER);
    // That's the engine's angle; show it from the way your archer faces.
    return { angle: clamp(seat === 0 ? angle : MAX_ANGLE - angle, 0, MAX_ANGLE), power };
  }
  function pointerDown(e: React.PointerEvent) {
    if (phaseRef.current !== 'aim') return;
    const view = viewRef.current;
    const el = stage.current;
    const hands = view?.archerOnScreen(seat);
    if (!view || !el || !hands) return;
    const r = el.getBoundingClientRect();
    if (Math.hypot(e.clientX - r.left - hands.x, e.clientY - r.top - hands.y) >= Math.max(70, r.height * 0.14)) return;
    drag.current = { id: e.pointerId };
    el.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  }
  function pointerMove(e: React.PointerEvent) {
    if (!drag.current || drag.current.id !== e.pointerId || phaseRef.current !== 'aim') return;
    const next = pullFrom(e);
    if (!next) return;
    setAim(next);
    viewRef.current?.setAim(seat, toEngine(next.angle), next.power / MAX_POWER);
  }
  function pointerUp(e: React.PointerEvent) {
    if (!drag.current || drag.current.id !== e.pointerId) return;
    drag.current = null;
    viewRef.current?.setAim(seat, toEngine(aimRef.current.angle), 0.15);
  }

  const myTurn = phase === 'aim';
  const turnOf = phase === 'flying' ? shooter : round.turn;
  const secs = secondsLeft(duel.deadline, now);
  const timeUp = duel.status === 'playing' && secs <= 0;
  const showClock = duel.status === 'playing' && (phase === 'aim' || phase === 'wait' || phase === 'sending');
  const turnWords = phase === 'loading' ? 'Getting ready…'
    : phase === 'over' ? 'Fight over'
      : phase === 'flying' ? (passing ? "Time's up" : shooter === seat ? 'Your shot' : `${them}'s shot`)
        : phase === 'sending' ? 'Shooting…'
          : myTurn ? 'Your turn' : `${them} is aiming…`;
  const healthPct = (h: number) => `${clamp((h / START_HEALTH) * 100, 0, 100)}%`;
  const wind = round.wind;
  const nameOf = (i: number) => (i === seat ? 'You' : them);
  const pictureWords = `${WORLD_NAMES[world]} battlefield. ${seat === 0 ? 'Your archer is on the left' : 'Your archer is on the right'} with ${mine.popped ? 'no health left' : `${mine.health} health`}; ${them} has ${theirs.popped ? 'popped' : `${theirs.health} health`}. ${windWords(wind)}.`;

  // The fight's end, in words.
  const endTitle = (() => {
    if (duel.ending === 'finished') return duel.winner === seat ? 'You won the fight!' : duel.winner === other ? `${them} won the fight` : 'The fight is a draw';
    if (duel.ending === 'left') return duel.leaver === seat ? `You left. ${them} wins` : `${them} left, so you win`;
    if (duel.ending === 'timeouts') return 'The fight has stopped';
    if (duel.ending === 'switched-off') return 'The fight has stopped';
    if (duel.ending === 'idle') return 'The fight was put away';
    return 'The fight is over';
  })();
  const endWords = (() => {
    if (duel.ending === 'finished') {
      const pts = duel.winner === seat ? DUEL_WIN_POINTS : DUEL_POINTS;
      return `+${pts} points for finishing${duel.winner === seat ? ' and winning' : ''}.`;
    }
    if (duel.ending === 'left') return "No points this time, because the fight didn't finish.";
    if (duel.ending === 'timeouts') return `${duel.leaver === seat ? 'Your' : `${them}'s`} time ran out ${DUEL_MAX_TIMEOUTS} turns in a row. Nobody gets points.`;
    if (duel.ending === 'switched-off') return 'Your teacher switched Archery Challenge off. Nobody gets points.';
    if (duel.ending === 'idle') return 'Nobody shot for a long time. Nobody gets points.';
    return '';
  })();

  return (
    <section className="ar-fight" aria-labelledby="ar-duel-title" data-less-motion={lessMotion || undefined}>
      <h2 id="ar-duel-title" ref={heading} tabIndex={-1} className="ar-sr">Archery Challenge: {WORLD_NAMES[world]}, against {them}</h2>
      <div ref={stage} className="ar-stage" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onContextMenu={(e) => e.preventDefault()}>
        <canvas ref={canvas} className="ar-canvas" role="img" aria-label={pictureWords} />
      </div>

      <div ref={top} className="ar-top">
        {[0, 1].map((i) => {
          const a = round.archers[i];
          return (
            <div key={i} className={`ar-card${i === 1 ? ' ar-card--bot' : ''}`} data-turn={turnOf === i && !over ? true : undefined} data-classmate={i === other || undefined}>
              <span className="ar-card__name">{nameOf(i)}</span>
              <span className="ar-bar" role="meter" aria-label={i === seat ? 'Your health' : `${them}'s health`} aria-valuemin={0} aria-valuemax={START_HEALTH} aria-valuenow={a.health}>
                <span className="ar-bar__fill" style={{ width: healthPct(a.health) }} data-low={a.health < 35 || undefined} />
              </span>
              <span className="ar-card__num">{a.health}</span>
              {a.guard && <ShieldPips archer={a} who={i === seat ? 'Your' : `${them}'s`} />}
            </div>
          );
        }).reduce<React.ReactNode[]>((out, card, i) => (i === 0 ? [card] : [...out, (
          <div key="mid" className="ar-mid">
            <span className="ar-turn" data-bot={(turnOf === other && !over) || undefined} aria-live="polite">{turnWords}</span>
            <span className="ar-wind" aria-label={windWords(wind)}>
              <span aria-hidden="true">Wind</span>
              <span className="ar-wind__arrow" aria-hidden="true" data-dir={wind > 0 ? 'right' : wind < 0 ? 'left' : 'none'}>{wind > 0 ? '→' : wind < 0 ? '←' : '·'}</span>
              <b aria-hidden="true">{Math.abs(wind)}</b>
            </span>
            {showClock && (
              <span className="ar-clock" role="timer" data-warn={secs <= 10 || undefined} aria-label={`${secs} seconds left for ${round.turn === seat ? 'your' : `${them}'s`} turn`}>
                <span aria-hidden="true">{round.turn === seat ? 'Your time' : `${them}`}</span> <b aria-hidden="true">{secs}</b><span aria-hidden="true"> s</span>
              </span>
            )}
          </div>
        ), card]), [])}
        <div className="ar-topbtns">
          <button type="button" className="button button--light ar-btn ar-iconbtn" aria-label="Settings" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(true)}>⚙</button>
          {!over && <button type="button" className="button button--light ar-btn" onClick={() => setLeaveOpen(true)}>Leave</button>}
        </div>
      </div>

      <p className="ar-toast" role="status" aria-live="polite">{message}</p>
      {myTurn && showClock && secs <= 10 && secs > 0 && <p className="ar-sr" role="status">{secs <= 5 ? `${secs} seconds left` : '10 seconds left'}</p>}
      {stabbed && myTurn && <p className="ar-warn" role="alert">Glass shards! Hit {them} this turn, or you pop.</p>}
      <p className="ar-rotate">Turn your phone sideways for a bigger view.</p>

      <div ref={bottom} className="ar-bottom">
        <div className="ar-stats" aria-label="Your fight">
          <span className="ar-stat"><span>Arrows</span><b aria-label={`${specialsLeft} special arrows left`}>{specialsLeft}</b></span>
          <span className="ar-stat"><span>Score</span><b>{score}</b></span>
        </div>
        <div className="ar-dial">
          <button type="button" className="button button--light ar-btn ar-step" aria-label="Angle down" disabled={!myTurn || timeUp} onClick={() => nudge('angle', -1)}>−</button>
          <label className="ar-dial__label">
            <span>Angle <output>{aim.angle}°</output></span>
            <input type="range" className="ar-range" min={0} max={MAX_ANGLE} step={1} value={aim.angle} disabled={!myTurn || timeUp} onChange={(e) => setAim((a) => ({ ...a, angle: Number(e.target.value) }))} />
          </label>
          <button type="button" className="button button--light ar-btn ar-step" aria-label="Angle up" disabled={!myTurn || timeUp} onClick={() => nudge('angle', 1)}>+</button>
        </div>
        <div className="ar-dial">
          <button type="button" className="button button--light ar-btn ar-step" aria-label="Power down" disabled={!myTurn || timeUp} onClick={() => nudge('power', -1)}>−</button>
          <label className="ar-dial__label">
            <span>Power <output>{aim.power}</output></span>
            <input type="range" className="ar-range" min={0} max={MAX_POWER} step={1} value={aim.power} disabled={!myTurn || timeUp} onChange={(e) => setAim((a) => ({ ...a, power: Number(e.target.value) }))} />
          </label>
          <button type="button" className="button button--light ar-btn ar-step" aria-label="Power up" disabled={!myTurn || timeUp} onClick={() => nudge('power', 1)}>+</button>
        </div>
        <div className="ar-quiver" role="group" aria-label="Arrow and helpers">
          <button type="button" className="button button--light ar-btn ar-pick" aria-haspopup="dialog" aria-label={`Arrow: ${arrowKind(arrow).name}, ${arrow === 'plain' ? 'never runs out' : `${arrowLeft} left`}. Choose another arrow`} onClick={() => setPickerOpen(true)}>
            <span className="ar-pick__long">{arrowKind(arrow).name}</span><span className="ar-pick__short" aria-hidden="true">{ARROW_SHORT[arrow]}</span> <small>{arrow === 'plain' ? '∞' : arrowLeft}</small> <span aria-hidden="true">▾</span>
          </button>
          {(setup.players[seat].quiver.apple ?? 0) > 0 && (
            <button type="button" className="button button--light ar-btn ar-pick" aria-pressed={eatApple} disabled={applesLeft <= 0 || mine.health >= START_HEALTH} aria-label={`Eat an Apple with this shot (+${APPLE_HEALTH} health), ${applesLeft} left`} onClick={() => setEatApple((v) => !v)}>
              <span aria-hidden="true">Apple</span> <small aria-hidden="true">{applesLeft}</small>
            </button>
          )}
        </div>
        <button type="button" className="button button--play ar-btn ar-shoot" disabled={!myTurn || timeUp} onClick={() => void shoot()}>Shoot</button>
      </div>

      {phase === 'loading' && !problem && <p className="ar-loading" role="status">One round against {them}: win it to win the fight. {WORLD_HINTS[world]}</p>}

      {problem && (
        <div className="ar-overlay" role="alertdialog" aria-labelledby="ar-duel-problem">
          <div className="ar-panel">
            <h2 id="ar-duel-problem" ref={dialogHeading} tabIndex={-1}>The battlefield won't start</h2>
            <p>{problem}</p>
            <button type="button" className="button button--play ar-btn" onClick={() => void leaveNow().then(onDone)}>Back</button>
          </div>
        </div>
      )}

      {over && fightOver && (
        <div className="ar-overlay ar-overlay--soft" role="dialog" aria-modal="true" aria-labelledby="ar-duel-end">
          <div className="ar-panel">
            <h2 id="ar-duel-end" ref={dialogHeading} tabIndex={-1}>{endTitle}</h2>
            <p>Your score (damage you did): <strong>{score}</strong></p>
            {endWords && <p>{endWords}</p>}
            <p className="ar-help">Any arrows and helpers you didn't use are back in your bag.</p>
            <div className="ar-row">
              <button type="button" className="button button--play ar-btn" onClick={onDone}>Done</button>
            </div>
          </div>
        </div>
      )}

      {leaveOpen && (
        <div className="ar-overlay" role="alertdialog" aria-modal="true" aria-labelledby="ar-duel-leave" onKeyDown={(e) => e.key === 'Escape' && setLeaveOpen(false)}>
          <div className="ar-panel">
            <h2 id="ar-duel-leave" ref={dialogHeading} tabIndex={-1}>Are you sure? {them} will win.</h2>
            <p>Nobody gets points when someone leaves. Any arrows you didn't use come back to your bag.</p>
            <div className="ar-row">
              <button type="button" className="button button--danger ar-btn" onClick={() => void leaveNow()}>Leave the fight</button>
              <button type="button" className="button button--light ar-btn" onClick={() => { setLeaveOpen(false); heading.current?.focus({ preventScroll: true }); }}>Keep fighting</button>
            </div>
          </div>
        </div>
      )}

      {pickerOpen && (
        <div className="ar-overlay" role="dialog" aria-modal="true" aria-labelledby="ar-duel-picker" onKeyDown={(e) => e.key === 'Escape' && setPickerOpen(false)}>
          <div className="ar-panel ar-panel--wide">
            <h2 id="ar-duel-picker" ref={dialogHeading} tabIndex={-1}>Choose an arrow</h2>
            <div className="ar-arrows">
              {[arrowKind('plain'), ...packed].map((a) => {
                const n = a.unlimited ? Infinity : left(a.id);
                return (
                  <button key={a.id} type="button" className="button button--light ar-btn ar-arrow" aria-pressed={arrow === a.id} disabled={n <= 0} onClick={() => { setArrow(a.id); setPickerOpen(false); heading.current?.focus({ preventScroll: true }); }}>
                    <b>{a.name}</b> <span className="ar-arrow__n">{a.unlimited ? '∞' : `${n} left`}</span>
                    <span className="ar-arrow__does">{a.does}</span>
                  </button>
                );
              })}
            </div>
            {packed.length === 0 && <p className="ar-help">You didn't pack any special arrows for this fight.</p>}
            <button type="button" className="button button--light ar-btn" onClick={() => { setPickerOpen(false); heading.current?.focus({ preventScroll: true }); }}>Back</button>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="ar-overlay" role="dialog" aria-modal="true" aria-labelledby="ar-duel-settings" onKeyDown={(e) => e.key === 'Escape' && setSettingsOpen(false)}>
          <div className="ar-panel">
            <h2 id="ar-duel-settings" ref={dialogHeading} tabIndex={-1}>Settings</h2>
            <label className="ar-check">
              <input type="checkbox" checked={prefs.simple} onChange={(e) => changePrefs({ ...prefs, simple: e.target.checked })} />
              Simpler graphics (smoother on a slow device)
            </label>
            <label className="ar-check">
              <input type="checkbox" checked={lessMotion} onChange={(e) => changePrefs({ ...prefs, lessMotion: e.target.checked })} />
              Less motion (no shaking or swooping)
            </label>
            <p className="ar-help">Keys: ← → turn your bow, ↑ ↓ power (hold Shift for 5 at a time), space to shoot. On a touch screen, drag back from your archer like pulling a bowstring, then press Shoot. Each turn has a time limit: shoot before it runs out.</p>
            <button type="button" className="button button--play ar-btn" onClick={() => { setSettingsOpen(false); heading.current?.focus({ preventScroll: true }); }}>Done</button>
          </div>
        </div>
      )}
    </section>
  );
}
