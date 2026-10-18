/**
 * Preview only: the battle playground. Pick your team (type, form, level), the enemy, wild or
 * trainer, and the area (which sets how hard the questions are), then fight. Nothing is saved.
 */
import { useEffect, useState } from 'react';
import { AREA_LEVELS } from '../../shared/monsters/bands';
import type { BattleSetup } from '../../shared/monsters/engine';
import { FAMILIES, speciesOf } from '../../shared/monsters/monsterBook';
import { expForLevel, makeMonster, maxHpOf, type Monster } from '../../shared/monsters/rules';
import { TYPE_LABEL, TYPES, type TypeId } from '../../shared/monsters/types';
import { BattleScreen, type BattleResult } from '../../src/games/monsters/BattleScreen';
import { MonsterArt } from '../../src/games/monsters/art/MonsterArt';
import { nameOf } from '../../src/games/monsters/text';

interface Slot {
  type: TypeId;
  family: string;
  stage: 1 | 2 | 3;
  level: number;
  shiny: boolean;
  /** One win away from the next level (so a level-up or growing is easy to see). */
  almost: boolean;
  /** Start hurt (a third of the health). */
  hurt: boolean;
}

const familiesOf = (type: TypeId) => Object.entries(FAMILIES).filter(([, f]) => f.type === type).map(([id]) => id);
const slot = (type: TypeId, stage: 1 | 2 | 3, level: number, nth = 0): Slot => ({ type, family: familiesOf(type)[nth], stage, level, shiny: false, almost: false, hurt: false });

function build(s: Slot): Monster {
  const m = makeMonster(`${s.family}-${s.stage}`, s.level);
  if (s.almost) m.exp = expForLevel(s.level + 1) - 1;
  if (s.shiny) m.shiny = true;
  if (s.hurt) m.hp = Math.max(1, Math.round(maxHpOf(m) / 3));
  return m;
}

