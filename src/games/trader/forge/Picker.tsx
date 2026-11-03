/** The Forge's step-by-step picker (docs/TRADER-SYSTEM-PLAN.md, section 3): big picture buttons, one short step at a time. */
import { useState, type ReactNode } from 'react';
import { checkTypedName, TYPED_NAME_MAX } from '../../../../shared/trader/names';
import {
  BELTS, CLOUDS, COMET_PRICE, EFFECTS, LIFE, MAX_COMETS, MAX_EFFECTS, MAX_MOONS, MOON_LOOKS, MOON_PRICE_PIECE, NAME_FIRST, NAME_SECOND, PLANETS, RINGS, SIZES, SKY_COLOURS,
  SUNS, SURFACES, SYSTEM_TECH, TECH, TINTS, BACKGROUNDS, lifeProblem, pieceName, planetPrice,
  type BeltKind, type EffectKind, type LifeKind, type Named, type PlanetKind, type PlanetPick, type RingKind, type SunKind, type SystemDesign, type SystemTechKind, type TechKind,
} from '../../../../shared/trader/system';
import { buttonArt } from './buttonArt';
import {
  BACKGROUND_COLOURS, BACKGROUND_NAMES, BELT_COLOUR, CLOUD_NAMES, EFFECT_EMOJI, LIFE_LOOK, MOON_NAMES, PLANET_LOOK, RING_EMOJI, SKY_SWATCHES, SUN_LOOK, SURFACE_NAMES,
  SYSTEM_TECH_LOOK, TECH_LOOK, TINT_SWATCHES,
} from './looks';
import { cr, effectWhy, fitPlanet, mapPlanet, type BuildOption, type Where } from './parts';

export type Sel = { k: 'sun' } | { k: 'planet'; id: number } | { k: 'extras' };

export const STEPS: Record<Sel['k'], [string, string][]> = {
  sun: [['kind', 'Sun'], ['name', 'Name'], ['build', 'Build']],
  planet: [['type', 'Type'], ['size', 'Size'], ['looks', 'Looks'], ['effects', 'Effects'], ['life', 'Life'], ['tech', 'Technology'], ['name', 'Name'], ['build', 'Build']],
  extras: [['belt', 'Belt'], ['comets', 'Comets'], ['sky', 'Background'], ['tech', 'System tech'], ['name', 'System name'], ['build', 'Build']],
};

// ——— Building blocks ———

/** A big picture button. The picture is the painted one when it exists, else an emoji on a colour. */
export function Choice({ group, k, emoji, colour, label, sub, tag, on, why, disabled, onClick }: {
  group: string;
  k: string;
  emoji?: string;
  colour?: string;
  label: string;
  sub?: string;
  tag?: string;
  on?: boolean;
  /** Why it can't be picked (shown on the button). */
  why?: string | null;
  disabled?: boolean;
  onClick: () => void;
}) {
  const art = buttonArt(group, k);
  return (
    <button type="button" className={`stf-choice ${on ? 'is-on' : ''} ${why ? 'is-grey' : ''}`} aria-pressed={on} disabled={disabled || !!why} onClick={onClick} data-group={group} data-key={k}>
      <span className="stf-choice__pic" style={colour ? { background: colour } : undefined} aria-hidden="true">
        {art ? <img src={art} alt="" width={48} height={48} loading="lazy" decoding="async" /> : emoji}
      </span>
      <span className="stf-choice__label">{label}</span>
      {tag && <em className="stf-choice__tag">{tag}</em>}
      {why ? <span className="stf-choice__why">{why}</span> : sub && <span className="stf-choice__sub">{sub}</span>}
    </button>
  );
}

export function Swatches({ label, colours, value, onPick }: { label: string; colours: readonly (readonly [string, string])[]; value: number; onPick: (i: number) => void }) {
  return (
    <div className="stf-swatches" role="group" aria-label={label}>
      {colours.map(([name, colour], i) => (
        <button key={name} type="button" className={`stf-swatch ${value === i ? 'is-on' : ''}`} style={{ background: colour }} aria-pressed={value === i} aria-label={name} title={name} onClick={() => onPick(i)} />
      ))}
    </div>
  );
}

