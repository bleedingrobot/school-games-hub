/**
 * A Goblin Storm run: a canvas, a fixed-step loop and the HUD over the top (docs/GOBLINSTORM-PLAN.md, stage 2). The
 * loop is copied from Toon Flap's: real time is added up and spent in 1/60 s engine steps; drawing happens once a frame
 * and only reads the run. Every step's steering direction (0–15, or 16 for still) and every card picked is kept, so the
 * server can replay exactly the same run (shared/goblinstorm/replay.ts).
 */
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { BOSS_AT, MINIBOSS_AT, PASSIVES, QUESTIONS_PER_RUN, RUN_STEPS, STEPS_PER_SECOND, WEAPONS, WEAPON_LEVELS, gemsToNext, questionSlot, type HeroDef, type MapDef, type WeaponId } from '../../../shared/goblinstorm/config';
import { applyPick, makeOffer, newRun, stepRun, waiting, type RunState, type Upgrade } from '../../../shared/goblinstorm/engine';
import { choicesFor, encodeSteering } from '../../../shared/goblinstorm/replay';
import { STILL } from '../../../shared/goblinstorm/trig';
import { QuestionModal, type MarkedAnswer, type ShownQuestion } from '../../maths/QuestionModal';
import type { PublicQuestion } from '../../../shared/maths/serverQuestions';
import type { FinishReply, GoblinStormBackend, Mark, StartReply } from './backend';
import { HubButtons } from './HubButtons';
import { PASSIVE_ICON, WEAPON_COLOUR, WEAPON_ICON } from './look';
import { Pic } from './Pic';
import { View, type Stick } from './renderer';
import { useSound } from '../../sound';
import { playSounds, type StormSound } from './sfx';
import type { Quality } from './quality';
import { hush, say, sayQuestion } from './voice';
import { GUIDE } from './voiceLines';

const STEP_MS = 1000 / STEPS_PER_SECOND;
const MAX_STEPS_A_FRAME = 4;
const TAU = Math.PI * 2;

/** A drag's direction as one of the 16 steering directions, or still for a small drag. Screen y points down, as in the engine. */
export function dragDirection(dx: number, dy: number, deadZone: number): number {
  if (dx * dx + dy * dy < deadZone * deadZone) return STILL;
  const a = Math.atan2(dy, dx);
  return ((Math.round(a / (TAU / 16)) % 16) + 16) % 16;
}

const shown = (q: PublicQuestion): ShownQuestion => ({ id: q.slot, parts: q.parts, spoken: q.spoken, prompt: q.prompt, choices: q.choices, choiceLabels: q.choiceLabels, maxLength: q.maxLength, input: q.input });

type Stage = 'play' | 'ask' | 'cards' | 'leave' | 'end';

interface Game {
  s: RunState;
  steering: number[];
  picks: number[];
  stage: Stage;
  keys: { up: boolean; down: boolean; left: boolean; right: boolean };
  stick: (Stick & { id: number }) | null;
  view: View;
  moved: boolean;
  warned: Set<string>;
  time: number;
}

export interface RunEnd { reply: FinishReply | null; hero: HeroDef; map: MapDef }

type GuideLine = keyof typeof GUIDE;

