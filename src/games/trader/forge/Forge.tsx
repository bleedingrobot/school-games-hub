/**
 * The Star Forge screen (docs/TRADER-SYSTEM-PLAN.md, section 2): the pupil's solar system in live 3D, a row of slot cards, and a
 * step-by-step picker. Pieces show once the pupil can afford them; planning is free (edits change a draft at once and are saved quietly); building a piece costs credits and
 * always shows the price first. All the rules and prices are the shared ones in `shared/trader/system.ts`.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  EFFECTS, LIFE, MAX_PLANETS, PLANETS, RINGS, SUNS, designProblem, forgeCost, inZone, pieceName, planetPrice, type PlanetPick, type SystemDesign,
} from '../../../../shared/trader/system';
import { AskBolt, BoltFace } from '../coach/CoachBar';
import type { HelpLevel } from '../coach/level';
import { COACH_NAME } from '../text';
import { FullscreenView } from './Fullscreen';
import { drawGalleryPicture, pictureDue, rememberPicture } from './galleryPicture';
import { LIFE_LOOK, PLANET_LOOK, SUN_LOOK } from './looks';
import { addPlanet, buildOptions, buildWhatICan, cr, movePlanet, removePlanet, zoneTip, type BuildOption } from './parts';
import { Picker, STEPS, type Sel } from './Picker';
import { ViewerBox } from './ViewerBox';
import { PICTURE_GAP_MINUTES } from '../../../../shared/trader/gallery';
import type { GraphicsLevel } from './viewer/types';

interface Confirm {
  title: string;
  verb: string;
  target: SystemDesign;
  /** What to say when it worked. */
  cheer: string;
}

