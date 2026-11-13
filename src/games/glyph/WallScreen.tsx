/**
 * One temple wall (docs/GLYPH-PLAN.md): light the tiles equal to the gold stone, press Light the runes, pick the glyph. The
 * browser judges each go with `judgeGo` so the wall can open or shake; the server re-runs every go. The help ladder never
 * lights a tile. A guided wall (`guide`) can't fail: the hand steps through it and nothing is counted.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GOES_PER_WALL, GRID, WALLS_PER_TEMPLE } from '../../../shared/glyph/config';
import { arrowsBetween, equal, fracText } from '../../../shared/glyph/fractions';
import { glyphOfLit, judgeGo, rightCells, type Go, type Judged, type WallPlay } from '../../../shared/glyph/play';
import type { PublicWall } from '../../../shared/glyph/walls';
import { PointingHand } from '../../kit/PointingHand';
import { ShowWhy } from '../../kit/ShowWhy';
import type { Say } from './voice';
import { ArrowCurve, FractionBar, GlyphPicture, Monkey, Stack } from './Art';
import { arrowWords, guideLine as guideWords, LOOK_CLOSELY, LOOK_CLOSELY_NONE, NO_MATCH, nextStep, PICK_GLYPH, PRESS_LIGHT, spokenFrac, WALL_ASK, WHY_VOICE, whyOf, type Phase, type Why } from './words';

export interface WallScreenProps {
  wall: PublicWall;
  /** From 0. */
  index: number;
  templeName: string;
  /** The help rung to start at (0 to 3). */
  help: number;
  guide?: boolean;
  /** How each earlier wall opened, for the row of stones. */
  marks?: ('first' | 'help')[];
  onDone: (play: WallPlay | null) => void;
  onSkipGuide?: () => void;
  onLeave: () => void;
  /** Bella reads a line (only the recorded ones, and only while the voice is on). */
  say?: Say;
}

const OPEN_MS = 1200;
const REVEAL_STEP_MS = 650;