export function PlayScreen({ backend, start, hero, map, onEnd, guided = false, quality = 'high' }: {
  backend: GoblinStormBackend;
  start: StartReply;
  hero: HeroDef;
  map: MapDef;
  onEnd: (end: RunEnd) => void;
  /** The guided first go (docs/GOBLINSTORM-PLAN.md, Design point 7): Bella's tips at each new moment, skippable. */
  guided?: boolean;
  /** The effects setting; slow frames drop to low by themselves. */
  quality?: Quality;
}) {
  const { soundOn } = useSound();
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;
  const qualityRef = useRef(quality);
  qualityRef.current = quality;
  /** Sounds asked for outside the run's own events (banners, picks, the end). */
  const extraSounds = useRef(new Set<StormSound>());
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hpRef = useRef<HTMLDivElement>(null);
  const gemRef = useRef<HTMLDivElement>(null);
  const levelRef = useRef<HTMLSpanElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const killsRef = useRef<HTMLSpanElement>(null);
  const G = useRef<Game | null>(null);
  if (G.current === null) {
    G.current = {
      s: newRun({ seed: start.seed, hero, map, shop: start.shop ?? {} }),
      steering: [], picks: [], stage: 'play',
      keys: { up: false, down: false, left: false, right: false },
      stick: null, view: new View(), moved: false, warned: new Set(), time: 0,
    };
  }
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [cards, setCards] = useState<{ offer: Upgrade[]; mark: Mark | null } | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hint, setHint] = useState(true);
  useEffect(() => {
    // In the guide the pointing hand stays until the hero moves.
    if (guided) return;
    const t = setTimeout(() => setHint(false), 12000);
    return () => clearTimeout(t);
  }, [guided]);
  // ---- the guide: each line once, said by Bella when sound is on; Skip stops it for the rest of the run
  const guideOn = useRef(guided);
  const guideSaid = useRef(new Set<GuideLine>());
  const [coach, setCoach] = useState<GuideLine | null>(null);
  const coachTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const tell = (line: GuideLine, then?: () => void, ms = 6500): boolean => {
    if (!guideOn.current || guideSaid.current.has(line)) return false;
    guideSaid.current.add(line);
    setCoach(line);
    clearTimeout(coachTimer.current);
    if (ms) coachTimer.current = setTimeout(() => setCoach((c) => (c === line ? null : c)), ms);
    if (soundRef.current) say(GUIDE[line], then);
    else then?.();
    return true;
  };
  const skipGuide = () => {
    guideOn.current = false;
    setCoach(null);
    hush();
  };
  useEffect(() => {
    if (guided) tell('move', undefined, 0);
    return () => {
      hush();
      clearTimeout(coachTimer.current);
    };
    // Once, as the run starts.
  }, []);
  // ---- the answer clock starts when Bella has finished reading the question
  const askedAt = useRef(0);
  const heardAt = useRef<number | null>(null);
  const [announce, setAnnounce] = useState('');
  const markRef = useRef<Mark | null>(null);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showBanner = (text: string) => {
    setBanner(text);
    setAnnounce(text);
    clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setBanner(null), 3200);
  };

  /** The next waiting level-up: its question if it asks one (every third), else straight to 3 cards. */
  const beginLevelUp = () => {
    const g = G.current as Game;
    const slot = questionSlot(g.s.levelUps);
    const q = slot !== null && slot < QUESTIONS_PER_RUN ? start.questions[slot] : undefined;
    markRef.current = null;
    if (q) {
      g.stage = 'ask';
      setQuestion(q);
      askedAt.current = performance.now();
      heardAt.current = null;
      const heard = () => { heardAt.current = performance.now(); };
      const read = () => (soundRef.current ? sayQuestion(q.spoken, heard) : heard());
      if (!tell('levelUp', read, 0)) read();
    } else offerCards(null);
  };
  const offerCards = (mark: Mark | null) => {
    const g = G.current as Game;
    g.stage = 'cards';
    const offer = makeOffer(g.s, choicesFor(mark));
    setCards({ offer: [...offer], mark });
    // After the first question: how its answer changed the number of cards.
    if (mark) tell('cards', undefined, 0);
  };
  const pick = (i: number) => {
    const g = G.current as Game;
    if (g.stage !== 'cards' || !applyPick(g.s, i)) return;
    g.picks.push(i);
    const u = cards?.offer[i];
    setCards(null);
    setCoach((c) => (c === 'cards' ? null : c));
    extraSounds.current.add(u?.kind === 'evolve' ? 'evolve' : 'pick');
    if (g.s.weapons.some((w) => !w.evolved && w.level >= WEAPON_LEVELS)) tell('partner');
    if (u?.kind === 'evolve') {
      g.view.flash = g.view.reduced ? 0.4 : 0.8;
      g.view.flashColour = WEAPON_COLOUR[u.id].evolved;
      g.view.addShake(0.6);
      // The canvas writes the evolved name big; this is for screen readers.
      setAnnounce(`${WEAPONS[u.id].evolved.name}! It clears the screen every few seconds.`);
    }
    if (waiting(g.s)) beginLevelUp();
    else g.stage = 'play';
  };

  const finish = (quit: boolean) => {
    const g = G.current as Game;
    if (g.stage === 'end') return;
    g.stage = 'end';
    setSaving(true);
    const send = () => backend.finish(start.seed, encodeSteering(g.steering), g.picks).then(
      (reply) => onEnd({ reply, hero, map }),
      () => onEnd({ reply: null, hero, map }),
    );
    // Let the last blast or fall play out before the results.
    if (quit) void send();
    else setTimeout(() => void send(), 1400);
  };

  // keyboard: WASD and arrows
  useEffect(() => {
    const set = (e: KeyboardEvent, down: boolean) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      const k = (G.current as Game).keys;
      const key = e.key.toLowerCase();
      if (key === 'arrowup' || key === 'w') k.up = down;
      else if (key === 'arrowdown' || key === 's') k.down = down;
      else if (key === 'arrowleft' || key === 'a') k.left = down;
      else if (key === 'arrowright' || key === 'd') k.right = down;
      else return;
      if ((G.current as Game).stage === 'play') e.preventDefault();
    };
    const dn = (e: KeyboardEvent) => set(e, true);
    const up = (e: KeyboardEvent) => set(e, false);
    const blur = () => { const k = (G.current as Game).keys; k.up = k.down = k.left = k.right = false; };
    window.addEventListener('keydown', dn);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', dn);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  // the loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !stage || !ctx) return;
    const g = G.current as Game;
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    g.view.reduced = reduced;
    g.view.fx.gentle = reduced;
    let dpr = 1;
    let w = 0;
    let h = 0;
    const resize = () => {
      const r = stage.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.max(1, Math.round(r.width));
      h = Math.max(1, Math.round(r.height));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    };
    resize();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    ro?.observe(stage);

    const direction = (): number => {
      const k = g.keys;
      const kx = (k.right ? 1 : 0) - (k.left ? 1 : 0);
      const ky = (k.down ? 1 : 0) - (k.up ? 1 : 0);
      if (kx || ky) return dragDirection(kx, ky, 0.1);
      if (g.stick) return dragDirection(g.stick.x - g.stick.ox, g.stick.y - g.stick.oy, 10);
      return STILL;
    };

    const warnings = () => {
      const s = g.s;
      const m = s.setup.map.monsters;
      const at = (key: string, step: number, text: string): boolean => {
        if (s.t < step || g.warned.has(key)) return false;
        g.warned.add(key);
        showBanner(text);
        return true;
      };
      // The 5-second warnings get the warning sound and Bella's guide line; the arrivals have their own boss sound.
      if (at('mini-soon', MINIBOSS_AT - 5 * STEPS_PER_SECOND, `⚠️ A ${m[3].name} is coming!`)) { extraSounds.current.add('warn'); tell('miniBoss'); }
      at('mini', MINIBOSS_AT, `${m[3].name}!`);
      if (at('boss-soon', BOSS_AT - 5 * STEPS_PER_SECOND, `⚠️ The ${m[4].name} is coming!`)) { extraSounds.current.add('warn'); tell('boss'); }
      at('boss', BOSS_AT, `The ${m[4].name}! Beat it to win!`);
      // The guide's last line, once the boss fight is under way.
      if (s.t >= BOSS_AT + 10 * STEPS_PER_SECOND) tell('done');
    };

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let slow = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      g.time += dt;
      // Low effects by choice, or by themselves while frames are slow (drawing only).
      slow = slow * 0.95 + (dt > 0.024 ? 0.05 : 0);
      const low = qualityRef.current === 'low' || slow > 0.5;
      g.view.low = low;
      g.view.fx.low = low;
      g.view.fx.quality = low ? 0.45 : 1;
      const s = g.s;
      if (g.stage === 'play' && s.outcome === 'running') {
        acc += dt * 1000;
        let steps = 0;
        while (acc >= STEP_MS && steps < MAX_STEPS_A_FRAME && g.stage === 'play') {
          if (s.outcome !== 'running') break;
          if (waiting(s)) { beginLevelUp(); break; }
          acc -= STEP_MS;
          steps++;
          const d = direction();
          if (d !== STILL && !g.moved) { g.moved = true; setHint(false); setCoach((c) => (c === 'move' ? null : c)); }
          g.steering.push(d);
          stepRun(s, d);
          g.view.take(s, s.events);
        }
        if (steps >= MAX_STEPS_A_FRAME) acc = 0;
        warnings();
      } else acc = 0;
      if (s.outcome !== 'running' && g.stage !== 'end' && g.stage !== 'leave') {
        if (s.outcome === 'won') showBanner('🏆 You beat the boss!');
        else if (s.outcome === 'survived') showBanner('You survived!');
        else showBanner('You fell!');
        extraSounds.current.add(s.outcome === 'lost' ? 'fall' : 'win');
        finish(false);
      }

      g.view.tick(dt);
      // Sounds: the run's and the screen's together, at most two a frame.
      for (const c of g.view.cues) extraSounds.current.add(c);
      g.view.cues.clear();
      playSounds(extraSounds.current, soundRef.current);
      // HUD (straight into the page: no React render each frame)
      if (hpRef.current) hpRef.current.style.width = `${Math.max(0, (s.hero.hp / s.hero.maxHp) * 100)}%`;
      if (gemRef.current) {
        gemRef.current.style.width = `${Math.min(100, (s.gemBar / gemsToNext(s.level)) * 100)}%`;
        gemRef.current.style.filter = g.view.gemPulse > 0 ? `brightness(${(1 + g.view.gemPulse * 0.8).toFixed(2)})` : '';
      }
      if (levelRef.current) levelRef.current.textContent = String(s.level);
      if (killsRef.current) killsRef.current.textContent = String(s.kills);
      if (timeRef.current) {
        const left = Math.max(0, Math.ceil((RUN_STEPS - s.t) / STEPS_PER_SECOND));
        timeRef.current.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.view.draw(ctx, s, w, h, g.time, g.stage === 'play' ? g.stick : null);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    // Dev server only (never in a build): lets the browser check jump ahead to a busy screen.
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__goblinstorm = {
        g,
        skip(n: number, heal = true) {
          const s = g.s;
          for (let i = 0; i < n && s.outcome === 'running'; i++) {
            while (waiting(s)) { makeOffer(s, 3); g.picks.push(0); applyPick(s, 0); }
            if (heal) s.hero.hp = s.hero.maxHp = 1e7;
            g.steering.push(STILL);
            stepRun(s, STILL);
            g.view.take(s, s.events);
          }
          while (waiting(s)) { makeOffer(s, 3); g.picks.push(0); applyPick(s, 0); }
        },
      };
    }
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      clearTimeout(bannerTimer.current);
    };
    // The run is made once for this start reply.
  }, []);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const g = G.current as Game;
    if ((e.target as HTMLElement).closest('[data-nostick]') || g.stage !== 'play') return;
    const r = (stageRef.current as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    g.stick = { id: e.pointerId, ox: x, oy: y, x, y, max: Math.min(64, Math.max(40, r.width * 0.08)) };
    (e.currentTarget as HTMLDivElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = G.current as Game;
    if (!g.stick || g.stick.id !== e.pointerId) return;
    const r = (stageRef.current as HTMLDivElement).getBoundingClientRect();
    g.stick.x = e.clientX - r.left;
    g.stick.y = e.clientY - r.top;
    // The stick follows a long drag, so turning round is always one short move.
    const dx = g.stick.x - g.stick.ox;
    const dy = g.stick.y - g.stick.oy;
    const d = Math.sqrt(dx * dx + dy * dy);
    const far = g.stick.max * 1.6;
    if (d > far) { g.stick.ox += (dx / d) * (d - far); g.stick.oy += (dy / d) * (d - far); }
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const g = G.current as Game;
    if (g.stick && g.stick.id === e.pointerId) g.stick = null;
  };

  const askLeave = () => {
    const g = G.current as Game;
    if (g.stage !== 'play') return;
    g.stage = 'leave';
    g.stick = null;
    setConfirm(true);
  };
  const stay = () => {
    (G.current as Game).stage = 'play';
    setConfirm(false);
  };

  return (
    <div
      className="gs-play"
      ref={stageRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <canvas ref={canvasRef} className="gs-canvas" role="img" aria-label={`${map.name}. Drag anywhere, or use the arrow keys or W A S D, to move. Your ${hero.name} attacks by themselves.`} />
      <div className="gs-hud" data-nostick>
        <div className="gs-hud__bars">
          <div className="gs-bar gs-bar--hp" aria-hidden="true"><div className="gs-bar__fill" ref={hpRef} /><span className="gs-bar__label">❤️</span></div>
          <div className="gs-bar gs-bar--gem" aria-hidden="true"><div className="gs-bar__fill" ref={gemRef} /><span className="gs-bar__label">Lv <span ref={levelRef}>1</span></span></div>
        </div>
        <div className="gs-hud__mid">
          <span className="gs-time" ref={timeRef} aria-label="Time left">3:00</span>
          <span className="gs-kills">💀 <span ref={killsRef}>0</span></span>
        </div>
        <div className="gs-hud__right">
          <HubButtons />
          <button type="button" className="gs-btn gs-btn--glass" onClick={askLeave}>Leave</button>
        </div>
      </div>
      {banner && <div className="gs-banner" aria-hidden="true">{banner}</div>}
      {hint && !coach && !question && !cards && (
        <div className="gs-hint" aria-hidden="true">
          <span className="gs-hint__hand">👆</span>
          <span>Drag anywhere to move. Your hero attacks by themselves!</span>
          <small>Or use the arrow keys or W A S D</small>
        </div>
      )}
      {question && (
        <div data-nostick>
          <QuestionModal
            question={shown(question)}
            title="Level up!"
            note="Answer to power up. Right: 3 choices. Right and quick: 4."
            spot="goblinstorm"
            onSubmit={async (value, ms): Promise<MarkedAnswer> => {
              // The clock starts when Bella has finished reading (an answer while she's still reading counts from 0).
              // If she never says she's finished (a stuck browser voice), wait at most about as long as reading it takes.
              const longest = 1500 + question.spoken.length * 90;
              const wait = Math.min(longest, (heardAt.current ?? performance.now()) - askedAt.current);
              hush();
              const r = await backend.answer(start.seed, question.slot, value, Math.max(0, Math.round(ms - wait)));
              markRef.current = r.mark;
              return { correct: r.correct, fact: r.fact, boxBefore: 0, boxAfter: 0, answer: r.answer, reward: r.mark === 'quick' ? 'Quick! 4 choices' : r.mark === 'right' ? '3 choices' : undefined };
            }}
            onDone={() => {
              setQuestion(null);
              offerCards(markRef.current ?? 'wrong');
            }}
          />
        </div>
      )}
      {cards && <LevelUpCards s={(G.current as Game).s} offer={cards.offer} mark={cards.mark} onPick={pick} coach={coach === 'cards' ? <Coach line="cards" onSkip={skipGuide} /> : null} />}
      {coach && coach !== 'cards' && coach !== 'levelUp' && !question && !cards && <Coach line={coach} onSkip={skipGuide} />}
      {confirm && (
        <div className="gs-dim" role="alertdialog" aria-label="Leave this run?" data-nostick>
          <div className="gs-box">
            <p><strong>Leave this run?</strong></p>
            <p>It ends here. You keep what you've done so far.</p>
            <div className="gs-row">
              <button type="button" className="gs-btn" onClick={stay} autoFocus>Keep playing</button>
              <button type="button" className="gs-btn gs-btn--ghost" onClick={() => { setConfirm(false); finish(true); }}>Leave</button>
            </div>
          </div>
        </div>
      )}
      {saving && <div className="gs-saving" role="status">Counting up your run…</div>}
      <p className="gs-sr" aria-live="polite">{announce}</p>
    </div>
  );
}

// ---------------------------------------------------------------- the upgrade cards

/** Which held weapon this passive would evolve (its partner), if any. */
function partnerOf(s: RunState, passive: string): WeaponId | undefined {
  return s.weapons.find((w) => !w.evolved && WEAPONS[w.id].evolvesWith === passive)?.id;
}

function Pips({ level }: { level: number }) {
  return (
    <span className="gs-pips" aria-label={`Level ${level} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => <i key={n} className={n <= level ? 'on' : ''} />)}
    </span>
  );
}

function Card({ s, u, onPick, index }: { s: RunState; u: Upgrade; onPick: (i: number) => void; index: number }) {
  let cls = 'gs-card';
  let icon: ReactNode = '';
  let name = '';
  let tag = '';
  let blurb = '';
  let extra: ReactNode = null;
  if (u.kind === 'evolve') {
    const def = WEAPONS[u.id];
    cls += ' gs-card--evolve';
    icon = <Pic path={`evolved/${u.id}`} small fallback={WEAPON_ICON[u.id]} />;
    name = def.evolved.name;
    tag = 'Evolve!';
    blurb = def.evolved.blurb;
    extra = <span className="gs-card__note">Wipes the screen every few seconds</span>;
  } else if (u.kind === 'weapon') {
    const def = WEAPONS[u.id];
    cls += ' gs-card--weapon';
    icon = <Pic path={`weapons/${u.id}`} small fallback={WEAPON_ICON[u.id]} />;
    name = def.name;
    tag = u.level === 1 ? 'New weapon' : `Level ${u.level}`;
    blurb = def.blurb;
    const partner = PASSIVES[def.evolvesWith];
    extra = <><Pips level={u.level} /><span className="gs-card__note">Evolves with {PASSIVE_ICON[partner.id]} {partner.name}</span></>;
  } else if (u.kind === 'passive') {
    const def = PASSIVES[u.id];
    cls += ' gs-card--passive';
    icon = <Pic path={`passives/${u.id}`} small fallback={PASSIVE_ICON[u.id]} />;
    name = def.name;
    tag = u.level === 1 ? 'New power' : `Level ${u.level}`;
    blurb = def.blurb;
    const partner = partnerOf(s, u.id);
    extra = <><Pips level={u.level} />{partner && <span className="gs-card__note gs-card__note--star">⭐ Partner of {WEAPONS[partner].name}</span>}</>;
  } else if (u.kind === 'heal') {
    cls += ' gs-card--other';
    icon = '🍗';
    name = 'Feast';
    tag = 'Heal';
    blurb = 'Back to full health.';
  } else {
    cls += ' gs-card--other';
    icon = '🪙';
    name = 'Gold';
    tag = 'Bonus';
    blurb = '+5 gold at the end of the run.';
  }
  return (
    <button type="button" className={cls} onClick={() => onPick(index)} autoFocus={index === 0}>
      <span className="gs-card__tag">{tag}</span>
      <span className="gs-card__icon" aria-hidden="true">{icon}</span>
      <span className="gs-card__name">{name}</span>
      <span className="gs-card__blurb">{blurb}</span>
      {extra}
    </button>
  );
}

/** Bella's guide line during the guided first go, with Skip. Never about the maths answer. */
function Coach({ line, onSkip }: { line: GuideLine; onSkip: () => void }) {
  return (
    <div className={`gs-coach gs-coach--${line}`} data-nostick>
      <span className="gs-coach__face" aria-hidden="true">🧚</span>
      <p className="gs-coach__say" role="status"><strong>Bella:</strong> {GUIDE[line]}</p>
      <button type="button" className="gs-btn gs-btn--glass gs-btn--small" onClick={onSkip}>Skip guide</button>
    </div>
  );
}

function LevelUpCards({ s, offer, mark, onPick, coach }: { s: RunState; offer: Upgrade[]; mark: Mark | null; onPick: (i: number) => void; coach?: ReactNode }) {
  const title = mark === 'quick' ? 'Quick and right! Pick from 4 powers or gold' : mark === 'right' ? 'Right! Pick from 3 powers or gold' : mark === 'wrong' ? 'Pick from 2 powers or gold' : 'Pick a power or gold';
  return (
    <div className="gs-dim gs-dim--cards" data-nostick role="dialog" aria-label={title}>
      <div className="gs-cards">
        <h2 className="gs-cards__title">Level {s.level}! {title}</h2>
        {coach}
        <div className="gs-cards__row">
          {offer.map((u, i) => <Card key={i} s={s} u={u} index={i} onPick={onPick} />)}
        </div>
        <Held s={s} />
      </div>
    </div>
  );
}

/** What the hero holds now: weapons and powers with their levels. */
function Held({ s }: { s: RunState }) {
  return (
    <div className="gs-held" aria-label="What you have">
      {s.weapons.map((w) => (
        <span key={w.id} className={`gs-held__item${w.evolved ? ' gs-held__item--evolved' : ''}`} title={w.evolved ? WEAPONS[w.id].evolved.name : WEAPONS[w.id].name}>
          <Pic path={`${w.evolved ? 'evolved' : 'weapons'}/${w.id}`} small fallback={WEAPON_ICON[w.id]} /><small>{w.evolved ? '★' : w.level}</small>
        </span>
      ))}
      {s.passives.map((p) => (
        <span key={p.id} className="gs-held__item gs-held__item--passive" title={PASSIVES[p.id].name}>
          <Pic path={`passives/${p.id}`} small fallback={PASSIVE_ICON[p.id]} /><small>{p.level}</small>
        </span>
      ))}
    </div>
  );
}


