/**
 * Playing one level (docs/DIAMOND-PLAN.md, section 7): the shared engine stepped at a fixed rate, drawn on a canvas from
 * its state, with one big Drop button (also Space, Enter or tapping the field). The tick of each Drop that counts is
 * recorded and sent to the server at the end, which replays the level to get the result. A slip pauses the steps and
 * shows the Hold on! question; the server's mark decides whether the claw holds on. Nothing here changes a rule: the
 * picture only reads the engine's state. Nugget's guided first go and first-time tips come from ./guide.ts.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { QuestionModal, type MarkedAnswer, type ShownQuestion } from '../../maths/QuestionModal';
import { FIELD_H, FIELD_W, LAST_LEVEL, PIVOT, RARE_TIER_NAME, TICKS_PER_SECOND, chanceWords, gemOf, isRare, levelSpec, rareOf, type DigTier, type GemId, type RareId } from '../../../shared/diamond/config';
import { TIER_RULES, digTierOf, goalWords, type Caught } from '../../../shared/diamond/caverns';
import { answer as answerSlip, startLevel, step, type LevelState, type Phase } from '../../../shared/diamond/engine';
import { direction, monstersIn, rareIn, shownAt, thingAt, type Thing } from '../../../shared/diamond/field';
import { TIER_COLOUR, artLevel, drawMonster, monsterName, monsterUrl } from './art/monsters';
import { Effects, NUGGET_SPOT, drawRareAura, drawRareGleam, drawAmbient, drawBackground, drawClaw, drawCrab, drawGem, drawNugget, drawRock, drawRope, drawSack, drawTrail, drawWinch } from './art/draw';
import type { Worn } from './art/items';
import { paintFile, paintNow } from './art/paint';
import type { DiamondBackend, Ended, Started } from './backend';
import { factText } from './factText';
import { Sprite } from './Sprite';
import { TIPS, guideStep, showsTip, type Help, type TipId } from './guide';
import { stepsPerSecond, type DiamondPrefs } from './prefs';

/** How far below the winch the claw hangs while it swings (looks only). */
const HANG = 40;

interface Hud {
  seconds: number;
  banked: number;
  /** Monsters brought up (Monster Dig). */
  monsters: number;
  coins: number;
  passed: boolean;
  busy: boolean;
}

interface Tumble { gem: GemId; id: number; from: [number, number]; to: [number, number]; start: number }

const hudOf = (s: LevelState): Hud => ({
  seconds: Math.ceil(Math.max(0, s.endTick - s.tick) / TICKS_PER_SECOND),
  banked: s.banked,
  monsters: s.monsters.length,
  coins: s.coins,
  passed: s.passTick !== null,
  busy: s.phase !== 'swing',
});