export function Forge({ saved, draft, credits, ownsMoon, busy, lessMotion, level, typing = true, onDraft, onPlan, onApply, onPicture }: {
  /** The class lets pupils type names (the teacher's switch). */
  typing?: boolean;
  /** What the game has saved, and the pupil's working copy. */
  saved: SystemDesign;
  draft: SystemDesign;
  credits: number;
  ownsMoon: boolean;
  busy: boolean;
  lessMotion: boolean;
  level: HelpLevel;
  onDraft: (d: SystemDesign) => void;
  /** Save a free (planned-only) change quietly. */
  onPlan: (d: SystemDesign) => void;
  /** Pay for a change now. Resolves to null when it worked, or the reason it didn't. */
  onApply: (target: SystemDesign) => Promise<string | null>;
  /** Save the class gallery's picture of the system (base64 .webp). True if it was saved. */
  onPicture?: (webp: string) => Promise<boolean>;
}) {
  const [sel, setSel] = useState<Sel | null>(null);
  const [step, setStep] = useState('kind');
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [note, setNote] = useState('');
  const [cheer, setCheer] = useState<{ text: string; n: number } | null>(null);
  const [full, setFull] = useState<HTMLElement | null>(null);
  const [working, setWorking] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const [graphics, setGraphics] = useState<GraphicsLevel | null>(null);
  useGalleryPicture(saved, graphics, onPicture);
  const confirmHead = useRef<HTMLHeadingElement>(null);

  const pending = useMemo(() => forgeCost(saved, draft, ownsMoon), [saved, draft, ownsMoon]);
  const options = useMemo(() => buildOptions(draft, ownsMoon), [draft, ownsMoon]);
  const problem = useMemo(() => designProblem(draft), [draft]);
  const sunKind = draft.sun?.kind;

  // Planning is free: a change with nothing to pay for is saved quietly after a short pause (and when leaving the Forge).
  const planned = useRef<SystemDesign | null>(null);
  const failed = useRef('');
  const savedKey = JSON.stringify(saved);
  const draftKey = JSON.stringify(draft);
  useEffect(() => {
    planned.current = null;
    if (savedKey === draftKey || problem || pending.lines.length || failed.current === draftKey) return;
    planned.current = draft;
    const timer = window.setTimeout(() => {
      failed.current = draftKey;
      planned.current = null;
      onPlan(draft);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [savedKey, draftKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const latestPlan = useRef(onPlan);
  latestPlan.current = onPlan;
  useEffect(() => () => {
    if (planned.current) latestPlan.current(planned.current);
  }, []);

  useEffect(() => {
    if (confirm) confirmHead.current?.focus();
  }, [confirm]);

  /** A change to the draft (checked with the shared rules first, and said kindly if it can't be). */
  function edit(next: SystemDesign) {
    const why = designProblem(next);
    if (why) return setNote(why);
    setNote('');
    onDraft(next);
  }

  function choose(next: Sel) {
    setSel(next);
    setStep(STEPS[next.k][0][0]);
    setConfirm(null);
  }

  function askBuild(o: BuildOption) {
    setConfirm({ title: `Build ${o.piece.label}`, verb: 'Build it', target: o.target, cheer: `${o.piece.label} is built!` });
  }
  function askAll() {
    const r = buildWhatICan(draft, credits, ownsMoon);
    if (!r.count) return setNote('Nothing you planned can be built with your credits yet. Trade to earn more!');
    setNote('');
    setConfirm({ title: r.count === 1 ? 'Build the cheapest piece you can afford' : `Build ${r.count} pieces`, verb: 'Build them', target: r.target, cheer: r.count === 1 ? 'Built!' : `${r.count} pieces built!` });
  }
  function askRemove(id: number) {
    const next = id < 0 ? { ...draft, sun: null } : removePlanet(draft, id);
    const why = designProblem(next);
    if (why) return setNote(why);
    const cost = forgeCost(draft, next, ownsMoon);
    if (!cost.lines.length) {
      onDraft(next);
      setSel(null);
      return;
    }
    setConfirm({ title: id < 0 ? 'Take down your sun?' : `Take down ${pieceName(draft.planets.find((p) => p.id === id) ?? { name: [0, 0] })}?`, verb: 'Yes, take it down', target: next, cheer: 'Taken down. Some credits came back.' });
  }
  async function go(c: Confirm) {
    setWorking(true);
    const bad = await onApply(c.target);
    setWorking(false);
    if (bad) return setNote(bad);
    setNote('');
    setConfirm(null);
    setCheer({ text: c.cheer, n: (cheer?.n ?? 0) + 1 });
    if (sel?.k === 'planet' && !c.target.planets.some((p) => p.id === sel.id)) setSel(null);
  }

  const selected = (k: string, id?: number): boolean => !!sel && sel.k === k && (id === undefined || (sel.k === 'planet' && sel.id === id));
  const planetAt = sel?.k === 'planet' ? draft.planets.find((p) => p.id === sel.id) : undefined;

  return (
    <section className="st-panel stf" aria-labelledby="stf-h" data-coach="forge-view">
      <div className="stf-head">
        <h2 id="stf-h" className="st-h">🌟 Star Forge: the {pieceName(draft)} System</h2>
        <button ref={opener} type="button" className="st-btn" onClick={(e) => setFull(e.currentTarget.closest<HTMLElement>('.st-root') ?? document.body)}>🔭 View in full screen</button>
      </div>
      <p className="st-sub">Design your own solar system. Locked pieces open up as you earn credits, and planning is free. Build each piece when you are ready. Plans look like holograms.</p>

      <div className="stf-grid">
        <div className="stf-left">
          {!full && <ViewerBox design={draft} showPlans labels reducedMotion={lessMotion} onLevel={setGraphics} onReady={(v) => setGraphics(v?.level ?? null)} onPick={(id) => id !== null && choose({ k: 'planet', id })} />}
          {full && <div className="stf-viewer stf-viewer--away"><p className="st-soft">Your system is open in full screen.</p></div>}
        </div>

        <div className="stf-right">
          <div className="stf-slots" data-coach="forge-slots" role="group" aria-label="Pieces of your system, from the sun outwards">
            <SlotCard on={selected('sun')} onClick={() => choose({ k: 'sun' })} emoji={draft.sun ? SUN_LOOK[draft.sun.kind].emoji : '☀️'} colour={draft.sun ? SUN_LOOK[draft.sun.kind].colour : undefined}
              title="Sun" line={draft.sun ? SUNS[draft.sun.kind].name : 'Choose a sun'} state={!draft.sun ? 'empty' : draft.sun.built ? 'built' : 'plan'} price={draft.sun ? SUNS[draft.sun.kind].price : 0} />
            {draft.planets.map((p, i) => (
              <SlotCard key={p.id} on={selected('planet', p.id)} onClick={() => choose({ k: 'planet', id: p.id })} zone={inZone(sunKind, i)} emoji={PLANET_LOOK[p.kind].emoji} colour={PLANET_LOOK[p.kind].colour}
                title={`Planet ${i + 1}`} line={pieceName(p)} state={p.built ? 'built' : 'plan'} price={planetPrice(p)} more={unbuiltParts(p)} life={p.life ? LIFE_LOOK[p.life.kind].emoji : undefined} />
            ))}
            {draft.planets.length < MAX_PLANETS && (
              <SlotCard add zone={inZone(sunKind, draft.planets.length)} onClick={() => {
                const next = addPlanet(draft);
                edit(next);
                choose({ k: 'planet', id: next.planets[next.planets.length - 1].id });
              }} emoji="＋" title={`Planet ${draft.planets.length + 1}`} line="+ planet" state="empty" />
            )}
            <SlotCard on={selected('extras')} onClick={() => choose({ k: 'extras' })} emoji="🌌" title="Extras" line={extrasLine(draft)} state={extrasState(draft)} />
          </div>
          <p className="stf-zone"><span className="stf-zone__band" aria-hidden="true" /> <span>The green band is the &quot;just right&quot; zone, where water stays liquid.</span></p>
          {level !== 'off' && (
            <AskBolt ask={level === 'some'} label={`Ask ${COACH_NAME} about the zone`}>
              <p className="stf-bolt"><BoltFace size={24} /> <span><strong>{COACH_NAME}:</strong> {zoneTip(draft)}</span></p>
            </AskBolt>
          )}

          <div className="stf-all">
            <button type="button" className="st-btn" disabled={busy || working} onClick={askAll}>🛠️ Build everything I can afford</button>
            <span className="st-soft">You have {cr(credits)}.</span>
          </div>
          {cheer && <p key={cheer.n} className="stf-cheer" role="status">🎉 {cheer.text}</p>}
          {pending.lines.length > 0 && !confirm && (
            <div className="stf-pending" role="group" aria-label="Changes to pay for">
              <strong>Not saved yet: {pending.lines.length === 1 ? '1 change' : `${pending.lines.length} changes`} to pay for.</strong>
              <div className="st-actions">
                <button type="button" className="st-btn st-btn--primary" disabled={busy || working} onClick={() => setConfirm({ title: 'Save these changes', verb: 'Pay and save', target: draft, cheer: 'Saved!' })}>See the cost…</button>
                <button type="button" className="st-btn" onClick={() => { onDraft(saved); setNote(''); }}>Undo these changes</button>
              </div>
            </div>
          )}
          {confirm && <ConfirmCard confirm={confirm} saved={saved} credits={credits} ownsMoon={ownsMoon} busy={busy || working} head={confirmHead} onGo={() => void go(confirm)} onCancel={() => { setConfirm(null); setNote(''); }} />}
          {note && <p className="st-warn" role="status">{note}</p>}
          {!sel && !confirm && <div className="st-card stf-hint"><p>👆 Tap the <strong>Sun</strong> to choose your star, or <strong>+ planet</strong> to add a world. Planning is free!</p></div>}
          {sel && <Picker sel={sel} design={draft} step={step} onStep={setStep} onEdit={edit} onBuild={askBuild} onRemovePlanet={askRemove} onMove={(id, by) => edit(movePlanet(draft, id, by))} options={options} credits={credits} busy={busy || working} typing={typing} />}
          {sel && <Facts sel={sel} design={draft} planet={planetAt} />}
        </div>
      </div>
      <p className="st-sr" role="status">{cheer?.text ?? ''}</p>
      {full && <FullscreenView design={draft} lessMotion={lessMotion} container={full} onClose={() => { setFull(null); window.setTimeout(() => opener.current?.focus(), 0); }} />}
    </section>
  );
}

/**
 * Keeps the class gallery's picture of the saved system up to date: drawn after a build (and when the Forge opens) once
 * something new is built, at most once every few minutes, and never on Simple graphics or with no 3D viewer.
 */
function useGalleryPicture(saved: SystemDesign, graphics: GraphicsLevel | null, onPicture?: (webp: string) => Promise<boolean>) {
  const [tick, setTick] = useState(0);
  const drawing = useRef(false);
  const latest = useRef(onPicture);
  latest.current = onPicture;
  const key = JSON.stringify(saved);
  useEffect(() => {
    if (!latest.current || drawing.current || !saved.sun?.built || !graphics || graphics === 'simple') return;
    if (!pictureDue(saved, graphics)) {
      // Something new but too soon: look again when the wait is over.
      const timer = window.setTimeout(() => setTick((t) => t + 1), PICTURE_GAP_MINUTES * 60_000 / 4);
      return () => window.clearTimeout(timer);
    }
    drawing.current = true;
    const design = saved;
    void (async () => {
      try {
        const webp = await drawGalleryPicture(design, graphics);
        if (webp && latest.current && (await latest.current(webp))) rememberPicture(design);
      } finally {
        drawing.current = false;
      }
    })();
  }, [key, graphics, tick]); // eslint-disable-line react-hooks/exhaustive-deps
}

const unbuiltParts = (p: PlanetPick): number =>
  [p.ring, p.life, ...p.moons, ...p.effects, ...p.tech].filter((x) => x && !x.built).length;

function extrasLine(d: SystemDesign): string {
  const bits = [d.belt && 'Belt', d.comets && 'Comets', d.tech.length ? `${d.tech.length} tech` : ''].filter(Boolean);
  return bits.length ? bits.join(', ') : 'Belt, comets, sky';
}
function extrasState(d: SystemDesign): 'empty' | 'plan' | 'built' {
  const parts = [d.belt, d.comets, ...d.tech].filter(Boolean) as { built?: boolean }[];
  if (!parts.length) return 'empty';
  return parts.every((x) => x.built) ? 'built' : 'plan';
}

function SlotCard({ title, line, emoji, colour, state, price, on, zone, add, more, life, onClick }: {
  title: string;
  line: string;
  emoji: string;
  colour?: string;
  state: 'empty' | 'plan' | 'built';
  price?: number;
  on?: boolean;
  zone?: boolean;
  add?: boolean;
  more?: number;
  life?: string;
  onClick: () => void;
}) {
  const say = state === 'empty' ? 'empty' : state === 'plan' ? `planned, ${cr(price ?? 0)}` : 'built';
  return (
    <button type="button" className={`stf-slot stf-slot--${state} ${on ? 'is-on' : ''} ${zone ? 'is-zone' : ''} ${add ? 'is-add' : ''}`} aria-pressed={on} aria-label={`${title}: ${line}, ${say}${zone ? ', in the just right zone' : ''}${more ? `, ${more} planned pieces not built yet` : ''}`} onClick={onClick}>
      <span className="stf-slot__title">{title}</span>
      <span className="stf-slot__pic" style={colour ? { background: colour } : undefined} aria-hidden="true">{emoji}{life && <i className="stf-slot__life">{life}</i>}</span>
      <span className="stf-slot__line">{line}</span>
      <span className={`stf-slot__badge stf-slot__badge--${state}`} aria-hidden="true">
        {state === 'built' ? '✓ Built' : state === 'plan' ? `👻 Plan · ${cr(price ?? 0)}` : add ? 'Add' : 'Empty'}
        {more ? ` +${more}` : ''}
      </span>
    </button>
  );
}

function ConfirmCard({ confirm, saved, credits, ownsMoon, busy, head, onGo, onCancel }: {
  confirm: Confirm;
  saved: SystemDesign;
  credits: number;
  ownsMoon: boolean;
  busy: boolean;
  head: React.RefObject<HTMLHeadingElement | null>;
  onGo: () => void;
  onCancel: () => void;
}) {
  const cost = forgeCost(saved, confirm.target, ownsMoon);
  const short = cost.total - credits;
  const problem = designProblem(confirm.target);
  return (
    <div className="st-card stf-confirm" role="group" aria-labelledby="stf-confirm-h">
      <h3 id="stf-confirm-h" ref={head} tabIndex={-1} className="stf-confirm__h">{confirm.title}</h3>
      {cost.lines.length ? (
        <ul className="stf-lines">
          {cost.lines.map((l, i) => (
            <li key={i}><span>{l.what}</span><strong className={l.credits < 0 ? 'st-good-note' : ''}>{l.credits < 0 ? `+${cr(-l.credits)} back` : cr(l.credits)}</strong></li>
          ))}
        </ul>
      ) : <p className="st-soft">Nothing to pay.</p>}
      <p className="stf-confirm__total"><strong>{cost.total >= 0 ? `Total: ${cr(cost.total)}` : `You get ${cr(-cost.total)} back`}</strong></p>
      {short > 0 && <p className="st-warn">You need {cr(short)} more.</p>}
      {problem && <p className="st-warn">{problem}</p>}
      <div className="st-actions">
        <button type="button" className="st-btn st-btn--primary st-btn--big" disabled={busy || short > 0 || !!problem} onClick={onGo}>{confirm.verb}</button>
        <button type="button" className="st-btn st-btn--big" onClick={onCancel}>Not now</button>
      </div>
    </div>
  );
}

/** Facts for what is picked: the sun, the planet type, and its life. Silly pieces say "Made up!". */
function Facts({ sel, design, planet }: { sel: Sel; design: SystemDesign; planet?: PlanetPick }) {
  const facts: { title: string; text: string; silly?: boolean }[] = [];
  const clean = (t: string) => t.replace(/^Made up! /, '');
  if (sel.k === 'sun' && design.sun) facts.push({ title: SUNS[design.sun.kind].name, text: SUNS[design.sun.kind].fact });
  if (planet) {
    const info = PLANETS[planet.kind];
    facts.push({ title: info.name, text: clean(info.fact), silly: info.silly });
    if (planet.life) facts.push({ title: LIFE[planet.life.kind].name, text: clean(LIFE[planet.life.kind].fact), silly: planet.life.kind === 'crystalfolk' });
    if (planet.ring && RINGS[planet.ring.kind].silly) facts.push({ title: RINGS[planet.ring.kind].name, text: 'Real rings are dust and ice. Rainbow rings are just for fun.', silly: true });
    const fx = planet.effects.find((e) => EFFECTS[e.kind].silly);
    if (fx) facts.push({ title: EFFECTS[fx.kind].name, text: 'Real planets do not have floating islands. They are just for fun.', silly: true });
  }
  if (!facts.length) return null;
  return (
    <aside className="st-card stf-facts" aria-label="Facts">
      {facts.map((f) => (
        <p key={f.title}><strong>{f.title}{f.silly && <em className="stf-madeup"> Made up!</em>}</strong><br />{f.text}</p>
      ))}
    </aside>
  );
}