const Group = ({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) => (
  <div className="stf-group">
    <h4 className="stf-group__h">{title}{hint && <span className="st-soft"> {hint}</span>}</h4>
    {children}
  </div>
);

/** Put a new name on a piece: a picked word-list name drops any typed label; a typed label keeps the word-list name underneath. */
export function withNames<T extends Named>(x: T, n: Named): T {
  const { label: _old, ...rest } = x;
  return n.label ? { ...rest, name: n.name, label: n.label } as T : { ...rest, name: n.name } as T;
}

/**
 * Naming a piece: a box to type a name (checked as they type, kindly) when the class allows it, and two scrolling word lists
 * ("or pick one": "Zephyr" + "Prime"). Picking from the lists clears a typed name. Key it by the piece so the box starts fresh.
 */
export function NamePicker({ value, onChange, what, typing }: { value: Named; onChange: (n: Named) => void; what: string; typing: boolean }) {
  const [text, setText] = useState(value.label ?? '');
  const checked = text.trim() === '' ? null : checkTypedName(text);
  const list = (words: readonly string[], idx: 0 | 1, label: string) => (
    <div className="stf-words" role="group" aria-label={label}>
      {words.map((w, i) => (
        <button key={w} type="button" className={`stf-word ${!value.label && value.name[idx] === i ? 'is-on' : ''}`} aria-pressed={!value.label && value.name[idx] === i}
          onClick={() => { setText(''); onChange({ name: idx === 0 ? [i, value.name[1]] : [value.name[0], i] }); }}>{w}</button>
      ))}
    </div>
  );
  function type(raw: string) {
    setText(raw);
    const r = checkTypedName(raw);
    if (r.ok) onChange({ name: value.name, label: r.name });
  }
  return (
    <div className="stf-name">
      <p className="stf-name__now" aria-live="polite">{what}: <strong>{pieceName(value)}</strong></p>
      {typing && (
        <div className="stf-name__type">
          <label className="stf-group__h" htmlFor="stf-typed">Type a name</label>
          <input id="stf-typed" className="st-input" type="text" value={text} maxLength={TYPED_NAME_MAX} autoComplete="off" spellCheck={false} onChange={(e) => type(e.target.value)} />
          {checked && !checked.ok && <p className="st-soft" role="status">{checked.say}</p>}
        </div>
      )}
      <h4 className="stf-group__h">{typing ? 'Or pick one' : 'Pick a name'}</h4>
      <div className="stf-name__lists">
        <div><h4 className="stf-group__h">First word</h4>{list(NAME_FIRST, 0, 'First word of the name')}</div>
        <div><h4 className="stf-group__h">Second word</h4>{list(NAME_SECOND, 1, 'Second word of the name')}</div>
      </div>
    </div>
  );
}

// ——— The picker ———

export function Picker({ sel, design, step, onStep, onEdit, onBuild, onRemovePlanet, onMove, options, credits, busy, typing }: {
  sel: Sel;
  /** The class lets pupils type names. */
  typing: boolean;
  design: SystemDesign;
  step: string;
  onStep: (s: string) => void;
  /** A new draft (planning is free). */
  onEdit: (next: SystemDesign, why?: string) => void;
  /** Ask to build one piece (shows the cost first). */
  onBuild: (o: BuildOption) => void;
  onRemovePlanet: (id: number) => void;
  onMove: (id: number, by: -1 | 1) => void;
  options: BuildOption[];
  credits: number;
  busy: boolean;
}) {
  const steps = STEPS[sel.k];
  const at = Math.max(0, steps.findIndex(([id]) => id === step));
  const planet = sel.k === 'planet' ? design.planets.find((p) => p.id === sel.id) : undefined;
  const slot = planet ? design.planets.indexOf(planet) : -1;
  const setP = (f: (p: PlanetPick) => PlanetPick) => planet && onEdit(mapPlanet(design, planet.id, f));
  const title = sel.k === 'sun' ? 'Your sun' : sel.k === 'extras' ? 'Extras for the whole system' : planet ? `${pieceName(planet)}, planet ${slot + 1}` : 'Planet';
  if (sel.k === 'planet' && !planet) return null;
  const id = step === steps[at][0] ? step : steps[0][0];

  return (
    <section className="stf-picker" aria-label={`Design: ${title}`}>
      <div className="stf-picker__top">
        <h3 className="stf-picker__h" id="stf-picker-h">{title}</h3>
        {planet && (
          <div className="stf-picker__tools">
            <button type="button" className="st-btn st-btn--small" disabled={slot < 1} onClick={() => onMove(planet.id, -1)} aria-label={`Move ${pieceName(planet)} closer to the sun`}>← Earlier</button>
            <button type="button" className="st-btn st-btn--small" disabled={slot >= design.planets.length - 1} onClick={() => onMove(planet.id, 1)} aria-label={`Move ${pieceName(planet)} further from the sun`}>Later →</button>
            <button type="button" className="st-btn st-btn--small" onClick={() => onRemovePlanet(planet.id)}>Remove</button>
          </div>
        )}
        {sel.k === 'sun' && design.sun && <button type="button" className="st-btn st-btn--small" onClick={() => onRemovePlanet(-1)}>Remove sun</button>}
      </div>
      <ol className="stf-steps" aria-label="Steps">
        {steps.map(([sid, name], i) => (
          <li key={sid}>
            <button type="button" className={`stf-step ${sid === id ? 'is-on' : ''}`} aria-current={sid === id ? 'step' : undefined} onClick={() => onStep(sid)}>
              <span className="stf-step__n" aria-hidden="true">{i + 1}</span> {name}
            </button>
          </li>
        ))}
      </ol>

      <div className="stf-picker__body">
        {sel.k === 'sun' && id === 'kind' && (
          <div className="stf-choices">
            {(Object.keys(SUNS) as SunKind[]).map((kind) => (
              <Choice key={kind} group="sun" k={kind} emoji={SUN_LOOK[kind].emoji} colour={SUN_LOOK[kind].colour} label={SUNS[kind].name} sub={cr(SUNS[kind].price)} on={design.sun?.kind === kind}
                onClick={() => onEdit({ ...design, sun: { ...(design.sun ?? { name: [0, 0] as Named['name'] }), kind } })} />
            ))}
          </div>
        )}
        {sel.k === 'sun' && id === 'name' && (design.sun
          ? <NamePicker key="sun" what="Your sun" typing={typing} value={design.sun} onChange={(n) => onEdit({ ...design, sun: withNames(design.sun!, n) })} />
          : <p className="st-soft">Pick your sun first.</p>)}

        {planet && id === 'type' && (
          <div className="stf-choices">
            {(Object.keys(PLANETS) as PlanetKind[]).map((kind) => (
              <Choice key={kind} group="planet" k={kind} emoji={PLANET_LOOK[kind].emoji} colour={PLANET_LOOK[kind].colour} label={PLANETS[kind].name} tag={PLANETS[kind].silly ? 'Made up!' : undefined}
                sub={cr(planetPrice({ kind, size: planet.size }))} on={planet.kind === kind} onClick={() => setP((p) => fitPlanet({ ...p, kind }))} />
            ))}
          </div>
        )}
        {planet && id === 'size' && (
          <div className="stf-choices">
            {SIZES.map((name, size) => (
              <Choice key={name} group="size" k={String(size)} emoji="⚪" colour={PLANET_LOOK[planet.kind].colour} label={name} sub={cr(planetPrice({ kind: planet.kind, size }))} on={planet.size === size} onClick={() => setP((p) => ({ ...p, size }))} />
            ))}
          </div>
        )}
        {planet && id === 'looks' && <Looks p={planet} setP={setP} />}
        {planet && id === 'effects' && (
          <>
            <p className="st-soft">Pick up to {MAX_EFFECTS}.</p>
            <div className="stf-choices">
              {(Object.keys(EFFECTS) as EffectKind[]).map((kind) => {
                const on = planet.effects.some((e) => e.kind === kind);
                const why = on ? null : effectWhy(planet, slot, kind) ?? (planet.effects.length >= MAX_EFFECTS ? `Up to ${MAX_EFFECTS}` : null);
                return (
                  <Choice key={kind} group="effect" k={kind} emoji={EFFECT_EMOJI[kind]} colour="#2a3a70" label={EFFECTS[kind].name} tag={EFFECTS[kind].silly ? 'Made up!' : undefined} sub={cr(EFFECTS[kind].price)} on={on} why={why}
                    onClick={() => setP((p) => ({ ...p, effects: on ? p.effects.filter((e) => e.kind !== kind) : [...p.effects, { kind }] }))} />
                );
              })}
            </div>
          </>
        )}
        {planet && id === 'life' && <LifeStep planet={planet} slot={slot} design={design} setP={setP} />}
        {planet && id === 'tech' && (
          <>
            {[1, 2, 3].map((tier) => (
              <Group key={tier} title={`Tier ${tier}`} hint={tier === 3 ? '(the showpieces)' : undefined}>
                <div className="stf-choices">
                  {(Object.keys(TECH) as TechKind[]).filter((k) => TECH[k].tier === tier).map((kind) => {
                    const on = planet.tech.some((t) => t.kind === kind);
                    const need = TECH[kind].needs;
                    const why = on ? null : need === 'solid' && !PLANETS[planet.kind].solid ? 'Needs solid ground' : need === 'moon' && !planet.moons.length ? 'Needs a moon first' : null;
                    return (
                      <Choice key={kind} group="tech" k={kind} emoji={TECH_LOOK[kind].emoji} colour={TECH_LOOK[kind].colour} label={TECH[kind].name} sub={cr(TECH[kind].price)} on={on} why={why}
                        onClick={() => setP((p) => ({ ...p, tech: on ? p.tech.filter((t) => t.kind !== kind) : [...p.tech, { kind }] }))} />
                    );
                  })}
                </div>
              </Group>
            ))}
          </>
        )}
        {planet && id === 'name' && <NamePicker key={planet.id} what="This planet" typing={typing} value={planet} onChange={(n) => setP((p) => withNames(p, n))} />}

        {sel.k === 'extras' && <Extras id={id} design={design} onEdit={onEdit} typing={typing} />}

        {id === 'build' && <BuildStep options={options.filter((o) => sameWhere(o.piece.where, sel))} credits={credits} busy={busy} onBuild={onBuild} />}
      </div>

      <div className="stf-picker__nav">
        <button type="button" className="st-btn" disabled={at < 1} onClick={() => onStep(steps[at - 1][0])}>← Back</button>
        <button type="button" className="st-btn st-btn--primary" disabled={at >= steps.length - 1} onClick={() => onStep(steps[at + 1][0])}>Next →</button>
      </div>
    </section>
  );
}

const sameWhere = (w: Where, sel: Sel): boolean => (sel.k === 'sun' ? w === 'sun' : sel.k === 'extras' ? w === 'extras' : w === sel.id);

function Looks({ p, setP }: { p: PlanetPick; setP: (f: (p: PlanetPick) => PlanetPick) => void }) {
  const wonder = !!PLANETS[p.kind].wonder;
  return (
    <>
      <Group title="Surface">
        <div className="stf-choices stf-choices--small">
          {Array.from({ length: SURFACES }, (_, i) => (
            <Choice key={i} group="surface" k={`${p.kind}-${i}`} emoji="🌍" colour={PLANET_LOOK[p.kind].colour} label={SURFACE_NAMES[i]} on={p.surface === i} onClick={() => setP((q) => ({ ...q, surface: i }))} />
          ))}
        </div>
      </Group>
      <Group title="Colour">
        <Swatches label="Colour of the surface" colours={TINT_SWATCHES.slice(0, TINTS)} value={p.tint} onPick={(tint) => setP((q) => ({ ...q, tint }))} />
      </Group>
      <Group title="Clouds">
        <div className="stf-choices stf-choices--small">
          {CLOUDS.map((c) => <Choice key={c} group="clouds" k={c} emoji={c === 'none' ? '🚫' : '☁️'} colour="#3a4a80" label={CLOUD_NAMES[c]} on={p.clouds === c} onClick={() => setP((q) => ({ ...q, clouds: c }))} />)}
        </div>
      </Group>
      <Group title="Sky colour" hint="(the glow round the edge)">
        <Swatches label="Colour of the sky" colours={SKY_SWATCHES.slice(0, SKY_COLOURS)} value={p.sky} onPick={(sky) => setP((q) => ({ ...q, sky }))} />
      </Group>
      <Group title="Rings">
        {wonder ? <p className="st-soft">A ring world has no rings or moons of its own.</p> : (
          <>
            <div className="stf-choices stf-choices--small">
              <Choice group="ring" k="none" emoji="🚫" colour="#3a4a80" label="No rings" on={!p.ring} onClick={() => setP((q) => ({ ...q, ring: null }))} />
              {(Object.keys(RINGS) as RingKind[]).map((kind) => (
                <Choice key={kind} group="ring" k={kind} emoji={RING_EMOJI[kind]} colour="#5a4a80" label={RINGS[kind].name} tag={RINGS[kind].silly ? 'Made up!' : undefined} sub={cr(RINGS[kind].price)} on={p.ring?.kind === kind}
                  onClick={() => setP((q) => ({ ...q, ring: { kind, tilt: q.ring?.tilt ?? 0 } }))} />
              ))}
            </div>
            {p.ring && (
              <div className="stf-tilt" role="group" aria-label="Tilt of the rings">
                <span className="st-soft">Tilt:</span>
                {['Flat', 'Slight', 'Medium', 'Steep', 'Very steep'].map((name, tilt) => (
                  <button key={name} type="button" className={`st-btn st-btn--small ${p.ring!.tilt === tilt ? 'st-btn--primary' : ''}`} aria-pressed={p.ring!.tilt === tilt} onClick={() => setP((q) => ({ ...q, ring: q.ring && { ...q.ring, tilt } }))}>{name}</button>
                ))}
              </div>
            )}
          </>
        )}
      </Group>
      {!wonder && (
        <Group title="Moons" hint={`(up to ${MAX_MOONS}, ${cr(MOON_PRICE_PIECE)} each)`}>
          {p.moons.map((m, n) => (
            <div key={m.id} className="stf-moon">
              <strong>{m.yours ? 'Your moon' : `Moon ${n + 1}`}</strong>
              <Swatches label={`Look of moon ${n + 1}`} colours={MOON_NAMES.slice(0, MOON_LOOKS).map((name, i) => [name, `hsl(${i * 40} ${i % 2 ? 15 : 35}% ${55 + (i % 3) * 8}%)`] as const)} value={m.look} onPick={(look) => setP((q) => ({ ...q, moons: q.moons.map((y) => (y.id === m.id ? { ...y, look } : y)) }))} />
              <button type="button" className="st-btn st-btn--small" onClick={() => setP((q) => ({ ...q, moons: q.moons.filter((y) => y.id !== m.id) }))} aria-label={`Remove moon ${n + 1}`}>Remove</button>
            </div>
          ))}
          <button type="button" className="st-btn" disabled={p.moons.length >= MAX_MOONS} onClick={() => setP((q) => {
            const used = new Set(q.moons.map((m) => m.id));
            let id = 0;
            while (used.has(id)) id++;
            return { ...q, moons: [...q.moons, { id, look: 0 }] };
          })}>+ Add a moon</button>
        </Group>
      )}
    </>
  );
}

function LifeStep({ planet, slot, design, setP }: { planet: PlanetPick; slot: number; design: SystemDesign; setP: (f: (p: PlanetPick) => PlanetPick) => void }) {
  const kinds = PLANETS[planet.kind].life;
  return (
    <>
      <p className="st-soft">A {PLANETS[planet.kind].name.toLowerCase()} can hold these kinds of life.</p>
      <div className="stf-choices">
        <Choice group="life" k="none" emoji="🚫" colour="#3a4a80" label="No life" on={!planet.life} onClick={() => setP((p) => ({ ...p, life: null }))} />
        {kinds.map((kind: LifeKind) => {
          const zone = lifeProblem({ ...design, planets: design.planets.map((p) => (p === design.planets[slot] ? { ...p, life: null } : p)) }, slot, kind);
          return (
            <Choice key={kind} group="life" k={kind} emoji={LIFE_LOOK[kind].emoji} colour={LIFE_LOOK[kind].colour} label={LIFE[kind].name} tag={kind === 'crystalfolk' ? 'Made up!' : undefined}
              sub={zone ? `${cr(LIFE[kind].price)} · needs domes first` : cr(LIFE[kind].price)} on={planet.life?.kind === kind}
              onClick={() => setP((p) => ({ ...p, life: { kind, creature: 0 } }))} />
          );
        })}
      </div>
      {planet.life && LIFE[planet.life.kind].creatures > 1 && (
        <Group title="Which creature?">
          <div className="stf-tilt" role="group" aria-label="Which creature">
            {Array.from({ length: LIFE[planet.life.kind].creatures }, (_, i) => (
              <button key={i} type="button" className={`st-btn st-btn--small ${planet.life!.creature === i ? 'st-btn--primary' : ''}`} aria-pressed={planet.life!.creature === i} onClick={() => setP((p) => ({ ...p, life: p.life && { ...p.life, creature: i } }))}>Creature {i + 1}</button>
            ))}
          </div>
        </Group>
      )}
      {planet.life && lifeProblem(design, slot, planet.life.kind) && <p className="st-warn" role="status">{lifeProblem(design, slot, planet.life.kind)} You can plan it now and build the domes first (in Technology).</p>}
    </>
  );
}

function Extras({ id, design, onEdit, typing }: { id: string; design: SystemDesign; onEdit: (d: SystemDesign) => void; typing: boolean }) {
  if (id === 'belt') {
    return (
      <>
        <div className="stf-choices">
          <Choice group="belt" k="none" emoji="🚫" colour="#3a4a80" label="No belt" on={!design.belt} onClick={() => onEdit({ ...design, belt: null })} />
          {(Object.keys(BELTS) as BeltKind[]).map((kind) => (
            <Choice key={kind} group="belt" k={kind} emoji="🪨" colour={BELT_COLOUR[kind]} label={BELTS[kind].name} sub={cr(BELTS[kind].price)} on={design.belt?.kind === kind} onClick={() => onEdit({ ...design, belt: { ...(design.belt ?? {}), kind } })} />
          ))}
        </div>
        {design.belt && (
          <Group title="Where does it sit?">
            <div className="stf-tilt" role="group" aria-label="Where the belt sits">
              {Array.from({ length: design.planets.length + 1 }, (_, i) => (
                <button key={i} type="button" className={`st-btn st-btn--small ${design.beltAfter === i ? 'st-btn--primary' : ''}`} aria-pressed={design.beltAfter === i} onClick={() => onEdit({ ...design, beltAfter: i })}>{i === 0 ? 'Next to the sun' : `After planet ${i}`}</button>
              ))}
            </div>
          </Group>
        )}
      </>
    );
  }
  if (id === 'comets') {
    return (
      <div className="stf-choices">
        {Array.from({ length: MAX_COMETS + 1 }, (_, n) => (
          <Choice key={n} group="comets" k={String(n)} emoji="☄️" colour="#4a5a90" label={n === 0 ? 'No comets' : n === 1 ? '1 comet' : `${n} comets`} sub={n ? cr(COMET_PRICE * n) : undefined} on={(design.comets?.count ?? 0) === n}
            onClick={() => onEdit({ ...design, comets: n ? { ...(design.comets ?? {}), count: n } : null })} />
        ))}
      </div>
    );
  }
  if (id === 'sky') {
    return (
      <div className="stf-choices">
        {Array.from({ length: BACKGROUNDS }, (_, i) => (
          <Choice key={i} group="sky" k={String(i)} emoji="🌌" colour={BACKGROUND_COLOURS[i]} label={BACKGROUND_NAMES[i]} on={design.background === i} onClick={() => onEdit({ ...design, background: i })} />
        ))}
      </div>
    );
  }
  if (id === 'tech') {
    return (
      <>
        {[1, 2, 3].map((tier) => (
          <Group key={tier} title={`Tier ${tier}`} hint={tier === 3 ? '(the showpieces)' : undefined}>
            <div className="stf-choices">
              {(Object.keys(SYSTEM_TECH) as SystemTechKind[]).filter((k) => SYSTEM_TECH[k].tier === tier).map((kind) => {
                const on = design.tech.some((t) => t.kind === kind);
                const need = SYSTEM_TECH[kind].needs;
                const why = on ? null : need === 'belt' && !design.belt ? 'Needs an asteroid belt' : need === 'twoPlanets' && design.planets.length < 2 ? 'Needs two planets' : null;
                return (
                  <Choice key={kind} group="systemtech" k={kind} emoji={SYSTEM_TECH_LOOK[kind].emoji} colour={SYSTEM_TECH_LOOK[kind].colour} label={SYSTEM_TECH[kind].name} sub={cr(SYSTEM_TECH[kind].price)} on={on} why={why}
                    onClick={() => onEdit({ ...design, tech: on ? design.tech.filter((t) => t.kind !== kind) : [...design.tech, { kind }] })} />
                );
              })}
            </div>
          </Group>
        ))}
      </>
    );
  }
  if (id === 'name') return <NamePicker key="system" what="Your system" typing={typing} value={design} onChange={(n) => onEdit(withNames(design, n))} />;
  return null;
}

function BuildStep({ options, credits, busy, onBuild }: { options: BuildOption[]; credits: number; busy: boolean; onBuild: (o: BuildOption) => void }) {
  if (!options.length) return <p className="st-good-note">Everything here is built, or nothing is planned yet. Pick something in the other steps.</p>;
  return (
    <ul className="stf-build">
      {options.map((o) => {
        const short = o.price - credits;
        return (
          <li key={o.piece.key} className="stf-build__row">
            <span className="stf-build__what"><strong>{o.piece.label}</strong> <span className="st-soft">{cr(o.price)}</span></span>
            <button type="button" className="st-btn st-btn--primary" disabled={busy || !!o.problem} onClick={() => onBuild(o)} data-coach="forge-build">Build it</button>
            <span className={`stf-build__why ${o.problem ? 'st-warn' : 'st-soft'}`}>{o.problem ?? (short > 0 ? `You need ${cr(short)} more.` : 'You can afford it!')}</span>
          </li>
        );
      })}
    </ul>
  );
}