export function PlayLevel({
  started,
  backend,
  prefs,
  still,
  worn,
  help,
  guided,
  seenTips,
  onSeen,
  onEnd,
  onTrouble,
}: {
  started: Started;
  backend: DiamondBackend;
  prefs: DiamondPrefs;
  /** Less motion. */
  still: boolean;
  worn: Worn;
  /** How much Nugget helps (Lots / Some / Off). */
  help: Help;
  /** The guided first go (a new pupil's first level 1, or "Replay the guide"). */
  guided: boolean;
  seenTips: readonly string[];
  /** A first-time tip was shown, or the guide finished or was skipped ('guide'). */
  onSeen: (id: TipId | 'guide') => void;
  onEnd: (ended: Ended) => void;
  onTrouble: (message: string) => void;
}) {
  const spec = levelSpec(started.level);
  const last = started.level === LAST_LEVEL;
  const cavern = spec.cavern;
  /** The level whose painting this level shows (a cavern borrows one until it has its own). */
  const art = artLevel(started.level);
  const stateRef = useRef<LevelState>(null as unknown as LevelState);
  if (!stateRef.current) stateRef.current = startLevel(started.level, started.seed, started.boosts, started.starter, started.field ?? started.seed);
  const drops = useRef<number[]>([]);
  const finishAt = useRef<number | null>(null);
  const wantFinish = useRef(false);
  const ending = useRef(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [hud, setHud] = useState<Hud>(() => hudOf(stateRef.current));
  const [paused, setPaused] = useState(false);
  const [slot, setSlot] = useState<number | null>(null);
  const [say, setSay] = useState('');
  // A rare gem in this level: a big banner when the level starts, and another when it's caught.
  const rareGem = useRef((rareIn(stateRef.current.things)?.gem ?? null) as RareId | null).current;
  const [rareBanner, setRareBanner] = useState<{ gem: RareId; caught: boolean; key: number } | null>(rareGem ? { gem: rareGem, caught: false, key: 0 } : null);
  useEffect(() => {
    if (!rareBanner) return;
    const t = window.setTimeout(() => setRareBanner(null), rareBanner.caught ? 4200 : 4800);
    return () => window.clearTimeout(t);
  }, [rareBanner]);
  // Monster Dig: a banner when the cavern holds something special (the rarest buried first), and when one is caught.
  const special = useRef(bestMonster(stateRef.current.things)).current;
  const [monsterBanner, setMonsterBanner] = useState<{ m: Caught & { tier: DigTier }; caught: boolean; key: number } | null>(special ? { m: special, caught: false, key: 0 } : null);
  useEffect(() => {
    if (!monsterBanner) return;
    const t = window.setTimeout(() => setMonsterBanner(null), 4200);
    return () => window.clearTimeout(t);
  }, [monsterBanner]);
  useEffect(() => {
    if (rareGem) setSay(`A rare gem is hiding near the bottom: a ${rareOf(rareGem).name}! ${RARE_TIER_NAME[rareOf(rareGem).tier]}, ${chanceWords(rareOf(rareGem))}.`);
  }, [rareGem]);
  const [tip, setTip] = useState<string | null>(null);
  const [guiding, setGuiding] = useState(guided && help !== 'off');
  const guidingRef = useRef(guiding);
  guidingRef.current = guiding;
  // What's been shown on this device, kept here too so a tip shows once even before the parent re-renders.
  const seen = useRef(new Set(seenTips));
  const showTip = useCallback((id: TipId) => {
    if (guidingRef.current || !showsTip(help, id, [...seen.current])) return;
    seen.current.add(id);
    setTip(TIPS[id].text);
    onSeen(id);
  }, [help, onSeen]);
  const [checking, setChecking] = useState(false);
  const pausedRef = useRef(false);
  pausedRef.current = paused || slot !== null;
  const tumble = useRef<Tumble | null>(null);
  const effects = useRef(new Effects());
  const t0 = useRef(performance.now());

  useEffect(() => heading.current?.focus(), []);
  useEffect(() => {
    // The caverns' tip shows once on this device whatever the help setting: it's new to everyone who gets this far.
    if (cavern) {
      if (!seen.current.has('monster')) { seen.current.add('monster'); setTip(TIPS.monster.text); onSeen('monster'); }
      return;
    }
    if (spec.crabs > 0) showTip('crab');
  }, [spec.crabs, showTip, cavern, onSeen]);
  useEffect(() => {
    if (hud.passed && !last) showTip('passed');
  }, [hud.passed, last, showTip]);
  const endGuide = useCallback(() => {
    setGuiding(false);
    onSeen('guide');
  }, [onSeen]);
  // A guided first go that reaches the level's end counts as done too.
  useEffect(() => () => { if (guidingRef.current) onSeen('guide'); }, [onSeen]);

  // The picture's loop is set up once, so it reaches the tip function through a ref.
  const showTipRef = useRef(showTip);
  showTipRef.current = showTip;

  const end = useCallback(async () => {
    if (ending.current) return;
    ending.current = true;
    setChecking(true);
    const r = await backend.levelEnd(started.seed, drops.current, finishAt.current);
    if (r.ok) onEnd(r.value);
    else {
      onTrouble(r.message);
      setChecking(false);
    }
  }, [backend, onEnd, onTrouble, started.seed]);

  const drop = useCallback(() => {
    const s = stateRef.current;
    if (pausedRef.current || ending.current || s.phase !== 'swing') return;
    drops.current.push(s.tick);
    step(s, 'drop');
    setTip(null);
    setHud(hudOf(s));
  }, []);

  const finish = useCallback(() => {
    if (stateRef.current.passTick !== null) wantFinish.current = true;
  }, []);

  // Space and Enter drop the claw (a focused button takes its own Enter and Space).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      const t = e.target as HTMLElement | null;
      if (t && /^(BUTTON|INPUT|TEXTAREA|SELECT|A|SUMMARY)$/.test(t.tagName)) return;
      if (t?.closest?.('[role="dialog"]')) return;
      e.preventDefault();
      drop();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drop]);

  // The steps and the picture.
  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext?.('2d') ?? null;
    let bg: HTMLCanvasElement | null = null;
    let bgScale = 0;
    let bgPainted = false;
    let frame = 0;
    let lastTime = performance.now();
    let acc = 0;
    let turn = 0;
    let announced = 0;
    const trail: [number, number][] = [];
    const stepDt = 1 / stepsPerSecond(prefs);

    const announce = () => {
      const s = stateRef.current;
      const done = s.phase === 'swing' || s.phase === 'done' ? s.shots.length : s.shots.length - 1;
      for (; announced < done; announced++) {
        const shot = s.shots[announced];
        const now = (performance.now() - t0.current) / 1000;
        if (shot.monster) {
          const m = shot.monster;
          const tier = digTierOf(m.species);
          effects.current.spawn(worn.catch, PIVOT.x, PIVOT.y + 20, now, still);
          if (tier !== 'common' || m.shiny) setMonsterBanner({ m: { ...m, tier }, caught: true, key: now });
          setSay(`Caught ${m.shiny ? 'a shiny ' : ''}${monsterName(m.species)}! ${TIER_RULES[tier].name}. ${s.monsters.length} caught.${shot.netted ? ' The Monster Net held it.' : ''}`);
        } else if (shot.banked > 0 && shot.gem) {
          effects.current.spawn(worn.catch, PIVOT.x, PIVOT.y + 20, now, still, shot.gem);
          const name = gemOf(shot.gem).name;
          if (isRare(shot.gem)) {
            effects.current.rare(shot.gem, PIVOT.x, PIVOT.y + 20, now, still);
            setRareBanner({ gem: shot.gem, caught: true, key: now });
            setSay(`Rare gem caught! A ${name} for your Gem Book! ${s.banked} of ${spec.target}.`);
            continue;
          }
          setSay(last ? `Caught ${name === 'Heart Diamond' ? 'the Heart Diamond!' : `a ${name}!`}` : `Caught a ${name}! ${s.banked} of ${spec.target}.`);
        } else if (shot.kind === 'sack') {
          const t = s.things.find((x) => x.id === shot.grabbed);
          const p = t?.sack;
          setSay(p && 'coins' in p ? `Mystery sack: ${p.coins} coins!` : p && 'seconds' in p ? `Mystery sack: ${p.seconds} more seconds!` : 'Mystery sack: a free boost for your next level!');
          showTipRef.current('sack');
          effects.current.spawn(undefined, PIVOT.x, PIVOT.y + 20, now, still);
        } else if (shot.kind === 'rock') {
          setSay(shot.blasted ? 'Rock Blaster! The rock turned to dust.' : 'A rock. Heavy, and worth nothing.');
          if (!shot.blasted) showTipRef.current('rock');
        }
      }
    };

    const thingPos = (t: Thing, tick: number) => thingAt(t, tick);

    const drawThing = (c: CanvasRenderingContext2D, t: Thing, x: number, y: number, time: number, dir: 1 | -1 = 1, out = true) => {
      if (t.kind === 'gem' && t.gem && isRare(t.gem)) {
        drawRareAura(c, t.gem, x, y, t.r, time + t.id, still);
        drawGem(c, t.gem, x, y, t.r * 1.15, { sparkle: still ? 0.8 : 0.6 + Math.sin(time * 4) * 0.4 });
        if (!still) drawRareGleam(c, x, y, t.r * 1.15, time);
      } else if (t.kind === 'gem' && t.gem) drawGem(c, t.gem, x, y, t.r, { halo: true, sparkle: still ? 0 : Math.max(0, Math.sin(time * 2 + t.id) * 1.4 - 0.4) });
      else if (t.kind === 'rock') drawRock(c, x, y, t.r, t.id);
      else if (t.kind === 'sack') drawSack(c, x, y, t.r);
      else if (t.kind === 'crab') drawCrab(c, x, y, t.r, time, still, t.crab?.gem, dir);
      else if (t.kind === 'monster' && t.monster) drawMonster(c, t.monster, x, y, t.r, time, still, dir, out);
    };

    const render = (dt: number) => {
      if (!ctx || !el) return;
      const s = stateRef.current;
      const w = el.clientWidth || FIELD_W;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const scale = (w * dpr) / FIELD_W;
      if (el.width !== Math.round(FIELD_W * scale)) { el.width = Math.round(FIELD_W * scale); el.height = Math.round(FIELD_H * scale); }
      if (!bg || bgScale !== scale || (!bgPainted && paintNow('levels', el.width > 1000 ? String(art) : `${art}-800`))) {
        bg = document.createElement('canvas');
        bg.width = el.width; bg.height = el.height;
        const b = bg.getContext('2d');
        if (b) { b.scale(scale, scale); bgPainted = drawBackground(b, started.level); }
        bgScale = scale;
      }
      const time = (performance.now() - t0.current) / 1000;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(bg, 0, 0);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      drawAmbient(ctx, started.level, time, still);
      const tum = tumble.current;
      const tumbling = tum && time - tum.start < 0.6;
      for (const t of s.things) {
        if (!s.buried.has(t.id) || (tumbling && t.id === tum!.id)) continue;
        const p = thingPos(t, s.tick);
        const ahead = t.crab ? thingPos(t, s.tick + 1).x - p.x : 0;
        drawThing(ctx, t, p.x, p.y, time, ahead < 0 ? -1 : 1, shownAt(t, s.tick));
      }
      // The claw
      const swinging = s.phase === 'swing' || s.phase === 'done';
      const deg = swinging ? s.swing / 10 : s.degree;
      const rad = (deg * Math.PI) / 180;
      const len = swinging ? HANG : Math.max(HANG, s.length);
      const dir = swinging ? { dx: Math.sin(rad), dy: Math.cos(rad) } : direction(s.degree);
      const tx = PIVOT.x + dir.dx * len, ty = PIVOT.y + dir.dy * len;
      if (s.phase === 'reel') turn += dt * 9;
      else if (s.phase === 'out') turn -= dt * 9;
      if (s.phase === 'out' || s.phase === 'reel' || s.phase === 'question') { trail.push([tx, ty]); if (trail.length > 30) trail.shift(); }
      else if (trail.length) trail.shift();
      drawTrail(ctx, trail, worn.trail, time, still);
      drawRope(ctx, PIVOT.x, PIVOT.y, tx, ty, worn.rope, time, still);
      if (s.grabbed && !(s.grabbed.kind === 'rock' && s.weight === 'empty')) {
        const g = s.grabbed;
        drawThing(ctx, g, tx + dir.dx * g.r * 0.7, ty + dir.dy * g.r * 0.7 + 6, time);
      }
      const shake = s.phase === 'question' && !still ? Math.sin(time * 40) * 0.05 : 0;
      drawClaw(ctx, tx, ty, rad + shake, s.grabbed !== null, worn.head, 40, time);
      drawWinch(ctx, PIVOT.x, PIVOT.y, worn.winch, turn, time, still);
      const pose = effects.current.dancing(time) ? 'cheer' : s.phase === 'question' ? 'oops' : s.passTick !== null ? 'cheer' : 'stand';
      drawNugget(ctx, NUGGET_SPOT.x, NUGGET_SPOT.y, 80, worn.hat, pose, time, still, -1);
      effects.current.draw(ctx, dt, time);
      if (tum && tumbling) {
        const k = (time - tum.start) / 0.6;
        const x = tum.from[0] + (tum.to[0] - tum.from[0]) * k;
        const y = tum.from[1] + (tum.to[1] - tum.from[1]) * k * k;
        ctx.save(); ctx.translate(x, y); if (!still) ctx.rotate(k * 6); drawGem(ctx, tum.gem, 0, 0, gemOf(tum.gem).r); ctx.restore();
      }
    };

    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;
      const s = stateRef.current;
      if (!pausedRef.current && !ending.current && s.phase !== 'question' && s.phase !== 'done') {
        acc += dt;
        while (acc >= stepDt) {
          acc -= stepDt;
          if (wantFinish.current && s.phase === 'swing' && s.passTick !== null) {
            wantFinish.current = false;
            finishAt.current = s.tick;
            step(s, 'finish');
          } else step(s, null);
          announce();
          const now = s.phase as Phase;
          if (now === 'question' || now === 'done') { acc = 0; break; }
        }
        setHud((h) => {
          const n = hudOf(s);
          return n.seconds === h.seconds && n.banked === h.banked && n.coins === h.coins && n.passed === h.passed && n.busy === h.busy ? h : n;
        });
        const phase = s.phase as Phase;
        if (phase === 'question' && s.waitingSlot !== null) setSlot(s.waitingSlot);
        if (phase === 'done') void end();
      }
      render(dt);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
    // The level's look and speed are fixed once it starts.
  }, []);

  const q = slot !== null ? started.questions[slot] : undefined;
  const shown: ShownQuestion | null = q ? { id: started.seed * 10 + q.slot, parts: q.parts, spoken: q.spoken, prompt: q.prompt, choices: q.choices, choiceLabels: q.choiceLabels, maxLength: q.maxLength, input: q.input, figure: q.figure } : null;

  const onSubmit = async (value: number, ms: number): Promise<MarkedAnswer> => {
    const r = await backend.answer(started.seed, slot!, value, ms);
    if (!r.ok) return { correct: false, fact: '', boxBefore: 0, boxAfter: 0 };
    return { correct: r.value.correct, fact: factText(q!, r.value.answer), boxBefore: 0, boxAfter: 0, answer: r.value.answer, reward: r.value.correct ? 'Firm grip!' : undefined };
  };

  const onAnswered = (result: MarkedAnswer) => {
    const s = stateRef.current;
    const carrying = s.carrying;
    const wriggler = s.carryingMonster;
    const from = (() => {
      const d = direction(s.degree);
      return [PIVOT.x + d.dx * s.length, PIVOT.y + d.dy * s.length] as [number, number];
    })();
    const id = s.grabbed?.id ?? -1;
    answerSlip(s, result.correct);
    if (!result.correct && carrying) {
      const landed = s.slips[s.slips.length - 1]?.landed;
      if (landed) tumble.current = { gem: carrying, id, from, to: [landed.x, landed.y], start: (performance.now() - t0.current) / 1000 };
      setSay(`Oh no! The ${gemOf(carrying).name} fell back into the rock. You can catch it again.`);
    } else if (carrying) setSay(`Firm grip! The ${gemOf(carrying).name} is coming up.`);
    else if (wriggler) setSay(result.correct ? `Got it! ${monsterName(wriggler.species)} is coming up.` : `${monsterName(wriggler.species)} wriggled free and burrowed deeper. You can grab it again.`);
    setSlot(null);
  };

  const target = last ? 1 : cavern ? cavern.goal.count : spec.target;
  const guide = guiding ? guideStep({ drops: drops.current.length, banked: hud.banked, passed: hud.passed, busy: hud.busy, target: spec.target }) : null;
  const progress = last ? (hud.passed ? 1 : 0) : cavern ? (hud.passed ? 1 : Math.min(0.95, hud.monsters / target)) : Math.min(1, hud.banked / target);
  const wriggling = stateRef.current.carryingMonster;
  const goalText = cavern ? (hud.passed ? 'Goal met!' : `${goalWords(cavern.goal)} · ${hud.monsters} caught`) : null;

  return (
    <section className="dd-play" aria-labelledby="dd-play-title">
      {/* The level's painting, blurred, behind the whole window: it fills whatever edge the field doesn't reach. */}
      {paintFile('levels', `${art}-800`) && <img className="dd-play__blur" src={paintFile('levels', `${art}-800`)} alt="" aria-hidden="true" />}
      <div className="dd-play__hud">
        <h2 id="dd-play-title" ref={heading} tabIndex={-1} className="dd-play__title">
          {cavern ? `Cavern ${started.level - LAST_LEVEL}` : `Level ${started.level}`} <span className="dd-soft">· {spec.place}</span>
        </h2>
        <div className="dd-hud__item" role="timer" aria-label={`${hud.seconds} seconds left`}>
          <span aria-hidden="true">⏱</span> {hud.seconds}s
        </div>
        <div className="dd-hud__item dd-hud__coins" aria-label={`${hud.coins} coins this level`}>
          <span aria-hidden="true">🪙</span> {hud.coins}
        </div>
        <div className={`dd-target${guide?.glow === 'bar' ? ' dd-glow' : ''}`} role="img" aria-label={goalText ?? (last ? (hud.passed ? 'Heart Diamond caught!' : 'Goal: catch the Heart Diamond') : `${hud.banked} of ${target} gem coins`)}>
          <div className={`dd-target__fill${hud.passed ? ' is-done' : ''}`} style={{ width: `${progress * 100}%` }} />
          <span className="dd-target__text">{goalText ?? (last ? (hud.passed ? 'Heart Diamond caught!' : 'Catch the Heart Diamond') : `${hud.banked} / ${target}`)}</span>
        </div>
      </div>

      <div className={`dd-field${paused ? ' is-hidden' : ''}`}>
        <canvas
          ref={canvas}
          className="dd-field__canvas"
          role="img"
          aria-label={`The claw swings over ${spec.place}. Press Drop to send it down.`}
          onPointerDown={(e) => { e.preventDefault(); drop(); }}
        />
        {guide && (
          <div className="dd-tip dd-tip--guide" role="status">
            <span>{guide.text}</span>
            <button type="button" className="button button--light-outline dd-btn dd-btn--small" onClick={endGuide}>Skip the guide</button>
          </div>
        )}
        {rareBanner && (
          <RareBanner key={rareBanner.key} gem={rareBanner.gem} caught={rareBanner.caught} still={still} onClose={() => setRareBanner(null)} />
        )}
        {monsterBanner && (
          <MonsterBanner key={monsterBanner.key} m={monsterBanner.m} caught={monsterBanner.caught} still={still} onClose={() => setMonsterBanner(null)} />
        )}
        {tip && !guide && (
          <div className="dd-tip" role="note">
            <span>{tip}</span>
            <button type="button" className="dd-tip__close" onClick={() => setTip(null)} aria-label="Close tip">×</button>
          </div>
        )}
      </div>

      <p className="dd-sr" aria-live="polite">{say}</p>

      <div className="dd-play__controls">
        <button type="button" className="button button--light-outline dd-btn" onClick={() => setPaused(true)} disabled={checking}>Pause</button>
        <button
          type="button"
          className={`dd-drop${guide?.glow === 'drop' ? ' dd-glow' : ''}`}
          onClick={drop}
          aria-disabled={hud.busy}
          disabled={checking}
        >
          Drop
        </button>
        {hud.passed && !last && (
          <button type="button" className={`button button--play dd-btn${guide?.glow === 'finish' ? ' dd-glow' : ''}`} onClick={finish} disabled={checking}>
            Finish
          </button>
        )}
      </div>

      {paused && (
        <div className="dd-overlay" role="dialog" aria-modal="true" aria-labelledby="dd-pause-title">
          <div className="dd-card">
            <h2 id="dd-pause-title" tabIndex={-1} ref={(h) => h?.focus()}>Paused</h2>
            <p>The clock is stopped.</p>
            <div className="dd-row">
              <button type="button" className="button button--primary dd-btn" onClick={() => setPaused(false)}>Keep digging</button>
              <button type="button" className="button button--light-outline dd-btn" onClick={() => { setPaused(false); void end(); }}>Leave this level</button>
            </div>
            <p className="dd-soft dd-small">Leaving ends the level now. Gems already on the way up still count.</p>
          </div>
        </div>
      )}

      {checking && <p className="dd-checking" role="status">Counting your gems…</p>}

      {shown && (
        <QuestionModal
          question={shown}
          title={wriggling ? 'It’s wriggling!' : 'Hold on!'}
          note={wriggling ? `${monsterName(wriggling.species)} is trying to wriggle free! Answer to hold on. The clock waits for you.` : hud.passed ? 'Answer to keep your grip.' : 'Slippery! Answer to keep your grip. The clock waits for you.'}
          onSubmit={onSubmit}
          onDone={onAnswered}
          spot="diamond-hold-on"
        />
      )}
    </section>
  );
}