function SlotEditor({ s, onChange, onRemove, label }: { s: Slot; onChange: (s: Slot) => void; onRemove?: () => void; label: string }) {
  const species = speciesOf(`${s.family}-${s.stage}`);
  return (
    <fieldset className="pg-slot">
      <legend>{label}</legend>
      <MonsterArt species={species.id} shiny={s.shiny} size={64} still />
      <label>
        Type
        <select value={s.type} onChange={(e) => { const type = e.target.value as TypeId; onChange({ ...s, type, family: familiesOf(type)[0] }); }}>
          {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
        </select>
      </label>
      <label>
        Family
        <select value={s.family} onChange={(e) => onChange({ ...s, family: e.target.value })}>
          {familiesOf(s.type).map((id) => <option key={id} value={id}>{FAMILIES[id].names[0]}</option>)}
        </select>
      </label>
      <label>
        Form
        <select value={s.stage} onChange={(e) => onChange({ ...s, stage: Number(e.target.value) as 1 | 2 | 3 })}>
          {[1, 2, 3].map((n) => <option key={n} value={n}>{FAMILIES[s.family].names[n - 1]}</option>)}
        </select>
      </label>
      <label>
        Level
        <input type="number" min={1} max={50} value={s.level} onChange={(e) => onChange({ ...s, level: Math.min(50, Math.max(1, Number(e.target.value) || 1)) })} />
      </label>
      <label className="pg-check"><input type="checkbox" checked={s.shiny} onChange={(e) => onChange({ ...s, shiny: e.target.checked })} /> Shiny</label>
      <label className="pg-check"><input type="checkbox" checked={s.almost} onChange={(e) => onChange({ ...s, almost: e.target.checked })} /> Almost levels up</label>
      <label className="pg-check"><input type="checkbox" checked={s.hurt} onChange={(e) => onChange({ ...s, hurt: e.target.checked })} /> Starts hurt</label>
      {s.stage < 3 && (
        <button type="button" onClick={() => onChange({ ...s, level: species.evolveAt! - 1, almost: true })}>
          Ready to grow (level {species.evolveAt! - 1}, one win away)
        </button>
      )}
      {onRemove && <button type="button" onClick={onRemove}>Remove</button>}
    </fieldset>
  );
}

export function PlaygroundPage({ onBattling }: { onBattling?: (on: boolean) => void }) {
  const [team, setTeam] = useState<Slot[]>([slot('water', 1, 5), slot('fire', 1, 5)]);
  const [enemy, setEnemy] = useState<Slot[]>([slot('leaf', 1, 5)]);
  const [kind, setKind] = useState<'wild' | 'trainer'>('wild');
  const [area, setArea] = useState(1);
  const [far, setFar] = useState(false);
  const [carry, setCarry] = useState<Monster[] | null>(null);
  const [bag, setBag] = useState({ potion: 5, 'super-potion': 2, ball: 10, 'great-ball': 3 });
  const [setup, setSetup] = useState<BattleSetup | null>(null);
  const [round, setRound] = useState(0);
  const [result, setResult] = useState<BattleResult | null>(null);

  const battling = !!setup && !result;
  useEffect(() => onBattling?.(battling), [battling, onBattling]);

  function begin() {
    const foes = (kind === 'wild' ? enemy.slice(0, 1) : enemy).map(build);
    setSetup({ kind, area, far, team: carry ?? team.map(build), bag: { ...bag }, foes });
    setRound((r) => r + 1);
    setResult(null);
  }
  function preset(name: 'wild' | 'tower' | 'grow') {
    setCarry(null);
    if (name === 'wild') {
      setKind('wild'); setArea(1); setFar(false);
      setTeam([slot('water', 1, 5), slot('fire', 1, 5)]); setEnemy([slot('leaf', 1, 5)]);
    } else if (name === 'tower') {
      setKind('trainer'); setArea(3); setFar(true);
      setTeam([slot('fire', 2, 20, 1), slot('ice', 2, 20), slot('spark', 2, 20, 2)]);
      setEnemy([slot('stone', 2, 21), slot('leaf', 2, 21, 1), slot('water', 2, 21, 2)]);
    } else {
      setKind('wild'); setArea(2); setFar(false);
      setTeam([{ ...slot('spark', 1, 14), almost: true }, slot('stone', 1, 8)]); setEnemy([slot('ice', 1, 8)]);
    }
  }

  if (setup && !result) {
    return (
      <div className="pg-battle">
        <h1 className="sr-only">Maths Monsters battle</h1>
        <button type="button" className="pg-leave" onClick={() => { setSetup(null); setResult(null); }}>← Leave the battle</button>
        <BattleScreen key={round} setup={setup} onFinish={setResult} />
      </div>
    );
  }
  return (
    <section className="mp-page">
      <h1>Battle playground</h1>
      {result && (
        <div className="pg-result" role="status">
          <strong>Battle over: {result.outcome === 'won' ? 'you won' : result.outcome === 'lost' ? 'your team was tired (it is healed)' : result.outcome === 'ran' ? 'you ran away' : 'you caught it'}.</strong>{' '}
          Team now: {result.team.map((m) => `${nameOf(m.species)} Lv ${m.level}`).join(', ')}.
          <div>
            <button type="button" onClick={() => { setCarry(result.team); setBag(result.bag as typeof bag); setSetup(null); setResult(null); }}>
              Keep this team and bag for the next battle
            </button>{' '}
            <button type="button" onClick={() => { setSetup(null); setResult(null); }}>Back to my picks</button>
          </div>
        </div>
      )}
      <div className="mp-controls">
        <strong>Quick set-ups:</strong>
        <button type="button" onClick={() => preset('wild')}>Easy wild fight</button>
        <button type="button" onClick={() => preset('tower')}>Tower trainer (3 monsters)</button>
        <button type="button" onClick={() => preset('grow')}>Watch a monster grow</button>
      </div>
      <div className="mp-controls">
        <label>
          Battle{' '}
          <select value={kind} onChange={(e) => setKind(e.target.value as 'wild' | 'trainer')}>
            <option value="wild">Wild monster</option>
            <option value="trainer">Trainer (up to 3 monsters)</option>
          </select>
        </label>
        <label>
          Area{' '}
          <select value={area} onChange={(e) => setArea(Number(e.target.value))}>
            {AREA_LEVELS.map((l, i) => <option key={i} value={i + 1}>Area {i + 1} (wild levels {l[0]}-{l[1]})</option>)}
          </select>
        </label>
        <label className="pg-check"><input type="checkbox" checked={far} onChange={(e) => setFar(e.target.checked)} /> Far side / Tower (harder questions)</label>
      </div>
      {carry ? (
        <p>
          Using your team from the last battle: {carry.map((m) => `${nameOf(m.species)} Lv ${m.level}`).join(', ')}.{' '}
          <button type="button" onClick={() => setCarry(null)}>Use my picks instead</button>
        </p>
      ) : (
        <>
          <h2>Your team</h2>
          <div className="pg-slots">
            {team.map((s, i) => (
              <SlotEditor key={i} label={`Your monster ${i + 1}`} s={s} onChange={(n) => setTeam(team.map((t, j) => (j === i ? n : t)))} onRemove={team.length > 1 ? () => setTeam(team.filter((_, j) => j !== i)) : undefined} />
            ))}
          </div>
          {team.length < 6 && <button type="button" onClick={() => setTeam([...team, slot('leaf', 1, 5)])}>Add a monster</button>}
        </>
      )}
      <h2>{kind === 'wild' ? 'The wild monster' : 'The trainer’s monsters'}</h2>
      <div className="pg-slots">
        {(kind === 'wild' ? enemy.slice(0, 1) : enemy).map((s, i) => (
          <SlotEditor key={i} label={kind === 'wild' ? 'Wild monster' : `Trainer monster ${i + 1}`} s={s} onChange={(n) => setEnemy(enemy.map((t, j) => (j === i ? n : t)))} onRemove={kind === 'trainer' && enemy.length > 1 ? () => setEnemy(enemy.filter((_, j) => j !== i)) : undefined} />
        ))}
      </div>
      {kind === 'trainer' && enemy.length < 3 && <button type="button" onClick={() => setEnemy([...enemy, slot('leaf', 1, 5)])}>Add a trainer monster</button>}
      <h2>Bag</h2>
      <div className="mp-controls">
        {(['potion', 'super-potion', 'ball', 'great-ball'] as const).map((k) => (
          <label key={k}>
            {k.replace('-', ' ')}{' '}
            <input type="number" min={0} max={99} value={bag[k]} onChange={(e) => setBag({ ...bag, [k]: Math.max(0, Number(e.target.value) || 0) })} style={{ width: 64 }} />
          </label>
        ))}
      </div>
      <p><button type="button" className="pg-start" onClick={begin}>Start the battle</button></p>
    </section>
  );
}
