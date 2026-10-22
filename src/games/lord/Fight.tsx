import { useEffect, useRef, useState } from 'react';
import { CLASSES, SKILL_NAMES } from '../../../shared/lord/data';
import { canRun, skillsFor, stepFight } from '../../../shared/lord/engine';
import type { FightAction, FightState } from '../../../shared/lord/types';
import { shortcutsOn } from './shortcuts';
import { HeroSprite, Icon, MonsterSprite } from './Sprite';
import { SKILL_HELP, narrate } from './text';
import { Stage } from './Stage';
import { forestScene } from './art';

function Bar({ value, max, label, colour }: { value: number; max: number; label: string; colour: string }) {
  const share = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div className="lord-bar" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <div className="lord-bar__fill" style={{ width: `${share * 100}%`, background: colour }} />
      <span className="lord-bar__text">{label}: {value} / {max}</span>
    </div>
  );
}

/**
 * One fight. The player picks Attack, Run or a class skill; the parent keeps the state so it can
 * save the actions (the server will replay them in L.4). When the fight ends the player reads the
 * result and presses Continue.
 */
export function FightScreen({ fight, onChange, onContinue, heroName = 'You' }: {
  fight: FightState;
  onChange: (next: FightState, action: FightAction) => void;
  onContinue: () => void;
  heroName?: string;
}) {
  const dragon = fight.kind === 'dragon';
  const [lines, setLines] = useState<string[]>(() => [fight.monster.intro]);
  const skills = skillsFor(fight.heroClass);
  const busy = useRef(false);
  // Which side was hit last, so its picture can give a little shake (off when the device asks for less motion).
  const [hit, setHit] = useState<{ side: 'foe' | 'me'; n: number } | null>(null);

  function act(action: FightAction) {
    if (fight.over || busy.current) return;
    busy.current = true;
    const next = stepFight(fight, action);
    if (next.monsterHp < fight.monsterHp) setHit((h) => ({ side: 'foe', n: (h?.n ?? 0) + 1 }));
    else if (next.heroHp < fight.heroHp) setHit((h) => ({ side: 'me', n: (h?.n ?? 0) + 1 }));
    setLines((old) => [...old, ...narrate(next.log, fight.monster.name, dragon)].slice(-40));
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

  const logRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [lines]);

  const canUse = (skill: (typeof skills)[number]) => fight.skillLeft > 0 && !(skill === 'pinch' && fight.goldPinched > 0) && !(skill === 'mend' && fight.heroHp >= fight.heroMaxHp);

  return (
    <section className="lord-fight" aria-label={`Fight: ${fight.monster.name}`}>
      <Stage scene={dragon ? 'lair' : fight.kind === 'master' ? 'training' : forestScene(fight.monster.level)} size="tall" className="lord-fight__arena">
        <div className="lord-fight__me">
          <div key={hit?.side === 'me' ? hit.n : 'me'} className={`lord-fight__figure${hit?.side === 'me' ? ' lord-hit' : ''}`}>
            <HeroSprite heroClass={fight.heroClass} scale={8} />
          </div>
          <h2 className="lord-nameplate">{heroName}</h2>
          <Bar value={fight.heroHp} max={fight.heroMaxHp} label="Your health" colour="var(--lord-green)" />
          {fight.shield > 0 && <p className="lord-chip">Shield {fight.shield}</p>}
          {fight.round === 0 && fight.firstHitBonus > 1 && <p className="lord-chip">Weak spot found: first hit ×{fight.firstHitBonus}</p>}
        </div>
        <div className="lord-fight__foe">
          <div key={hit?.side === 'foe' ? hit.n : 'foe'} className={`lord-fight__figure${hit?.side === 'foe' ? ' lord-hit' : ''}${dragon ? ' lord-breathe' : ''}`}>
            <MonsterSprite monster={fight.monster} scale={dragon ? 12 : 10} decorative />
          </div>
          <h2 className="lord-nameplate">{fight.monster.name}</h2>
          <Bar value={fight.monsterHp} max={fight.monster.hp} label="Monster" colour="var(--lord-red)" />
        </div>
      </Stage>
      <div className="lord-panel lord-fight__panel">

      <ul className="lord-log" ref={logRef} aria-live="polite" aria-label="What happened">
        {lines.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>

      {!fight.over ? (
        <div className="lord-actions" role="group" aria-label="Your move">
          <button type="button" className="lord-btn lord-btn--hot" onClick={() => act({ type: 'attack' })}>
            <kbd>A</kbd> Attack
          </button>
          {skills.map((skill, i) => (
            <button key={skill} type="button" className="lord-btn" disabled={!canUse(skill)} onClick={() => act({ type: 'skill', skill })} title={SKILL_HELP[skill]}>
              <kbd>{i + 1}</kbd> {SKILL_NAMES[skill]} <small>({fight.skillLeft} left)</small>
            </button>
          ))}
          {canRun(fight) && (
            <button type="button" className="lord-btn" onClick={() => act({ type: 'run' })}>
              <kbd>R</kbd> Run
            </button>
          )}
          <p className="lord-hint">{CLASSES[fight.heroClass].name}: {skills.map((s) => SKILL_HELP[s]).join(' · ')}</p>
        </div>
      ) : (
        <div className="lord-actions">
          <button type="button" className="lord-btn lord-btn--hot" autoFocus onClick={onContinue}>
            <kbd>↵</kbd> Continue
          </button>
          {fight.outcome === 'won' && fight.monster.gold + fight.goldPinched > 0 && (
            <p className="lord-reward">
              <Icon name="gold" /> +{fight.monster.gold + fight.goldPinched} gold · +{fight.monster.exp} experience
            </p>
          )}
        </div>
      )}
      </div>
    </section>
  );
}