/** The big banner for a rare gem: when a level starts with one buried, and when it's caught. It doesn't stop the clock. */
function RareBanner({ gem, caught, still, onClose }: { gem: RareId; caught: boolean; still: boolean; onClose: () => void }) {
  const g = rareOf(gem);
  return (
    <div className={`dd-rare-banner is-${g.tier}${caught ? ' is-caught' : ''}${still ? ' is-still' : ''}`} aria-hidden="true" onPointerDown={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="dd-rare-banner__rays" />
      <div className="dd-rare-banner__gem">
        <Sprite size={92} animate={!still} draw={(c, t) => { drawRareAura(c, gem, 50, 50, 20, t, still); drawGem(c, gem, 50, 50, 24); }} />
      </div>
      <div className="dd-rare-banner__words">
        <span className="dd-rare-banner__kicker">{caught ? 'Rare gem caught!' : '✨ A rare gem appeared! ✨'}</span>
        <strong className="dd-rare-banner__name">{g.name}</strong>
        <span className="dd-rare-banner__tier">{RARE_TIER_NAME[g.tier]} · {chanceWords(g)}{caught ? ' · added to your Gem Book' : ' · buried near the bottom'}</span>
      </div>
      {!still && <div className="dd-rare-banner__glitter">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ ['--i' as string]: i }} />)}</div>}
    </div>
  );
}

