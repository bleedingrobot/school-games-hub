/**
 * Royal Decree's screens (docs/DECREE-PLAN.md): pick a ruler, then villagers come one at a time. Drag the card right
 * for yes or left for no (or press the buttons, or the arrow keys); arrows on the four meters show what a choice will
 * do. Every third villager asks a maths question from the pupil's focus. The browser plays ahead with the shared rules
 * for instant feedback and saves to the server at the end of each year; the server replays the moves itself.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { CARDS_IN_REIGN, METER_MOST, METER_NAME, METERS, RIDDLE_BONUS, SEASONS, WINTER_FOOD, YEARS, type Meter } from '../../../shared/decree/config';
import { CAST, villager } from '../../../shared/decree/cast';
import { ENDINGS } from '../../../shared/decree/cards';
import { hintFor, nextCard, play, seasonOf, yearOf, type EndingId, type Meters, type Move, type Reign, type Side } from '../../../shared/decree/engine';
import { DECK, LOOKS, type Album, type Look, type PublicReign } from '../../../shared/decree/server';
import type { Choice } from '../../../shared/decree/types';
import { liveDecree } from '../../data/decree';
import { QuestionModal, type MarkedAnswer } from '../../maths/QuestionModal';
import { playSound } from '../sounds';
import { personArt, rulerArt, rulerThumb, sceneArt, type SceneId } from './art';
import type { AnswerReply, DecreeBackend, LoadReply, ReignReply } from './backend';
import { factText } from './factText';
import { HowToPlayBody } from './HowToPlay';
import { speak, stopSpeaking } from '../../speech';
import { haleVoiceOn, setHaleVoiceOn, setTutorialOn, spoken, TIPS, TOUR, tutorialOn, VOICE_FOLDER, YOUR_TURN, type Spot } from './tutorial';
import './decree.css';

const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'];
const ENDING_SCENE: Record<EndingId, SceneId> = { full: 'end-legendary', food: 'end-hard', gold: 'end-fair', happy: 'end-fair', safe: 'end-hard' };
/** How far a card must be dragged to count as a choice, in pixels. */
const SWIPE_AT = 90;

// ---------------------------------------------------------------- little pictures

function MeterIcon({ meter, size = 26 }: { meter: Meter; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true } as const;
  if (meter === 'food') {
    return (
      <svg {...common}><path d="M12 22V9" stroke="#7a4b12" strokeWidth="2" strokeLinecap="round" />
        {[4, 8, 12].map((y) => <g key={y}><ellipse cx="9" cy={y + 1} rx="2.4" ry="3.4" fill="#f2b632" transform={`rotate(-30 9 ${y + 1})`} /><ellipse cx="15" cy={y + 1} rx="2.4" ry="3.4" fill="#f2b632" transform={`rotate(30 15 ${y + 1})`} /></g>)}
      </svg>
    );
  }
  if (meter === 'gold') {
    return <svg {...common}><circle cx="12" cy="12" r="9" fill="#f6c431" stroke="#a16207" strokeWidth="2" /><circle cx="12" cy="12" r="5" fill="none" stroke="#a16207" strokeWidth="1.5" /></svg>;
  }
  if (meter === 'happy') {
    return <svg {...common}><circle cx="12" cy="12" r="9.5" fill="#fb923c" stroke="#9a3412" strokeWidth="1.5" /><circle cx="9" cy="10" r="1.4" fill="#4a1d06" /><circle cx="15" cy="10" r="1.4" fill="#4a1d06" /><path d="M7.5 14c1.2 2.2 7.8 2.2 9 0" stroke="#4a1d06" strokeWidth="1.8" fill="none" strokeLinecap="round" /></svg>;
  }
  return <svg {...common}><path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" fill="#60a5fa" stroke="#1e3a8a" strokeWidth="1.8" /><path d="M12 6v12" stroke="#1e3a8a" strokeWidth="1.4" /></svg>;
}

