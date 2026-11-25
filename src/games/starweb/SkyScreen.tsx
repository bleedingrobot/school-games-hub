/**
 * One Star Web sky (docs/STARWEB-PLAN.md "How a sky plays"): the class game's night sky (StarSky) with the known fact in the
 * middle, the keypad and the feedback card. Every try is judged at once with the shared rules (shared/starweb/sky.ts); new
 * stars are sent to the server every few stars or 20 seconds, and the server's re-checked stars always win.
 *
 * Help follows the pupil and comes slowly (James, 25 Nov 2026: "if kids get stuck it should slowly give them hints"): no new
 * star for 20 seconds brings a nudge to the emptiest arm, 20 more the hint with this fact's numbers, 20 more a "Show me"
 * worked example on a different fact. A new star takes the help back down. Never this sky's answers.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ARMS, ARM_GOAL, ARM_NAMES, type Arm, type StarsGame } from '../../../shared/classlive/stars';
import { GOLD, SAVE_EVERY_MS, SAVE_EVERY_STARS, SILVER, STALL_MS, WRONG_FOR_WORKING } from '../../../shared/starweb/config';
import { addTry, allLit, armCounts, countedStars, emptiestArm, medalOf, nextStep, shapeOf, showMe, whyLine, workingFor, type SoloReply, type SoloStar } from '../../../shared/starweb/sky';
import { NightBackdrop, StarSky } from '../classlive/StarSky';
import { ARM_COLOURS, lagHint } from '../classlive/arms';
import { useMusic } from '../classlive/music';
import { useSound } from '../../sound';
import { playSound } from '../sounds';
import type { FinishReply, PublicSky, StarWebBackend } from './backend';
import { StarWebError } from './backend';
import type { Say } from './voice';
import { skyBackdrop } from './art';
import { FEEDBACK, GUIDE, guideShow, MEDAL_WORDS, NUDGE, SAY_AGAIN, SAY_FINISH_READY, SAY_SAME, SAY_UNLINKED, SAY_WRONG, SHOW_ME, SHOW_ME_SAY, unlinked } from './words';
import '../classlive/projector.css';

const MAX_LEN = 30;
const KEYS: { k: string; label: string; aria: string; op?: boolean }[] = [
  { k: '7', label: '7', aria: '7' }, { k: '8', label: '8', aria: '8' }, { k: '9', label: '9', aria: '9' }, { k: '÷', label: '÷', aria: 'divided by', op: true },
  { k: '4', label: '4', aria: '4' }, { k: '5', label: '5', aria: '5' }, { k: '6', label: '6', aria: '6' }, { k: '×', label: '×', aria: 'times', op: true },
  { k: '1', label: '1', aria: '1' }, { k: '2', label: '2', aria: '2' }, { k: '3', label: '3', aria: '3' }, { k: '−', label: '−', aria: 'minus', op: true },
  { k: '0', label: '0', aria: '0' }, { k: '.', label: '.', aria: 'point' }, { k: '=', label: '=', aria: 'equals', op: true }, { k: '+', label: '+', aria: 'plus', op: true },
];

type Card =
  | { n: number; kind: 'new'; star: SoloStar }
  | { n: number; kind: 'note'; text: string; tone?: 'soft' | 'why' };

export interface SkyProps {
  sky: PublicSky;
  backend: StarWebBackend;
  /** The guided first go: one lit-up thing at a time. */
  guided: boolean;
  onGuideDone(): void;
  onFinished(reply: FinishReply): void;
  onLeave(): void;
  say: Say;
  voice: { on: boolean; setOn(v: boolean): void; available: boolean };
}