/** The most special monster buried in a cavern (a shiny, a sleeping giant or an ultra rare), for the opening banner. */
function bestMonster(things: readonly Thing[]): (Caught & { tier: DigTier }) | null {
  const ms = monstersIn(things).map((t) => t.monster!);
  const pick = ms.find((m) => m.tier === 'ultra') ?? ms.find((m) => m.tier === 'giant') ?? ms.find((m) => m.shiny) ?? null;
  return pick ? { species: pick.species, shiny: pick.shiny, tier: pick.tier } : null;
}

/** The banner for a special monster: when a cavern starts with one in it, and when a rarer one is caught. */
function MonsterBanner({ m, caught, still, onClose }: { m: Caught & { tier: DigTier }; caught: boolean; still: boolean; onClose: () => void }) {
  const look = m.tier === 'ultra' || m.shiny ? 'legendary' : m.tier === 'giant' ? 'epic' : m.tier === 'rare' ? 'rare' : 'uncommon';
  const what = m.tier === 'ultra' ? 'An ultra rare monster' : m.tier === 'giant' ? 'A sleeping giant' : m.shiny ? 'A shiny monster' : 'A rare monster';
  return (
    <div className={`dd-rare-banner is-${look}${caught ? ' is-caught' : ''}${still ? ' is-still' : ''}`} aria-hidden="true" onPointerDown={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="dd-rare-banner__rays" />
      <div className="dd-rare-banner__gem">
        {monsterUrl(m.species, m.shiny) ? <img src={monsterUrl(m.species, m.shiny)} alt="" width={92} height={92} /> : <span style={{ fontSize: 60, color: TIER_COLOUR[m.tier] }}>●</span>}
      </div>
      <div className="dd-rare-banner__words">
        <span className="dd-rare-banner__kicker">{caught ? 'Monster caught!' : `✨ ${what} is hiding here! ✨`}</span>
        <strong className="dd-rare-banner__name">{m.shiny ? 'Shiny ' : ''}{caught ? monsterName(m.species) : '???'}</strong>
        <span className="dd-rare-banner__tier">{TIER_RULES[m.tier].name}{caught ? ' · added to your Monster Book' : ' · grab it before it burrows away'}</span>
      </div>
      {!still && <div className="dd-rare-banner__glitter">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ ['--i' as string]: i }} />)}</div>}
    </div>
  );
}