/** The four meters, with arrows for what the choice being looked at would do. */
function MeterBar({ meters, hint, changed, spot = false }: { meters: Meters; hint: Partial<Record<Meter, number>> | null; changed: Partial<Record<Meter, number>> | null; spot?: boolean }) {
  return (
    <ul className={`rd-meters${spot ? ' rd-spot' : ''}`} aria-label="Your kingdom">
      {METERS.map((m) => {
        const h = hint?.[m] ?? 0;
        const c = changed?.[m] ?? 0;
        const low = meters[m] <= 2;
        return (
          <li key={m} className={`rd-meter rd-meter--${m}${low ? ' is-low' : ''}${c > 0 ? ' went-up' : c < 0 ? ' went-down' : ''}`}>
            <MeterIcon meter={m} />
            <span className="rd-meter__name">{METER_NAME[m]}</span>
            <span className="rd-meter__track" role="meter" aria-valuemin={0} aria-valuemax={METER_MOST} aria-valuenow={meters[m]} aria-label={`${METER_NAME[m]} ${meters[m]} of ${METER_MOST}`}>
              <span className="rd-meter__fill" style={{ width: `${(meters[m] / METER_MOST) * 100}%` }} />
            </span>
            <span className="rd-meter__hint" aria-hidden={!h}>
              {h > 0 ? '▲'.repeat(h) : h < 0 ? '▼'.repeat(-h) : ''}
              {h !== 0 && <span className="rd-sr">{h > 0 ? ' goes up' : ' goes down'}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** What a choice does, shown on its button so it is seen without hovering (tablets have no hover). */
function Effects({ choice }: { choice: Choice }) {
  const h = hintFor(choice);
  const parts = METERS.filter((m) => h[m]);
  if (!parts.length) return null;
  return (
    <span className="rd-fx">
      {parts.map((m) => (
        <span key={m} className={h[m]! > 0 ? 'is-up' : 'is-down'}>
          <MeterIcon meter={m} size={18} />
          <span aria-hidden="true">{h[m]! > 0 ? '▲'.repeat(h[m]!) : '▼'.repeat(-h[m]!)}</span>
          <span className="rd-sr">{METER_NAME[m]} {h[m]! > 0 ? 'up' : 'down'}</span>
        </span>
      ))}
    </span>
  );
}

/** Six years of four seasons, as dots. */
function Road({ turn, spot = false }: { turn: number; spot?: boolean }) {
  const n = Math.min(CARDS_IN_REIGN, turn + 1);
  return (
    <div className={`rd-road${spot ? ' rd-spot' : ''}`} aria-label={`Year ${yearOf(n)} of ${YEARS}, ${SEASON_NAMES[seasonOf(n)]}`}>
      <span className="rd-road__label">Year {yearOf(n)} of {YEARS} · {SEASON_NAMES[seasonOf(n)]}</span>
      <span className="rd-road__dots" aria-hidden="true">
        {Array.from({ length: CARDS_IN_REIGN }, (_, i) => (
          <span key={i} className={`rd-dot${i < turn ? ' is-done' : i === turn ? ' is-now' : ''}${(i + 1) % SEASONS === 0 ? ' is-year' : ''}`} />
        ))}
      </span>
    </div>
  );
}

function Portrait({ who, big = false }: { who: string; big?: boolean }) {
  const v = villager(who);
  const src = personArt(who);
  if (src) return <img className={`rd-portrait${big ? ' rd-portrait--big' : ''}`} src={src} alt="" decoding="async" draggable={false} />;
  return <span className={`rd-portrait rd-portrait--badge${big ? ' rd-portrait--big' : ''}`} aria-hidden="true">{v?.name.replace(/^(Sir|Lady|Captain|Queen) /, '')[0] ?? '?'}</span>;
}

/** Hale's tip bubble (the guide for new players). */
function Tip({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="rd-tip" role="status">
      {personArt('steward') && <img src={personArt('steward')} alt="" className="rd-tip__face" />}
      <p><strong>Hale:</strong> {children}</p>
      <button type="button" className="rd-btn rd-btn--quiet" onClick={onClose}>Got it</button>
    </div>
  );
}

/** One step of Hale's tutorial (./tutorial.ts). The player's-turn step has no Next: they make the choice themselves. */
function TourBubble({ step, onNext, onSkip }: { step: number; onNext: () => void; onSkip: () => void }) {
  const s = TOUR[step];
  const last = step === TOUR.length - 1;
  return (
    <div className="rd-tip rd-tour" role="status">
      {personArt('steward') && <img src={personArt('steward')} alt="" className="rd-tip__face" />}
      <p><span className="rd-tour__count">Tutorial {step + 1} of {TOUR.length}</span><strong>Hale:</strong> {s.text}</p>
      <span className="rd-tour__buttons">
        {!s.yourTurn && <button key={step} type="button" className="rd-btn rd-btn--hot" autoFocus onClick={onNext}>{last ? 'Start ruling' : 'Next step'}</button>}
        {!last && <button type="button" className="rd-btn rd-btn--quiet" onClick={onSkip}>Skip the tutorial</button>}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------- the card

/** A villager's request. Drag it, use the buttons, or press ← and →. */
function RequestCard({ who, text, no, yes, onChoose, onLean, locked = false, spot = 'none' }: {
  who: string; text: string; no: Choice; yes: Choice; onChoose: (side: Side) => void; onLean: (side: Side | null) => void;
  /** The tutorial is still explaining: the card can't be chosen yet. */
  locked?: boolean;
  spot?: Spot;
}) {
  const [dx, setDx] = useState(0);
  const start = useRef<number | null>(null);
  const v = villager(who);
  const lean: Side | null = dx > 30 ? 'yes' : dx < -30 ? 'no' : null;
  useEffect(() => onLean(lean), [lean, onLean]);

  const down = (e: ReactPointerEvent) => {
    if (e.button !== 0 || locked) return;
    start.current = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: ReactPointerEvent) => {
    if (start.current !== null) setDx(e.clientX - start.current);
  };
  const up = () => {
    if (start.current === null) return;
    start.current = null;
    if (dx > SWIPE_AT) onChoose('yes');
    else if (dx < -SWIPE_AT) onChoose('no');
    setDx(0);
  };

  return (
    <div className="rd-deal">
      <div
        className={`rd-card${lean ? ` is-leaning-${lean}` : ''}${spot === 'card' ? ' rd-spot' : ''}`}
        style={{ transform: `translateX(${dx}px) rotate(${dx / 18}deg)` }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => { start.current = null; setDx(0); }}
      >
        <span className="rd-card__lean rd-card__lean--no" aria-hidden="true">{no.label}</span>
        <span className="rd-card__lean rd-card__lean--yes" aria-hidden="true">{yes.label}</span>
        <Portrait who={who} big />
        <p className="rd-card__who"><strong>{v?.name}</strong>, {v?.role}</p>
        <p className="rd-card__text">{text}</p>
      </div>
      <div className={`rd-choices${spot === 'choices' ? ' rd-spot' : ''}`}>
        <button type="button" className="rd-btn rd-btn--no" disabled={locked} onClick={() => onChoose('no')} onMouseEnter={() => onLean('no')} onMouseLeave={() => onLean(null)} onFocus={() => onLean('no')} onBlur={() => onLean(null)}>
          <span className="rd-choice__label"><span aria-hidden="true">← </span>{no.label}</span>
          <Effects choice={no} />
        </button>
        <button type="button" className="rd-btn rd-btn--yes" disabled={locked} onClick={() => onChoose('yes')} onMouseEnter={() => onLean('yes')} onMouseLeave={() => onLean(null)} onFocus={() => onLean('yes')} onBlur={() => onLean(null)}>
          <span className="rd-choice__label">{yes.label}<span aria-hidden="true"> →</span></span>
          <Effects choice={yes} />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- the game

type Screen = 'loading' | 'start' | 'play' | 'end' | 'album' | 'howto' | 'error';
type After =
  | { kind: 'reply'; who: string; text: string }
  | { kind: 'year'; year: number };

const delta = (a: Meters, b: Meters): Partial<Record<Meter, number>> => {
  const out: Partial<Record<Meter, number>> = {};
  for (const m of METERS) if (b[m] !== a[m]) out[m] = b[m] - a[m];
  return out;
};

export function DecreePlay({ backend = liveDecree }: { backend?: DecreeBackend; level?: unknown }) {
  const [screen, setScreen] = useState<Screen>('loading');
  const [error, setError] = useState('');
  const [album, setAlbum] = useState<Album | null>(null);
  const [pointsLeft, setPointsLeft] = useState(0);
  const [look, setLook] = useState<Look>(LOOKS[0]);
  const [pub, setPub] = useState<PublicReign | null>(null);
  const [local, setLocal] = useState<Reign | null>(null);
  const [answered, setAnswered] = useState<Record<string, { right: boolean; answer: number }>>({});
  const [after, setAfter] = useState<After | null>(null);
  const [changed, setChanged] = useState<Partial<Record<Meter, number>> | null>(null);
  const [lean, setLean] = useState<Side | null>(null);
  const [asking, setAsking] = useState(false);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'failed'>('idle');
  const [points, setPoints] = useState<number | null>(null);
  const [tips, setTips] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  // The tutorial: the step showing (null when it isn't), whether it ran this reign, and the start screen's switch.
  const [tour, setTour] = useState<number | null>(null);
  const [toured, setToured] = useState(false);
  const [wantTour, setWantTour] = useState(tutorialOn);
  const [voice, setVoice] = useState(haleVoiceOn);
  const pending = useRef<Move[]>([]);
  const savedTurn = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const firstReign = (album?.reigns ?? 0) === 0;

  useEffect(() => heading.current?.focus(), [screen]);

  const load = useCallback(async () => {
    setScreen('loading');
    try {
      const r = (await backend.send({ action: 'load' })) as unknown as LoadReply;
      setAlbum(r.album);
      setPointsLeft(r.pointReignsLeft);
      if (r.reign) {
        setPub(r.reign);
        setLocal(r.reign.reign);
        setAnswered(r.reign.answered);
        setLook(r.reign.look);
        savedTurn.current = r.reign.reign.turn;
        pending.current = [];
      }
      setScreen('start');
    } catch (e) {
      setError((e as Error).message);
      setScreen('error');
    }
  }, [backend]);
  useEffect(() => void load(), [load]);

  async function begin() {
    setBusy(true);
    try {
      const r = (await backend.send({ action: 'start', look })) as unknown as ReignReply;
      setPub(r.reign);
      setLocal(r.reign.reign);
      setAnswered({});
      savedTurn.current = 0;
      pending.current = [];
      setAfter(null);
      setChanged(null);
      setPoints(null);
      setTips([]);
      setTour(wantTour ? 0 : null);
      setToured(wantTour);
      setScreen('play');
    } catch (e) {
      setError((e as Error).message);
      setScreen('error');
    } finally {
      setBusy(false);
    }
  }

  /** Sends the moves since the last save. At the end of a reign, the reply carries the points. */
  async function save(target: Reign) {
    if (!pub || !pending.current.length) return;
    const moves = [...pending.current];
    setSaving('saving');
    try {
      const r = (await backend.send({ action: 'save', reign: pub.id, from: savedTurn.current, moves })) as unknown as ReignReply;
      pending.current = pending.current.slice(moves.length);
      savedTurn.current = r.reign.reign.turn;
      setPub(r.reign);
      // The server's replay is the truth. It only differs if a riddle answer didn't reach it.
      if (r.reign.reign.turn === target.turn && JSON.stringify(r.reign.reign.meters) !== JSON.stringify(target.meters)) setLocal(r.reign.reign);
      if (r.reign.points !== undefined) setPoints(r.reign.points);
      setSaving('idle');
    } catch {
      setSaving('failed');
    }
  }

  function moveOn(move: Move, right: boolean, reply: After | null) {
    if (!local) return;
    const next = play(local, DECK, move, right);
    if (!next) return;
    pending.current.push(move);
    setChanged(delta(local.meters, next.meters));
    setLocal(next);
    setLean(null);
    if (next.status !== 'playing' || next.turn % SEASONS === 0) void save(next);
    playSound(next.status === 'over' ? 'end' : 'flick');
    setAfter(reply);
    if (!reply) afterReply(next);
  }

  function afterReply(r: Reign | null = local) {
    if (!r) return;
    setAfter(null);
    if (r.status !== 'playing') {
      setScreen('end');
      playSound(r.status === 'full' ? 'win' : 'end');
      return;
    }
    if (r.turn % SEASONS === 0) {
      setAfter({ kind: 'year', year: yearOf(r.turn + 1) });
      return;
    }
    setChanged(null);
  }

  const next = useMemo(() => (local && screen === 'play' ? nextCard(local, DECK) : null), [local, screen]);

  function choose(side: Side) {
    if (!next || next.kind !== 'card' || after) return;
    if (tour !== null && tour !== YOUR_TURN) return;
    const choice = next.card[side];
    if (tour === YOUR_TURN) setTour(tour + 1);
    moveOn(side, false, choice.reply ? { kind: 'reply', who: next.card.who, text: choice.reply } : null);
  }

  useEffect(() => {
    if (screen !== 'play' || after || asking || next?.kind !== 'card' || (tour !== null && tour !== YOUR_TURN)) return;
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'ArrowLeft') choose('no');
      if (e.key === 'ArrowRight') choose('yes');
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  async function answer(slot: number, value: number, ms: number): Promise<MarkedAnswer> {
    if (!pub) throw new Error('That question has gone.');
    const r = (await backend.send({ action: 'answer', reign: pub.id, slot, value, ms: Math.round(ms) })) as unknown as AnswerReply;
    setAnswered((a) => ({ ...a, [String(slot)]: { right: r.right, answer: r.answer } }));
    const q = pub.questions[slot];
    const meter = next?.kind === 'riddle' ? next.riddle.meter : 'happy';
    return {
      correct: r.right, fact: factText(q, r.answer), boxBefore: 0, boxAfter: 0, answer: r.answer,
      ...(r.right ? { reward: `+${RIDDLE_BONUS} ${METER_NAME[meter]}!` } : {}),
    };
  }

  // Hale's tips for a first reign (and the low-meter warning, once a reign).
  const tip = (() => {
    if (!local || after || asking || screen !== 'play' || tour !== null) return null;
    const show = (id: string, text: string) => (tips.includes(id) ? null : { id, text });
    const lowMeter = METERS.find((m) => local.meters[m] <= 2);
    if (lowMeter) return show(`low-${lowMeter}`, TIPS.low(lowMeter));
    if (!firstReign || toured) return null;
    if (local.turn === 0) return show('swipe', TIPS.swipe);
    if (local.turn === 1) return show('arrows', TIPS.arrows);
    if (next?.kind === 'riddle') return show('riddle', TIPS.riddle);
    return null;
  })();

  // Hale says each tutorial step and tip out loud (in Bella's voice), unless the voice is off.
  const haleSays = tour !== null ? TOUR[tour].text : tip?.text ?? null;
  useEffect(() => {
    if (voice && haleSays) speak(spoken(haleSays), VOICE_FOLDER);
  }, [voice, haleSays]);
  useEffect(() => stopSpeaking, []);

  // ---------------------------------------------------------------- screens

  const frame = (body: React.ReactNode) => (
    <div className="rd">
      <header className="rd-head">
        <h1>Royal Decree</h1>
        {backend.trial && <span className="rd-trial">Trial: saved on this browser only, no points</span>}
      </header>
      {body}
    </div>
  );

  if (screen === 'loading') return frame(<p className="rd-panel" role="status">Opening the castle doors…</p>);
  if (screen === 'error') {
    return frame(
      <div className="rd-panel">
        <h2 ref={heading} tabIndex={-1}>Oh dear</h2>
        <p>{error}</p>
        <button type="button" className="rd-btn rd-btn--hot" onClick={() => void load()}>Try again</button>
      </div>,
    );
  }

  if (screen === 'howto') {
    return frame(
      <div className="rd-panel">
        <h2 ref={heading} tabIndex={-1}>How to play</h2>
        <HowToPlayBody />
        <button type="button" className="rd-btn rd-btn--hot" onClick={() => setScreen('start')}>Back</button>
      </div>,
    );
  }

  if (screen === 'album') {
    const met = new Set(album?.met ?? []);
    const seen = new Set(album?.endings ?? []);
    return frame(
      <div className="rd-panel">
        <h2 ref={heading} tabIndex={-1}>Royal Album</h2>
        <p>Villagers met: <strong>{met.size} of {CAST.length}</strong>. Endings seen: <strong>{seen.size} of {Object.keys(ENDINGS).length}</strong>.</p>
        <ul className="rd-album">
          {CAST.map((v) => (
            <li key={v.id} className={met.has(v.id) ? 'is-met' : 'is-unmet'}>
              {met.has(v.id) ? <Portrait who={v.id} /> : <span className="rd-portrait rd-portrait--badge" aria-hidden="true">?</span>}
              <span>{met.has(v.id) ? <><strong>{v.name}</strong><br />{v.role}</> : 'Not met yet'}</span>
            </li>
          ))}
        </ul>
        <h3>Endings</h3>
        <ul className="rd-endings">
          {(Object.keys(ENDINGS) as EndingId[]).map((id) => (
            <li key={id} className={seen.has(id) ? 'is-seen' : ''}>{seen.has(id) ? ENDINGS[id].title : '? ? ?'}</li>
          ))}
        </ul>
        <button type="button" className="rd-btn rd-btn--hot" onClick={() => setScreen('start')}>Back</button>
      </div>,
    );
  }

  if (screen === 'start' || !local || !pub) {
    const title = sceneArt('title');
    const open = local?.status === 'playing' && pub ? local : null;
    return frame(
      <>
        <div className="rd-hero" style={title.wide ? { backgroundImage: `url("${title.wide}")` } : undefined}>
          <h2 ref={heading} tabIndex={-1} className="rd-sign">Riverstone needs a ruler</h2>
        </div>
        <div className="rd-panel">
          <p>Villagers will come to your throne, one at a time, asking for things. <strong>Say yes or no.</strong> Keep <strong>Food, Gold, Happiness and Safety</strong> above zero for {YEARS} years!</p>
          {open && (
            <p className="rd-actions">
              <button type="button" className="rd-btn rd-btn--hot rd-btn--big" onClick={() => setScreen('play')}>Carry on your reign (year {yearOf(open.turn + 1)})</button>
            </p>
          )}
          <h3>Choose your ruler</h3>
          <div className="rd-looks" role="radiogroup" aria-label="Your ruler">
            {LOOKS.map((l) => (
              <button key={l} type="button" role="radio" aria-checked={look === l} className={`rd-look${look === l ? ' is-picked' : ''}`} onClick={() => setLook(l)} aria-label={`Ruler ${LOOKS.indexOf(l) + 1}`}>
                {rulerThumb(l) && <img src={rulerThumb(l)} alt="" />}
              </button>
            ))}
          </div>
          <p className="rd-actions">
            <button type="button" className={`rd-btn ${open ? '' : 'rd-btn--hot rd-btn--big'}`} disabled={busy} onClick={() => void begin()}>{open ? 'Start a new reign' : 'Begin your reign'}</button>
            <button type="button" className="rd-btn" onClick={() => setScreen('album')}>Royal Album{album ? ` (${album.met.length}/${CAST.length})` : ''}</button>
            <button type="button" className="rd-btn rd-btn--quiet" onClick={() => setScreen('howto')}>How to play</button>
          </p>
          <label className="rd-switch">
            <input type="checkbox" checked={wantTour} onChange={(e) => { setWantTour(e.target.checked); setTutorialOn(e.target.checked); }} />
            <span>Show me the tutorial when I start a reign</span>
          </label>
          <label className="rd-switch">
            <input type="checkbox" checked={voice} onChange={(e) => { setVoice(e.target.checked); setHaleVoiceOn(e.target.checked); if (!e.target.checked) stopSpeaking(); }} />
            <span>Hale reads the tips out loud</span>
          </label>
          {!backend.trial && <p className="rd-soft">{pointsLeft > 0 ? `Reigns that give points today: ${pointsLeft}.` : 'You’ve had today’s points. You can still play!'}</p>}
        </div>
      </>,
    );
  }

  if (screen === 'end') {
    const ending = ENDINGS[local.ending ?? 'full'];
    const scene = sceneArt(ENDING_SCENE[local.ending ?? 'full']);
    const newFaces = local.met.filter((w) => !(album?.met ?? []).includes(w));
    return frame(
      <>
        <div className="rd-hero" style={scene.wide ? { backgroundImage: `url("${scene.wide}")` } : undefined}>
          <h2 ref={heading} tabIndex={-1} className="rd-sign">{ending.title}</h2>
        </div>
        <div className="rd-panel">
          <p className="rd-ending">{ending.text}</p>
          <dl className="rd-stats">
            <div><dt>Seasons ruled</dt><dd>{local.turn} of {CARDS_IN_REIGN}</dd></div>
            <div><dt>Maths stars</dt><dd>{'★'.repeat(local.stars) || '0'}</dd></div>
            <div><dt>New villagers met</dt><dd>{newFaces.length}</dd></div>
            {!backend.trial && <div><dt>Points</dt><dd>{saving === 'saving' ? '…' : points ?? 0}</dd></div>}
          </dl>
          {saving === 'failed' && (
            <p className="rd-warn">Your reign isn’t saved yet. <button type="button" className="rd-btn" onClick={() => void save(local)}>Try again</button></p>
          )}
          <p className="rd-actions">
            <button type="button" className="rd-btn rd-btn--hot rd-btn--big" disabled={busy || saving === 'saving'} onClick={() => void load().then(() => begin())}>Rule again</button>
            <button type="button" className="rd-btn" disabled={saving === 'saving'} onClick={() => void load().then(() => setScreen('album'))}>Royal Album</button>
          </p>
        </div>
      </>,
    );
  }

  // play
  const council = sceneArt('council');
  const hint = lean && next?.kind === 'card' ? hintFor(next.card[lean]) : null;
  const q = next?.kind === 'riddle' ? pub.questions[next.slot] : undefined;
  const spot: Spot = tour === null ? 'none' : TOUR[tour].spot;
  const endTour = () => setTour(null);
  return frame(
    <>
      <Road turn={local.turn} spot={spot === 'road'} />
      <MeterBar meters={local.meters} hint={hint} changed={after ? changed : null} spot={spot === 'meters'} />
      <div className="rd-hall" style={council.wide ? { backgroundImage: `url("${council.wide}")` } : undefined}>
        <h2 ref={heading} tabIndex={-1} className="rd-sr">The throne room</h2>
        {rulerArt(pub.look) && <img className="rd-ruler" src={rulerArt(pub.look)} alt="" />}
        {tour !== null && <TourBubble step={tour} onNext={() => (tour + 1 < TOUR.length ? setTour(tour + 1) : endTour())} onSkip={endTour} />}
        {tip && <Tip onClose={() => setTips((t) => [...t, tip.id])}>{tip.text}</Tip>}

        {after?.kind === 'reply' && (
          <div className="rd-after" role="status">
            <Portrait who={after.who} />
            <p className="rd-bubble">“{after.text}”</p>
            <button type="button" className="rd-btn rd-btn--hot" autoFocus onClick={() => afterReply()}>Next</button>
          </div>
        )}

        {after?.kind === 'year' && (
          <div className="rd-after rd-after--year" role="status">
            <p className="rd-year">Year {after.year} begins!</p>
            <p>Everyone ate through the winter: Food −{WINTER_FOOD}.</p>
            {saving === 'failed' && <p className="rd-soft">Not saved yet: it will try again at the end of the year.</p>}
            <button type="button" className="rd-btn rd-btn--hot" autoFocus onClick={() => { setAfter(null); setChanged(null); }}>On we go</button>
          </div>
        )}

        {!after && next?.kind === 'card' && (
          <RequestCard key={next.card.id} who={next.card.who} text={next.card.text} no={next.card.no} yes={next.card.yes} onChoose={choose} onLean={setLean} locked={tour !== null && tour !== YOUR_TURN} spot={spot} />
        )}

        {!after && next?.kind === 'riddle' && (
          <div className="rd-deal">
            <div className="rd-card rd-card--riddle">
              <Portrait who={next.riddle.who} big />
              <p className="rd-card__who"><strong>{villager(next.riddle.who)?.name}</strong>, {villager(next.riddle.who)?.role}</p>
              <p className="rd-card__text">{q ? next.riddle.ask : 'I was going to ask you a puzzle, but I’ve worked it out myself!'}</p>
              {q && <p className="rd-soft">A right answer: +{RIDDLE_BONUS} {METER_NAME[next.riddle.meter]}</p>}
            </div>
            <div className="rd-choices">
              {q && !answered[String(next.slot)] && <button type="button" className="rd-btn rd-btn--hot" onClick={() => setAsking(true)}>Help {villager(next.riddle.who)?.name}</button>}
              {q && answered[String(next.slot)] && (
                <button type="button" className="rd-btn rd-btn--hot" onClick={() => {
                  const right = answered[String(next.slot)].right;
                  moveOn('riddle', right, { kind: 'reply', who: next.riddle.who, text: right ? next.riddle.thanks : 'Never mind, thank you for trying!' });
                }}>Next</button>
              )}
              {(!q || !answered[String(next.slot)]) && (
                <button type="button" className="rd-btn" onClick={() => moveOn('riddle', false, { kind: 'reply', who: next.riddle.who, text: q ? 'Maybe next time!' : 'Thank you anyway, Your Majesty!' })}>
                  {q ? 'Not now' : 'Next'}
                </button>
              )}
            </div>
          </div>
        )}

      </div>

      {asking && q && next?.kind === 'riddle' && (
        <QuestionModal
          question={{ ...q, id: q.slot }}
          title={`${villager(next.riddle.who)?.name} asks`}
          note={`A right answer gives +${RIDDLE_BONUS} ${METER_NAME[next.riddle.meter]}.`}
          spot="Throne room"
          onSubmit={(value, ms) => answer(next.slot, value, ms)}
          onDone={(result) => {
            setAsking(false);
            moveOn('riddle', result.correct, { kind: 'reply', who: next.riddle.who, text: result.correct ? next.riddle.thanks : 'Never mind, thank you for trying!' });
          }}
          onClose={() => setAsking(false)}
          closeLabel="Not now"
        />
      )}
    </>,
  );
}
