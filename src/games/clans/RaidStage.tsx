/**
 * The Village Raid's big moments (James, 17 Nov 2026: "flashy, immersive animations and art"): the siege on its own painting
 * with flaming arrows, the "RAID!" entrance where the two clan banners clash, and Banners raining down after a win.
 * Display only. Everything moves with CSS (clans.css, "Village Raid stage"), and none of it moves with reduced motion.
 */
import { useEffect, useRef, useState } from 'react';
import { CONFIG } from '../../../shared/clans/config';
import { bannerArt, sceneArt } from './art';

const pct = (x: number) => Math.round(x * 100);

/** Counts up from 0 to `to` once it starts (a number that climbs while the stamp lands). */
function useCountUp(to: number, start: boolean, ms = 900) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!start) return;
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setN(to);
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      setN(Math.round(to * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, start, ms]);
  return n;
}

/** Flaming arrows arcing across the painting (fixed paths, so nothing jumps on a re-render). */
const ARROWS = [
  { x: 4, y: 70, d: 0 }, { x: 10, y: 62, d: 0.35 }, { x: 2, y: 55, d: 0.7 }, { x: 14, y: 74, d: 1.05 }, { x: 7, y: 66, d: 1.4 }, { x: 0, y: 60, d: 1.75 },
];
const EMBERS = Array.from({ length: 16 }, (_, i) => ({ x: (i * 37) % 100, d: (i * 0.41) % 4, s: 3 + (i % 4) }));

export function Embers() {
  return (
    <div className="cq-embers" aria-hidden="true">
      {EMBERS.map((e, i) => <span key={i} style={{ '--x': `${e.x}%`, '--d': `${e.d}s`, '--s': `${e.s}px` } as React.CSSProperties} />)}
    </div>
  );
}

/** The siege, before the heroes fight: the army storms the walls (a BREACH! stamp with the share), then their Tower shoots. */
export function RaidSiegeStage({ name, breach, tower, right, skipped, onFight }: {
  name: string; breach: number; tower: number; right: boolean | null; skipped: boolean; onFight: () => void;
}) {
  const art = sceneArt('raid-siege');
  const [stage, setStage] = useState(0);
  const go = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const times = [1300, 2600, 3600].map((ms, i) => window.setTimeout(() => setStage(i + 1), ms));
    return () => times.forEach(window.clearTimeout);
  }, []);
  useEffect(() => {
    if (stage >= 3) go.current?.focus();
  }, [stage]);
  const shown = useCountUp(pct(breach), stage >= 1);
  const skip = () => setStage(3);
  return (
    <section className={`cq-rsiege is-stage-${stage}`} role="dialog" aria-modal="true" aria-label="The siege" onClick={stage < 3 ? skip : undefined}>
      {art.wide ? <img className="cq-rsiege__pic" src={art.wide} srcSet={art.small && art.small !== art.wide ? `${art.small} 800w, ${art.wide} 1600w` : undefined} sizes="(max-width: 1100px) 100vw, 1100px" alt="" /> : <div className="cq-rsiege__pic cq-rsiege__pic--plain" />}
      <div className="cq-rsiege__shade" aria-hidden="true" />
      <div className="cq-rsiege__arrows" aria-hidden="true">
        {ARROWS.map((a, i) => <span key={i} style={{ '--x': `${a.x}%`, '--y': `${a.y}%`, '--d': `${a.d}s` } as React.CSSProperties} />)}
      </div>
      <Embers />
      <h2 className="cq-rsiege__title">Storm the {name} clan's walls!</h2>
      {stage >= 1 && (
        <div className="cq-rsiege__stamp" role="status">
          <span className="cq-rsiege__stampword">{pct(breach) > 0 ? 'Breach!' : 'The walls hold!'}</span>
          {pct(breach) > 0 && <span className="cq-rsiege__stampnum">−{shown}%</span>}
          <span className="cq-rsiege__stampline">{pct(breach) > 0 ? 'Your army knocks this off their heroes’ health.' : 'Your army couldn’t break through this time.'}</span>
        </div>
      )}
      {stage >= 2 && (
        <p className="cq-rsiege__tower" role="status">
          {pct(tower) > 0 ? <>🏹 Their Tower shoots first! Your heroes lose <strong>{pct(tower)}%</strong>.</> : <>🏹 They have no Tower, so nobody shoots first.</>}
        </p>
      )}
      <div className="cq-rsiege__foot">
        {right === true && <p className="cq-rsiege__note">Your answer was right, so your army hit {pct(CONFIG.classRaids.siege.rightBoost - 1)}% harder!</p>}
        {right === false && !skipped && <p className="cq-rsiege__note">Not quite this time. No harm done.</p>}
        <button ref={go} type="button" className="cq-btn cq-btn--hot cq-rsiege__go" onClick={(e) => { e.stopPropagation(); onFight(); }}>
          {stage >= 3 ? 'Into the village!' : 'Skip to the fight'}
        </button>
      </div>
    </section>
  );
}

/** The raid's entrance, before round 1: the two clans' banners swing in and clash, then RAID! slams down. */
export function RaidIntro({ mine, theirs, onDone }: { mine: string; theirs: string; onDone: () => void }) {
  const back = sceneArt('raid-arena').wide ?? sceneArt('raid').wide;
  const [ready, setReady] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 1700);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => {
    if (ready) button.current?.focus();
  }, [ready]);
  const flag = (name: string, side: 'left' | 'right') => (
    <div className={`cq-rintro__flag cq-rintro__flag--${side}`}>
      {bannerArt(name) ? <img src={bannerArt(name)} alt="" /> : <span className="cq-rintro__flagplain" />}
      <span className="cq-rintro__clan">{name}</span>
    </div>
  );
  return (
    <div
      className={`cq-rintro ${ready ? 'is-ready' : ''}`} role="dialog" aria-modal="true" aria-label={`Raid: the ${mine} clan against the ${theirs} clan`}
      style={back ? ({ '--cq-rintro-back': `url(${back})` } as React.CSSProperties) : undefined}
      onClick={() => (ready ? onDone() : setReady(true))}
    >
      <Embers />
      <div className="cq-rintro__clash">
        {flag(mine, 'left')}
        <span className="cq-rintro__flash" aria-hidden="true" />
        <span className="cq-rintro__swords" aria-hidden="true">⚔️</span>
        {flag(theirs, 'right')}
      </div>
      <h2 className="cq-rintro__title">Raid!</h2>
      <p className="cq-rintro__line">Their heroes stand ready in the village square.</p>
      <button ref={button} type="button" className="cq-btn cq-btn--hot cq-rintro__go" onClick={(e) => { e.stopPropagation(); onDone(); }}>Charge!</button>
    </div>
  );
}

/** Banners tumbling down over the results after a raid (your own clan's banner, one for each Banner won and a few more). */
export function BannerRain({ clan, count }: { clan: string; count: number }) {
  const art = bannerArt(clan);
  const n = Math.min(14, 4 + count * 2);
  return (
    <div className="cq-bannerrain" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} style={{ '--x': `${(i * 53 + 7) % 96}%`, '--d': `${(i * 0.23) % 1.6}s`, '--r': `${((i * 47) % 60) - 30}deg` } as React.CSSProperties}>
          {art ? <img src={art} alt="" /> : '🚩'}
        </span>
      ))}
    </div>
  );
}
