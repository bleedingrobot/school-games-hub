import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { SKILL_NAMES } from '../../../shared/lord/data';
import { canRun, skillsFor, stepFight } from '../../../shared/lord/engine';
import type { FightAction, FightEvent, FightState } from '../../../shared/lord/types';
import { shortcutsOn } from './shortcuts';
import { HeroSprite, MonsterSprite } from './Sprite';
import { SKILL_HELP, narrate } from './text';
import { sceneArt, type SceneId } from './art';

function Bar({ value, max, label, side }: { value: number; max: number; label: string; side: 'me' | 'foe' }) {
  const share = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div className={`lord-hp lord-hp--${side}${share <= 0.25 ? ' is-low' : ''}`} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <div className="lord-hp__fill" style={{ width: `${share * 100}%` }} />
      <span className="lord-hp__text">{value} / {max}</span>
    </div>
  );
}

/**
 * The big painted stage every fight screen stands on (James, 17 Nov 2026: the art as big as it can be, nothing on it
 * that a pupil doesn't need right now). The painting fills it; whatever is passed in sits on top.
 */
export function BigStage({ scene, className = '', children, label }: { scene: SceneId; className?: string; children: ReactNode; label: string }) {
  const art = sceneArt(scene);
  return (
    <section className={`lord-big lord-big--${scene} ${className}`} aria-label={label}>
      {art.wide && (
        <picture className="lord-big__pic" aria-hidden="true">
          <source media="(max-width: 900px)" srcSet={art.small} />
          <img src={art.wide} alt="" draggable={false} />
        </picture>
      )}
      <div className="lord-big__shade" aria-hidden="true" />
      {children}
    </section>
  );
}

export const fightScene = (fight: Pick<FightState, 'kind' | 'monster'>, forest: (level: number) => SceneId): SceneId =>
  fight.kind === 'dragon' ? 'lair' : fight.kind === 'master' ? 'training' : forest(fight.monster.level);

type Float = { id: number; side: 'me' | 'foe'; text: string; tone: 'hit' | 'crit' | 'miss' | 'heal' | 'gold'; delay: number };

/** What a round looks like on the stage: numbers that pop over whoever was hit, in the order it happened. */
function floatsFor(log: FightEvent[], start: number): Float[] {
  const out: Float[] = [];
  let t = 0;
  for (const e of log) {
    const id = start + out.length;
    if (e.type === 'hero-hit') { out.push({ id, side: 'foe', text: e.crit ? `${e.damage}!` : `${e.damage}`, tone: e.crit ? 'crit' : 'hit', delay: t }); t += 450; }
    else if (e.type === 'monster-hit') { out.push({ id, side: 'me', text: e.damage === 0 ? 'Blocked!' : `${e.damage}`, tone: e.damage === 0 ? 'miss' : 'hit', delay: t }); t += 450; }
    else if (e.type === 'monster-missed') { out.push({ id, side: 'me', text: 'Missed!', tone: 'miss', delay: t }); t += 450; }
    else if (e.type === 'skill' && e.skill === 'mend') { out.push({ id, side: 'me', text: `+${e.amount}`, tone: 'heal', delay: t }); t += 300; }
    else if (e.type === 'skill' && e.skill === 'pinch' && e.amount > 0) { out.push({ id, side: 'foe', text: `+${e.amount} gold`, tone: 'gold', delay: t }); t += 300; }
    else if (e.type === 'ran' && !e.success) { out.push({ id, side: 'me', text: 'No way out!', tone: 'miss', delay: t }); t += 300; }
  }
  return out;
}

/** A round's swings, for the lunge: who struck first. */
const firstMover = (log: FightEvent[]): 'me' | 'foe' | null => {
  const e = log.find((x) => x.type === 'hero-hit' || x.type === 'monster-hit' || x.type === 'monster-missed');
  return !e ? null : e.type === 'hero-hit' ? 'me' : 'foe';
};

const COINS = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2;
  return { i, x: `${Math.round(Math.cos(a) * 34)}vw`, y: `${Math.round(Math.sin(a) * 26 - 12)}vh` };
});