export function WallScreen({ wall, index, templeName, help, guide = false, marks = [], onDone, onSkipGuide, onLeave, say }: WallScreenProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const t0 = useRef(performance.now());
  const used = useRef(0);
  const timers = useRef<number[]>([]);
  const [lit, setLit] = useState<number[]>([]);
  const [phase, setPhase] = useState<Phase | 'reveal'>('tiles');
  const [goes, setGoes] = useState<Go[]>([]);
  const [why, setWhy] = useState<(Why & { judged: Judged }) | null>(null);
  const [note, setNote] = useState('');
  const [shake, setShake] = useState(0);
  const [lensMode, setLensMode] = useState(false);
  const [lensTile, setLensTile] = useState<number | null>(null);
  const [lastTap, setLastTap] = useState<number | null>(null);
  const [arrowsOn, setArrowsOn] = useState(false);
  const [revealed, setRevealed] = useState(0);
  const [intro, setIntro] = useState(false);

  const right = useMemo(() => rightCells(wall), [wall]);
  const made = glyphOfLit(wall, lit);
  const wrongGo = goes.length > 0;
  const showBar = !guide && (help >= 1 || wrongGo);
  const lensAvail = !guide && (help >= 2 || wrongGo);
  const arrowsAvail = !guide && (help >= 3 || wrongGo);
  const locked = phase !== 'tiles';
  const arrowTile = lensTile ?? lastTap;

  useEffect(() => {
    heading.current?.focus();
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, []);
  const later = (ms: number, f: () => void) => timers.current.push(window.setTimeout(f, ms));

  // Record the highest help rung actually shown.
  useEffect(() => {
    if (showBar) used.current = Math.max(used.current, 1);
  }, [showBar]);
  useEffect(() => {
    if (lensTile !== null) used.current = Math.max(used.current, 2);
  }, [lensTile]);
  useEffect(() => {
    if (arrowsOn && arrowTile !== null) used.current = Math.max(used.current, 3);
  }, [arrowsOn, arrowTile]);

  const tap = (c: number) => {
    if (lensMode) {
      setLensTile(c);
      setLensMode(false);
      return;
    }
    if (locked) return;
    setLastTap(c);
    setNote('');
    setLit((l) => (l.includes(c) ? l.filter((x) => x !== c) : [...l, c]));
  };

  const guideReady = !guide || (lit.length === right.length && lit.every((c) => right.includes(c)));
  const light = () => {
    if (!lit.length) return setNote('Light at least one tile first.');
    if (!guideReady) return setNote(`Light the tiles worth ${fracText(wall.gold)}: ${right.map((c) => fracText(wall.tiles[c])).join(', ')}.`);
    setNote('');
    setLensMode(false);
    setPhase('glyphs');
  };

  const submit = (pick: number | null) => {
    if (guide) {
      setPhase('open');
      later(OPEN_MS, () => onDone(null));
      return;
    }
    const go: Go = { lit: [...lit], pick, ms: Math.round(performance.now() - t0.current) };
    const judged = judgeGo(wall, go);
    const all = [...goes, go];
    setGoes(all);
    const play = (): WallPlay => ({ goes: all, help: used.current });
    if (judged.outcome === 'open') {
      setWhy(null);
      setPhase('open');
      later(OPEN_MS, () => onDone(play()));
      return;
    }
    setShake((s) => s + 1);
    if (all.length >= GOES_PER_WALL) {
      setWhy(null);
      setPhase('reveal');
      setLit([]);
      right.forEach((_, k) => later((k + 1) * REVEAL_STEP_MS, () => setRevealed(k + 1)));
      later((right.length + 2) * REVEAL_STEP_MS + 600, () => onDone(play()));
      return;
    }
    const w = whyOf(wall, judged);
    setWhy(w && { ...w, judged });
    setNote(judged.outcome === 'nomatch' ? NO_MATCH : '');
    setPhase('tiles');
  };

  const pickGlyph = (i: number) => {
    if (made !== i) return setNote(LOOK_CLOSELY);
    setNote('');
    submit(i);
  };
  const noneMatch = () => {
    if (made !== -1) return setNote(LOOK_CLOSELY_NONE);
    setNote('');
    submit(null);
  };

  // The guide: one lit thing at a time.
  const wrongLit = lit.find((c) => !right.includes(c));
  const nextRight = right.find((c) => !lit.includes(c));
  const guideStep = !guide ? -1 : !intro ? 0 : phase === 'glyphs' ? 3 : guideReady ? 2 : 1;
  const handTile = guideStep === 1 ? (wrongLit ?? nextRight ?? null) : null;
  const guideLine = guideWords(Math.max(guideStep, 0), wall.gold, wrongLit === undefined ? undefined : wall.tiles[wrongLit], nextRight === undefined ? undefined : wall.tiles[nextRight]);

  // Bella: the ask when a wall opens (or the guide's line), the glyph step, the mistakes and the result of a wrong go.
  useEffect(() => {
    if (!guide) say?.(WALL_ASK);
  }, [say, guide]);
  useEffect(() => {
    if (guide) say?.(guideLine);
    else if (phase === 'glyphs') say?.(PICK_GLYPH);
  }, [say, guide, guideLine, phase]);
  useEffect(() => {
    if (note) say?.(note);
  }, [say, note]);
  useEffect(() => {
    if (why) say?.(WHY_VOICE[why.kind], () => say(PRESS_LIGHT));
  }, [say, why]);

  const skip = useCallback(() => onSkipGuide?.(), [onSkipGuide]);

  const arrowInfo = arrowTile !== null ? arrowsBetween(wall.gold, wall.tiles[arrowTile]) : null;
  const same = (c: number) => equal(wall.tiles[c], wall.gold);
  const cheering = phase === 'open';

  return (
    <section className={`gg-wall${cheering ? ' gg-wall--open' : ''}`} aria-labelledby="gg-wall-h">
      <header className="gg-wall__top">
        <div>
          <h2 id="gg-wall-h" className="gg-h" tabIndex={-1} ref={heading}>{guide ? 'Practice wall' : `Wall ${index + 1} of ${WALLS_PER_TEMPLE}`}</h2>
          <p className="gg-soft">{guide ? 'Mango the monkey will show you.' : templeName}</p>
        </div>
        {!guide && (
          <ol className="gg-dots" aria-label="Walls opened">
            {Array.from({ length: WALLS_PER_TEMPLE }, (_, i) => (
              <li key={i} className={marks[i] ? `gg-dot gg-dot--${marks[i]}` : i === index ? 'gg-dot gg-dot--now' : 'gg-dot'} />
            ))}
          </ol>
        )}
        {guide ? (
          <button type="button" className="gg-btn" onClick={skip}>Skip the guide</button>
        ) : (
          <button type="button" className="gg-btn" onClick={onLeave}>Leave temple</button>
        )}
      </header>

      <p className="gg-ask">{WALL_ASK}</p>

      <div className="gg-wall__body">
        <div className="gg-stone" key={`stone-${index}`}>
          <p className="gg-stone__name">Gold stone</p>
          <div className={`gg-stone__face${guideStep === 0 ? ' gg-pointed' : ''}`} role="img" aria-label={`The gold stone: ${spokenFrac(wall.gold)}`}>
            <Stack frac={wall.gold} />
            {guideStep === 0 && <PointingHand prefix="gg" />}
          </div>
          {showBar && <FractionBar frac={wall.gold} label={`Bar for ${spokenFrac(wall.gold)}`} />}
          {showBar && lensTile !== null && (
            <div className="gg-compare" aria-live="polite">
              <p className="gg-soft">{fracText(wall.tiles[lensTile])}</p>
              <FractionBar frac={wall.tiles[lensTile]} tone={same(lensTile) ? 'green' : 'red'} label={`Bar for ${spokenFrac(wall.tiles[lensTile])}: ${same(lensTile) ? 'the same length' : 'a different length'}`} />
            </div>
          )}
          {(lensAvail || arrowsAvail) && (
            <div className="gg-tools">
              {lensAvail && (
                <button type="button" className="gg-btn gg-btn--tool" aria-pressed={lensMode} onClick={() => { setLensMode((m) => !m); setNote(''); }}>
                  Lens
                </button>
              )}
              {arrowsAvail && (
                <button type="button" className="gg-btn gg-btn--tool" aria-pressed={arrowsOn} onClick={() => setArrowsOn((a) => !a)}>
                  × arrows
                </button>
              )}
            </div>
          )}
          {lensMode && <p className="gg-soft" role="status">Tap a tile to lay its bar beside the gold stone's.</p>}
          {arrowsOn && (
            <div className="gg-arrows" role="status">
              {arrowInfo && arrowTile !== null ? (
                <>
                  <div className="gg-arrows__row">
                    <span>{fracText(wall.gold)}</span>
                    <ArrowCurve tone={arrowInfo.top === arrowInfo.bottom ? 'gold' : 'red'} label={arrowInfo.top !== null && arrowInfo.top === arrowInfo.bottom ? `${arrowInfo.way === 'times' ? '×' : '÷'}${arrowInfo.top}` : `top ${arrowInfo.way === 'times' ? '×' : '÷'}${arrowInfo.top ?? '?'}, bottom ${arrowInfo.way === 'times' ? '×' : '÷'}${arrowInfo.bottom ?? '?'}`} />
                    <span>{fracText(wall.tiles[arrowTile])}</span>
                  </div>
                  <p>{arrowWords(wall.gold, wall.tiles[arrowTile])}</p>
                </>
              ) : (
                <p>Tap a tile first, then I can show its arrows.</p>
              )}
            </div>
          )}
        </div>

        <div className="gg-gridwrap">
          <div key={shake} className={`gg-grid${shake ? ' gg-grid--shake' : ''}${phase === 'reveal' ? ' gg-grid--reveal' : ''}`} role="group" aria-label="Wall tiles" style={{ ['--gg-n' as string]: GRID }}>
            {wall.tiles.map((t, c) => {
              const on = lit.includes(c);
              const gold = phase === 'reveal' && right.indexOf(c) !== -1 && right.indexOf(c) < revealed;
              const bad = !!why && why.cell === c && (why.kind === 'missed' ? !on : on);
              const chip = gold ? arrowsBetween(wall.gold, t) : null;
              return (
                <button
                  key={c}
                  type="button"
                  className={`gg-tile${on ? ' gg-tile--lit' : ''}${gold ? ' gg-tile--gold' : ''}${bad ? (why?.kind === 'missed' ? ' gg-tile--missed' : ' gg-tile--bad') : ''}${lensMode ? ' gg-tile--lens' : ''}${lensTile === c ? ' gg-tile--seen' : ''}`}
                  aria-pressed={on}
                  aria-label={spokenFrac(t)}
                  onClick={() => tap(c)}
                  disabled={phase === 'open' || phase === 'reveal'}
                >
                  <Stack frac={t} />
                  {chip && <span className="gg-chip">{chip.way === 'times' ? '×' : '÷'}{chip.top}</span>}
                  {handTile === c && <PointingHand prefix="gg" />}
                </button>
              );
            })}
          </div>
          <p className="gg-next" role="status" aria-live="polite">
            {phase === 'reveal'
              ? `Here they are: these tiles are all worth ${fracText(wall.gold)}. ${revealed ? arrowWords(wall.gold, wall.tiles[right[Math.min(revealed, right.length) - 1]]) : ''}`
              : phase === 'tiles' && lit.length > 0 && !guide
                ? `${nextStep(wall.gold, lit.length, 'tiles')}`
                : phase === 'tiles' && guide && guideStep === 2
                  ? PRESS_LIGHT
                  : nextStep(wall.gold, lit.length, phase === 'open' ? 'open' : phase === 'glyphs' ? 'glyphs' : 'tiles')}
          </p>
          {guide && <p className="gg-tip" role="status"><b>Mango:</b> {guideLine}{guideStep === 0 && <button type="button" className="gg-btn gg-btn--primary gg-btn--small" onClick={() => setIntro(true)}>Next</button>}</p>}
        </div>

        <div className="gg-side">
          {phase === 'tiles' && (
            <button
              type="button"
              className={`gg-btn gg-btn--primary gg-light${lit.length ? ' gg-light--ready' : ''}`}
              aria-disabled={!lit.length || !guideReady}
              onClick={light}
            >
              Light the runes
              {guideStep === 2 && <PointingHand prefix="gg" />}
            </button>
          )}
          {(phase === 'glyphs' || phase === 'open') && (
            <div className="gg-glyphs" role="group" aria-label="Glyphs">
              {wall.glyphs.map((g, i) => (
                <button
                  key={i}
                  type="button"
                  className={`gg-glyph${phase === 'open' && i === made ? ' gg-glyph--right' : ''}`}
                  aria-label={`Glyph ${i + 1}`}
                  onClick={() => pickGlyph(i)}
                  disabled={phase === 'open'}
                >
                  <GlyphPicture cells={g} size={88} />
                  {guideStep === 3 && i === made && <PointingHand prefix="gg" />}
                </button>
              ))}
              {!guide && phase === 'glyphs' && (
                <button type="button" className="gg-btn gg-none" onClick={noneMatch}>None of them match</button>
              )}
            </div>
          )}
          {note && <p className="gg-note" role="status">{note}</p>}
          {why && phase === 'tiles' && (
            <ShowWhy
              prefix="gg"
              tapKey={goes.length}
              line={why.line}
              picture={
                <div className="gg-why__bars">
                  <FractionBar frac={wall.gold} label={`Bar for ${spokenFrac(wall.gold)}`} />
                  <FractionBar frac={wall.tiles[why.cell]} tone={why.kind === 'missed' ? 'green' : 'red'} label={`Bar for ${spokenFrac(wall.tiles[why.cell])}`} />
                </div>
              }
            />
          )}
          {why && phase === 'tiles' && <p className="gg-soft">One more go. Fix your tiles and press Light the runes again.</p>}
        </div>
      </div>

      {cheering && (
        <div className="gg-cheer" role="status">
          <Monkey cheer />
          <Monkey cheer flip />
          <Monkey cheer />
          <p className="gg-cheer__say">The wall opens!</p>
        </div>
      )}
    </section>
  );
}
