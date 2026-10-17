/**
 * Preview only: "Walk around". Pick two monsters, then walk the home town and Kauri Bush.
 * Nothing is saved: reloading starts fresh. Also a Teleport box and a "More battles" switch,
 * so the world can be tried quickly.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { FAMILIES } from '../../shared/monsters/monsterBook';
import { WORLD_MAPS } from '../../shared/monsters/maps';
import { makeMonster, type Monster } from '../../shared/monsters/rules';
import { TYPE_LABEL, TYPES, type TypeId } from '../../shared/monsters/types';
import { newWorld } from '../../shared/monsters/world/world';
import { nameOf } from '../../src/games/monsters/text';
import { WorldGame } from '../../src/games/monsters/world/WorldGame';
import { loadWorldSettings, saveWorldSettings, type WorldSettings } from '../../src/games/monsters/world/settings';
import { MonsterArt } from '../../src/games/monsters/art/MonsterArt';

const familyOf = (type: TypeId, nth: number) => Object.entries(FAMILIES).filter(([, f]) => f.type === type)[nth][0];
/** The first monster of a type, or the second one if the type was already picked (so two of a type are different). */
const starter = (type: TypeId, nth: number) => makeMonster(`${familyOf(type, nth)}-1`, 5);

const TELEPORTS = [
  { label: 'Home town', map: 'harbour-town', spot: 'start' },
  { label: 'Healing centre', map: 'healing-centre', spot: 'wake' },
  { label: 'Kauri Bush', map: 'kauri-bush', spot: 'entrance' },
  { label: 'Next to the trainer', map: 'kauri-bush', spot: 'trainer-approach' },
  { label: 'Next to the long grass', map: 'kauri-bush', spot: 'grass-edge' },
  { label: 'Next to the closed path to area 2', map: 'kauri-bush', spot: 'area-2-gate' },
];

export function WalkPage({ onBattling }: { onBattling?: (on: boolean) => void }) {
  const [picks, setPicks] = useState<[TypeId, TypeId]>(['water', 'fire']);
  const [team, setTeam] = useState<Monster[] | null>(null);
  const [run, setRun] = useState(0);
  const [fast, setFast] = useState(false);
  const [settings, setSettings] = useState<WorldSettings>(loadWorldSettings);
  const [battling, setBattling] = useState(false);
  const page = useRef<HTMLElement>(null);
  const [where, setWhere] = useState(TELEPORTS[0].label);
  const [teleport, setTeleport] = useState<{ nonce: number; map: string; x: number; y: number; facing: 'up' | 'down' | 'left' | 'right' } | undefined>();

  const change = (s: WorldSettings) => {
    setSettings(s);
    saveWorldSettings(s);
  };
  const initial = useMemo(
    () => (team ? newWorld({ maps: WORLD_MAPS, fast }, team, Date.now() % 100000) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [team, run],
  );
  useEffect(() => () => onBattling?.(false), [onBattling]);
  // On a short screen (a phone on its side) the game takes the whole height, so bring it into view.
  useEffect(() => {
    if (team && window.innerHeight <= 460) page.current?.scrollIntoView({ block: 'start' });
  }, [team, run]);

  function go() {
    const t = TELEPORTS.find((x) => x.label === where)!;
    const s = WORLD_MAPS[t.map].spots.find((p) => p.name === t.spot)!;
    setTeleport({ nonce: (teleport?.nonce ?? 0) + 1, map: t.map, x: s.x, y: s.y, facing: s.facing });
  }

  if (!team || !initial) {
    return (
      <section className="mp-page">
        <h1>Walk around</h1>
        <p>Walk the home town and Kauri Bush (area 1). Pick the two monsters you start with, both at level 5. Nothing is saved.</p>
        <div className="mp-controls">
          {[0, 1].map((i) => (
            <label key={i}>
              Monster {i + 1}{' '}
              <select value={picks[i]} onChange={(e) => setPicks(i === 0 ? [e.target.value as TypeId, picks[1]] : [picks[0], e.target.value as TypeId])}>
                {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]} ({nameOf(starter(t, 0).species)})</option>)}
              </select>
            </label>
          ))}
        </div>
        <p><button type="button" className="pg-start" onClick={() => setTeam([starter(picks[0], 0), starter(picks[1], picks[1] === picks[0] ? 1 : 0)])}>Start walking</button></p>
      </section>
    );
  }

  return (
    <section className="wp-page" ref={page}>
      <details className="wp-tools" hidden={battling}>
        <summary>Test controls</summary>
        <div className="mp-controls">
          <label>
            Teleport to{' '}
            <select value={where} onChange={(e) => setWhere(e.target.value)}>
              {TELEPORTS.map((t) => <option key={t.label}>{t.label}</option>)}
            </select>
          </label>
          <button type="button" onClick={go}>Go</button>
          <label className="pg-check"><input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} /> More battles (every 2-3 steps in long grass)</label>
          <span className="wp-team">
            {team.map((m, i) => <MonsterArt key={i} species={m.species} size={28} still />)}
          </span>
          <button type="button" onClick={() => { setTeam(null); setTeleport(undefined); setRun((r) => r + 1); }}>Start again</button>
        </div>
      </details>
      <WorldGame key={run} initial={initial} settings={settings} onSettingsChange={change} fast={fast} teleport={teleport} onBattling={(on) => { setBattling(on); onBattling?.(on); }} />
    </section>
  );
}