export function SkyScreen({ sky, backend, guided, onGuideDone, onFinished, onLeave, say, voice }: SkyProps) {
  const { soundOn, setSoundOn } = useSound();
  const anchor = sky.anchor;
  const [stars, setStars] = useState<SoloStar[]>(sky.stars);
  const starsRef = useRef(stars);
  starsRef.current = stars;
  const [text, setText] = useState('');
  const textRef = useRef(text);
  textRef.current = text;
  const [card, setCard] = useState<Card | null>(null);
  const n = useRef(0);
  const [guide, setGuide] = useState<number | null>(guided ? 0 : null);
  const [rung, setRung] = useState(0);
  const [showing, setShowing] = useState<{ arm: Arm; lines: string[] } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);

  // Fly-in, arm drawing, the whale and the supernova (only for what happens now, not stars carried on from before).
  const [arriving, setArriving] = useState<Set<number>>(new Set());
  const [drawing, setDrawing] = useState<Set<Arm>>(new Set());
  const [swim, setSwim] = useState(false);
  const [nova, setNova] = useState(0);

  // Saving as it goes.
  const pending = useRef<string[]>([]);
  const hints = useRef(sky.hints);
  const savedHints = useRef(sky.hints);
  const saving = useRef(false);
  const lastStarAt = useRef(Date.now());
  const wrongs = useRef(new Map<string, number>());

  const counted = countedStars(stars);
  const medal = medalOf(stars);
  const lit = allLit(stars);
  useMusic(counted >= SILVER ? 'stars-hot' : 'stars', soundOn);

  const flush = useCallback(async () => {
    if (saving.current || (!pending.current.length && hints.current === savedHints.current)) return;
    saving.current = true;
    const tries = pending.current.slice();
    const h = hints.current;
    try {
      const r = await backend.save(sky.seed, tries, h);
      pending.current = pending.current.slice(tries.length);
      savedHints.current = h;
      setProblem(null);
      // The server's re-checked stars win (plus any typed while it answered).
      let mine = { anchor, stars: r.stars };
      for (const t of pending.current) mine = addTry(mine, t).sky;
      if (mine.stars.length !== starsRef.current.length) setStars(mine.stars);
    } catch (e) {
      setProblem(e instanceof StarWebError ? e.message : 'Your stars didn’t save. They will try again soon.');
    } finally {
      saving.current = false;
    }
  }, [backend, sky.seed, anchor]);

  // Save every few stars, or a while after an unsaved one.
  useEffect(() => {
    if (!pending.current.length) return;
    if (pending.current.length >= SAVE_EVERY_STARS) {
      void flush();
      return;
    }
    const id = window.setTimeout(() => void flush(), SAVE_EVERY_MS);
    return () => window.clearTimeout(id);
  }, [stars, flush]);

  // The slow help ladder: one rung each time no new star comes for STALL_MS (paused during the guide and "Show me").
  useEffect(() => {
    if (guide !== null || showing || lit) return;
    const id = window.setInterval(() => {
      if (Date.now() - lastStarAt.current < STALL_MS) return;
      lastStarAt.current = Date.now();
      setRung((r) => {
        if (r >= 3) return r;
        hints.current++;
        if (r === 0) {
          const arm = emptiestArm(starsRef.current);
          if (arm) say(NUDGE[arm]);
        }
        return r + 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [guide, showing, lit, say]);

  const note = (t: string, tone?: 'soft' | 'why') => setCard({ n: ++n.current, kind: 'note', text: t, tone });

  const send = useCallback(() => {
    const t = textRef.current.replace(/\s+/g, '');
    if (!t || finishing) return;
    const before = starsRef.current;
    const { sky: next, reply } = addTry({ anchor, stars: before }, t);
    react(reply);
    if (reply.result === 'new') {
      pending.current.push(t);
      const id = next.stars.length;
      setStars(next.stars);
      setText('');
      setRung(0);
      lastStarAt.current = Date.now();
      setArriving((s) => new Set(s).add(id));
      window.setTimeout(() => setArriving((s) => { const c = new Set(s); c.delete(id); return c; }), 1400);
      if (soundOn) playSound('item');
      const arm = reply.star.a;
      const wasLit = before.filter((s) => s.a === arm).length >= ARM_GOAL[arm];
      if (!wasLit && next.stars.filter((s) => s.a === arm).length >= ARM_GOAL[arm]) {
        setDrawing((s) => new Set(s).add(arm));
        window.setTimeout(() => setDrawing((s) => { const c = new Set(s); c.delete(arm); return c; }), 2200);
      }
      if (!allLit(before) && allLit(next.stars)) {
        setSwim(true);
        window.setTimeout(() => setSwim(false), 25_000);
        if (soundOn) playSound('win');
        say(MEDAL_WORDS[1].say);
        void flush();
      }
      const was = medalOf(before);
      const now = medalOf(next.stars);
      if (now > was && now >= 2) {
        if (now === 3) setNova((v) => v + 1);
        say(MEDAL_WORDS[now as 2 | 3].say);
      }
      if (guide === 0) setGuide(1);
    } else if (reply.result === 'again') {
      setText('');
    }
  }, [anchor, finishing, soundOn, say, flush, guide]);

  function react(reply: SoloReply) {
    switch (reply.result) {
      case 'new':
        setCard({ n: ++n.current, kind: 'new', star: reply.star });
        return;
      case 'again':
        note(FEEDBACK.again, 'soft');
        say(SAY_AGAIN);
        return;
      case 'same':
        note(FEEDBACK.same, 'soft');
        say(SAY_SAME);
        return;
      case 'unlinked':
        note(unlinked(anchor), 'soft');
        say(SAY_UNLINKED);
        return;
      case 'wrong': {
        const shape = shapeOf(reply.fact);
        const tries = (wrongs.current.get(shape) ?? 0) + 1;
        wrongs.current.set(shape, tries);
        const why = whyLine(reply.fact, anchor);
        const working = tries >= WRONG_FOR_WORKING ? workingFor(reply.fact, anchor) : null;
        if (working) note(`${FEEDBACK.wrong} ${working}`, 'why');
        else if (why) note(`${FEEDBACK.wrong} ${why}`, 'why');
        else {
          note(FEEDBACK.wrong);
          say(SAY_WRONG);
        }
        return;
      }
      case 'unreadable':
        note(FEEDBACK.unreadable, 'soft');
        return;
      case 'full':
        note(FEEDBACK.full, 'soft');
    }
  }

  const add = useCallback((k: string) => setText((t) => (t.length >= MAX_LEN ? t : t + k)), []);
  const back = useCallback(() => setText((t) => t.slice(0, -1)), []);
  const clear = useCallback(() => setText(''), []);

  // A real keyboard works too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || showing) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      const k = e.key;
      let handled = true;
      if (/^[0-9.+=×÷−]$/.test(k)) add(k);
      else if (k === '-') add('−');
      else if (k === '*' || k === 'x' || k === 'X') add('×');
      else if (k === '/') add('÷');
      else if (k === 'Backspace') back();
      else if (k === 'Escape') clear();
      else if (k === 'Enter') {
        if ((target?.tagName === 'BUTTON') && target.dataset.swKey === undefined) return;
        send();
      } else handled = false;
      if (handled) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [add, back, clear, send, showing]);

  // The guide reads each step once.
  useEffect(() => {
    if (guide === null) return;
    if (anchor.x === 3 && anchor.y === 4) say(GUIDE[guide].say);
  }, [guide, anchor, say]);

  // Leaving the screen saves what's left.
  useEffect(() => () => void flush(), [flush]);

  const leave = async () => {
    await flush();
    onLeave();
  };

  const finish = async () => {
    setFinishing(true);
    try {
      const r = await backend.finish(sky.seed, pending.current.slice(), hints.current);
      pending.current = [];
      if ('progress' in r) onFinished(r as FinishReply);
      else onLeave();
    } catch (e) {
      setProblem(e instanceof StarWebError ? e.message : 'That didn’t finish. Try again.');
      setFinishing(false);
    }
  };

  const openShowMe = () => {
    const arm = emptiestArm(stars) ?? 'wild';
    hints.current++;
    setShowing({ arm, lines: showMe(arm, anchor) });
    say(SHOW_ME_SAY);
  };

  const game: StarsGame = useMemo(() => ({
    kind: 'stars', level: 'own', anchor,
    stars: stars.map((s, i) => ({ id: i + 1, key: s.k, text: s.t, arm: s.a, how: s.h, by: 'me', at: 0, glow: 0 })),
    creature: allLit(stars), supernova: countedStars(stars) >= GOLD, spotlight: null, mine: {},
  }), [stars, anchor]);

  const backPic = useMemo(() => skyBackdrop(sky.seed, typeof window !== 'undefined' && window.innerWidth < 900), [sky.seed]);
  const counts = armCounts(stars);
  const helpArm = emptiestArm(stars);
  const step = nextStep({ anchor, stars });
  const next = medal === 0 ? 'every arm' : medal === 1 ? `silver at ${SILVER}` : medal === 2 ? `gold at ${GOLD}` : 'gold!';

  return (
    <div className="sw-sky">
      <div className="sw-sky__stage">
        <NightBackdrop />
        {backPic && <div className="cl-painted" style={{ backgroundImage: `url(${backPic})` }} aria-hidden="true" />}
        <StarSky game={game} fresh={{}} arriving={arriving} pulsing={new Set()} drawing={drawing} swim={swim} over={lit && !swim} nova={nova} />
        <div className="sw-sky__top">
          <button type="button" className="sw-btn sw-btn--glass" onClick={() => void leave()}>← Star Map</button>
          <p className="sw-count" aria-live="polite"><b>⭐ {counted}</b> {counted === 1 ? 'star' : 'stars'} · {next}</p>
          <span className="sw-sky__icons">
            <button type="button" className="sw-btn sw-btn--glass sw-btn--icon" aria-pressed={soundOn} onClick={() => setSoundOn(!soundOn)} title="Sound and music">{soundOn ? '🔊' : '🔇'}</button>
            {voice.available && <button type="button" className="sw-btn sw-btn--glass sw-btn--icon" aria-pressed={voice.on} onClick={() => voice.setOn(!voice.on)} title={voice.on ? 'Voice on' : 'Voice off'}>{voice.on ? '🗣️' : '🤫'}</button>}
          </span>
        </div>
      </div>

      <section className="sw-pad" aria-label="Find facts">
        <div className="sw-known">
          <h1 className="sw-known__fact" tabIndex={-1} ref={heading} aria-label={`We know ${anchor.x} times ${anchor.y} equals ${anchor.p}`}>{anchor.x} × {anchor.y} = {anchor.p}</h1>
          <p className="sw-known__ask">What else do we know?</p>
        </div>

        <ul className="sw-arms" aria-label="Arms">
          {ARMS.map((a) => (
            <li key={a} className={`sw-arm${counts[a] >= ARM_GOAL[a] ? ' sw-arm--lit' : ''}${guide === 0 && a === 'turn' ? ' sw-arm--pulse' : ''}`} style={{ '--arm': ARM_COLOURS[a] } as React.CSSProperties} title={ARM_NAMES[a]}>
              <span className="sw-sr">{ARM_NAMES[a]}: </span>{Math.min(counts[a], ARM_GOAL[a])}/{ARM_GOAL[a]}
            </li>
          ))}
        </ul>

        {guide !== null && (
          <div className="sw-guide" role="dialog" aria-label="Guide">
            <p>{guideShow(guide, anchor)}</p>
            {guide > 0 && (
              <button type="button" className="sw-btn sw-btn--primary" onClick={() => {
                if (guide < GUIDE.length - 1) setGuide(guide + 1);
                else { setGuide(null); lastStarAt.current = Date.now(); onGuideDone(); }
              }}>{guide < GUIDE.length - 1 ? 'Next' : 'Off you go!'}</button>
            )}
          </div>
        )}

        <div className="sw-display" role="status" aria-label="Your fact">
          {text ? <span>{text}</span> : <span className="sw-display__ghost">{guide === 0 ? `${anchor.y} × ${anchor.x} = ${anchor.p}` : '12 × 7 = 84'}</span>}
          <i className="sw-caret" aria-hidden="true" />
        </div>

        <div className="sw-fb" aria-live="polite">
          {card && (card.kind === 'new' ? (
            <div key={card.n} className="sw-card sw-card--new" style={{ '--arm': ARM_COLOURS[card.star.a] } as React.CSSProperties}>
              <p className="sw-card__head">⭐ New star! <span>{ARM_NAMES[card.star.a]}</span></p>
              <p className="sw-card__text">{card.star.h}</p>
            </div>
          ) : (
            <div key={card.n} className={`sw-card${card.tone === 'why' ? ' sw-card--why' : ''}`}><p className="sw-card__text">{card.text}</p></div>
          ))}
        </div>

        {rung > 0 && helpArm && !showing && guide === null && (
          <div className="sw-help" style={{ '--arm': ARM_COLOURS[helpArm] } as React.CSSProperties}>
            <p><b>💡 {ARM_NAMES[helpArm]}:</b> {rung === 1 ? NUDGE[helpArm] : lagHint(helpArm, anchor)}</p>
            {rung >= 3 && <button type="button" className="sw-btn sw-btn--small" onClick={openShowMe}>{SHOW_ME}</button>}
          </div>
        )}

        {showing && (
          <div className="sw-showme" role="dialog" aria-label="Show me" style={{ '--arm': ARM_COLOURS[showing.arm] } as React.CSSProperties}>
            <p className="sw-showme__head">{ARM_NAMES[showing.arm]}, on a different fact</p>
            {showing.lines.map((l, i) => <p key={i} className="sw-showme__line" style={{ animationDelay: `${i * 0.9}s` }}>{l}</p>)}
            <p className="sw-showme__now">Now try it with {anchor.x} × {anchor.y} = {anchor.p}.</p>
            <button type="button" className="sw-btn sw-btn--primary" onClick={() => { setShowing(null); setRung(1); lastStarAt.current = Date.now(); }}>Back to my sky</button>
          </div>
        )}

        <div className="sw-keys" role="group" aria-label="Keypad">
          {KEYS.map((k) => (
            <button key={k.k} type="button" data-sw-key="" className={`sw-key${k.op ? ' sw-key--op' : ''}`} aria-label={k.aria} onClick={() => add(k.k)}>{k.label}</button>
          ))}
          <button type="button" data-sw-key="" className="sw-key sw-key--fn" aria-label="Backspace" onClick={back}>⌫</button>
          <button type="button" data-sw-key="" className="sw-key sw-key--fn" aria-label="Clear" onClick={clear}>Clear</button>
          <button type="button" data-sw-key="" className="sw-send" disabled={!text || finishing} onClick={send}>Send ⭐</button>
        </div>

        <p className="sw-next">{step}</p>
        {rung < 3 && !lit && guide === null && !showing && (
          <button type="button" className="sw-link" onClick={() => { lastStarAt.current = 0; }}>{rung ? 'Another hint please' : 'I’m stuck: a hint please'}</button>
        )}
        {problem && <p className="sw-problem" role="alert">{problem}</p>}
        {lit && (
          <div className="sw-finish">
            <p>{counted >= GOLD ? 'Gold! Find more if you like.' : SAY_FINISH_READY}</p>
            <button type="button" className="sw-btn sw-btn--play" disabled={finishing} onClick={() => void finish()}>Finish {medal === 3 ? '🥇' : medal === 2 ? '🥈' : '🥉'}</button>
          </div>
        )}
      </section>
    </div>
  );
}