/**
 * One fight, on one big painting: the hero on the left, the monster on the right, a health bar over each, the moves in
 * a row along the bottom. Hits pop up as numbers instead of a written log (a screen reader still hears every line).
 * The parent keeps the state so it can send the actions to the server; when the fight ends the result bursts over the
 * painting and the player presses Continue.
 */
export function FightScreen({ fight, onChange, onContinue, heroName = 'You', look, scene, dragonStage }: {
  fight: FightState;
  onChange: (next: FightState, action: FightAction) => void;
  onContinue: () => void;
  heroName?: string;
  look?: string;
  scene: SceneId;
  dragonStage?: 1 | 2 | 3;
}) {
  const dragon = fight.kind === 'dragon';
  const [said, setSaid] = useState<string>(fight.monster.intro);
  const skills = skillsFor(fight.heroClass);
  const busy = useRef(false);
  const [floats, setFloats] = useState<Float[]>([]);
  const [hit, setHit] = useState<{ me: number; foe: number; lunge: 'me' | 'foe' | null; n: number }>({ me: 0, foe: 0, lunge: null, n: 0 });
  const nextId = useRef(0);

  function act(action: FightAction) {
    if (fight.over || busy.current) return;
    busy.current = true;
    const next = stepFight(fight, action);
    const fresh = floatsFor(next.log, nextId.current);
    nextId.current += fresh.length + 1;
    setFloats((old) => [...old.slice(-8), ...fresh]);
    setHit((h) => ({
      me: next.heroHp < fight.heroHp ? h.me + 1 : h.me,
      foe: next.monsterHp < fight.monsterHp ? h.foe + 1 : h.foe,
      lunge: firstMover(next.log),
      n: h.n + 1,
    }));
    setSaid(narrate(next.log, fight.monster.name, dragon).join(' '));
    onChange(next, action);
    busy.current = false;
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (fight.over) {
        // Enter on the focused Continue button already works; the letter key is the extra.
        if (k === 'c' && shortcutsOn()) onContinue();
        else if (k === 'enter' && !(e.target instanceof HTMLButtonElement)) onContinue();
        return;
      }
      if (!shortcutsOn()) return;
      if (k === 'a') act({ type: 'attack' });
      else if (k === 'r' && canRun(fight)) act({ type: 'run' });
      else if (k >= '1' && k <= '9') {
        const skill = skills[Number(k) - 1];
        if (skill && fight.skillLeft > 0) act({ type: 'skill', skill });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const canUse = (skill: (typeof skills)[number]) => fight.skillLeft > 0 && !(skill === 'pinch' && fight.goldPinched > 0) && !(skill === 'mend' && fight.heroHp >= fight.heroMaxHp);
  const gold = fight.outcome === 'won' ? fight.monster.gold + fight.goldPinched : 0;
  const exp = fight.outcome === 'won' ? fight.monster.exp : 0;
  const ending = fight.over ? endWords(fight, dragonStage) : null;

  return (
    <BigStage scene={scene} label={`Fight: ${fight.monster.name}`} className={`lord-fight${fight.over ? ` is-over is-${fight.outcome}` : ''}${dragon ? ' is-dragon' : ''}`}>
      <div className="lord-big__hud">
        <div className="lord-big__side lord-big__side--me">
          <h2 className="lord-big__name">{heroName}</h2>
          <Bar value={fight.heroHp} max={fight.heroMaxHp} label="Your health" side="me" />
          <div className="lord-big__chips">
            {fight.shield > 0 && <span className="lord-chip">Shield {fight.shield}</span>}
            {fight.round === 0 && fight.firstHitBonus > 1 && <span className="lord-chip lord-chip--hot">Weak spot! First hit ×{fight.firstHitBonus}</span>}
          </div>
        </div>
        <div className="lord-big__side lord-big__side--foe">
          <h2 className="lord-big__name">{fight.monster.name}</h2>
          <Bar value={fight.monsterHp} max={fight.monster.hp} label={`${fight.monster.name}’s health`} side="foe" />
        </div>
      </div>

      <div className="lord-big__floor">
        <div className={`lord-big__fig lord-big__fig--me${fight.outcome === 'lost' ? ' is-down' : ''}`}>
          <div key={`me${hit.me}-${hit.lunge === 'me' ? hit.n : 0}`} className={`lord-big__body${hit.me ? ' lord-hit' : ''}${hit.lunge === 'me' ? ' lord-lunge-r' : ''}`}>
            <HeroSprite heroClass={fight.heroClass} look={look} scale={8} label="" />
          </div>
          {floats.filter((f) => f.side === 'me').map((f) => <FloatNum key={f.id} f={f} />)}
        </div>
        <div className={`lord-big__fig lord-big__fig--foe${fight.outcome === 'won' ? ' is-down' : ''}`}>
          <div key={`foe${hit.foe}-${hit.lunge === 'foe' ? hit.n : 0}`} className={`lord-big__body${hit.foe ? ' lord-hit' : ''}${hit.lunge === 'foe' ? ' lord-lunge-l' : ''}${dragon ? ' lord-breathe' : ''}`}>
            <MonsterSprite monster={fight.monster} scale={dragon ? 12 : 10} decorative />
          </div>
          {floats.filter((f) => f.side === 'foe').map((f) => <FloatNum key={f.id} f={f} />)}
        </div>
      </div>

      <p className="lord-sr" aria-live="polite">{said}</p>

      {ending && (
        <div className="lord-end" aria-hidden={false}>
          {fight.outcome === 'won' && <div className="lord-end__rays" aria-hidden="true" />}
          <p className="lord-end__title">{ending.title}</p>
          {ending.line && <p className="lord-end__line">{ending.line}</p>}
          {(gold > 0 || exp > 0) && (
            <p className="lord-end__pops">
              {gold > 0 && <span className="lord-pop lord-pop--gold" style={{ '--d': '0.45s' } as CSSProperties}>+{gold} gold</span>}
              {exp > 0 && <span className="lord-pop lord-pop--exp" style={{ '--d': '0.85s' } as CSSProperties}>+{exp} XP</span>}
            </p>
          )}
          {gold > 0 && (
            <div className="lord-end__coins" aria-hidden="true">
              {COINS.map((c) => <span key={c.i} style={{ '--i': c.i, '--x': c.x, '--y': c.y } as CSSProperties} />)}
            </div>
          )}
        </div>
      )}

      <div className="lord-big__bar" role="group" aria-label={fight.over ? 'Next' : 'Your move'}>
        {!fight.over ? (
          <>
            <button type="button" className="lord-btn lord-btn--hot lord-btn--big" onClick={() => act({ type: 'attack' })}>
              <kbd>A</kbd> Attack
            </button>
            {skills.map((skill, i) => (
              <button key={skill} type="button" className="lord-btn lord-btn--glass" disabled={!canUse(skill)} onClick={() => act({ type: 'skill', skill })} title={SKILL_HELP[skill]}>
                <kbd>{i + 1}</kbd> {SKILL_NAMES[skill]} <small>×{fight.skillLeft}</small>
              </button>
            ))}
            {canRun(fight) && (
              <button type="button" className="lord-btn lord-btn--glass" onClick={() => act({ type: 'run' })}>
                <kbd>R</kbd> Run
              </button>
            )}
          </>
        ) : (
          <button type="button" className="lord-btn lord-btn--hot lord-btn--big lord-end__go" autoFocus onClick={onContinue}>
            <kbd>↵</kbd> Continue
          </button>
        )}
      </div>
    </BigStage>
  );
}

function FloatNum({ f }: { f: Float }) {
  return <span className={`lord-float lord-float--${f.tone}`} style={{ animationDelay: `${f.delay}ms` }} aria-hidden="true">{f.text}</span>;
}

function endWords(fight: FightState, dragonStage?: 1 | 2 | 3): { title: string; line?: string } {
  if (fight.outcome === 'won') {
    if (fight.kind === 'dragon') return dragonStage === 3 ? { title: 'Dragon beaten!' } : { title: 'You did it!', line: `Fight ${dragonStage ?? 1} of 3 won. Catch your breath…` };
    if (fight.kind === 'master') return { title: 'Victory!', line: `You beat ${fight.monster.name}!` };
    return { title: 'Victory!' };
  }
  if (fight.outcome === 'fled') return { title: 'You got away!' };
  if (fight.kind === 'forest') return { title: 'Flattened!', line: 'You wake at the healer. Your bank and experience are safe.' };
  return { title: 'Not this time', line: 'Nothing is lost. Try again tomorrow!' };
}
