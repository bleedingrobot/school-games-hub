/**
 * Preview only: "Walk around". Pick two monsters, then walk the home town and Kauri Bush.
 * Nothing is saved: reloading starts fresh. Also a Teleport box and a "More battles" switch,
 * so the world can be tried quickly.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { formAt, FAMILIES } from '../../shared/monsters/monsterBook';
import { WORLD_MAPS } from '../../shared/monsters/maps';
import { makeMonster, type Monster } from '../../shared/monsters/rules';
import { TYPE_LABEL, TYPES, type TypeId } from '../../shared/monsters/types';
import { AREAS, BADGE_ORDER } from '../../shared/monsters/world/areas';
import type { WorldState } from '../../shared/monsters/world/types';
import { newWorld, refreshBook } from '../../shared/monsters/world/world';
import { nameOf } from '../../src/games/monsters/text';
import { WorldGame, type WorldGameProps } from '../../src/games/monsters/world/WorldGame';
import { loadWorldSettings, saveWorldSettings, type WorldSettings } from '../../src/games/monsters/world/settings';
import { MonsterArt } from '../../src/games/monsters/art/MonsterArt';

const familyOf = (type: TypeId, nth: number) => Object.entries(FAMILIES).filter(([, f]) => f.type === type)[nth][0];
/** The first monster of a type, or the second one if the type was already picked (so two of a type are different). */
const starter = (type: TypeId, nth: number) => makeMonster(`${familyOf(type, nth)}-1`, 5);

interface Teleport { label: string; group: string; map: string; spot: string }

/** Every place worth seeing, grouped: the town, then each area with its Tower, trainer, grass, nurse and gate. */
const TELEPORTS: Teleport[] = [
  { group: 'Home town', label: 'Home town', map: 'harbour-town', spot: 'start' },
  { group: 'Home town', label: 'Healing centre', map: 'healing-centre', spot: 'wake' },
  { group: 'Home town', label: 'Next to the monster box', map: 'harbour-town', spot: 'box' },
  { group: 'Home town', label: 'Next to the monster book', map: 'harbour-town', spot: 'book' },
  ...AREAS.flatMap((a): Teleport[] => {
    const group = `Area ${a.area}: ${a.name}`;
    const spots: [string, string, string][] = [
      [`${a.name}`, a.map, 'entrance'],
      ['Next to the trainer', a.map, 'trainer-approach'],
      ['Next to the long grass', a.map, 'grass-edge'],
      ['Healing hut (next to the nurse)', a.map, 'nurse'],
      ['Outside the Tower door', a.map, 'tower-door'],
      [`Next to the gate to the next area`, a.map, 'gate'],
      ['Inside the Tower (hall)', a.towerHall, 'inside'],
      ['Next to the Tower trainer', a.towerTop, 'trainer-approach'],
    ];
    return spots.filter(([, map, spot]) => WORLD_MAPS[map].spots.some((p) => p.name === spot)).map(([label, map, spot]) => ({ group, label, map, spot }));
  }),
];
const keyOf = (t: Teleport) => `${t.group}: ${t.label}`;

/** A full team (one of each type, at level 40), three more in the box, and a full bag. */
function giveFullTeamAndBag(s: WorldState): WorldState {
  const strong = (family: string) => makeMonster(formAt(family, 40), 40);
  return refreshBook({
    ...s,
    team: ['digibud', 'plusplash', 'factorch', 'divvy', 'fractopus', 'pebblepoint'].map(strong),
    box: ['roundroot', 'minnowus', 'sharebear'].map(strong),
    bag: { potion: 20, 'super-potion': 10, ball: 30, 'great-ball': 10, repel: 5 },
  });
}
const giveAllBadges = (s: WorldState): WorldState => ({ ...s, badges: [...BADGE_ORDER] });

export function WalkPage({ onBattling, testing }: { onBattling?: (on: boolean) => void; testing?: Pick<WorldGameProps, 'random' | 'packFor' | 'timeScale'> }) {
  const [picks, setPicks] = useState<[TypeId, TypeId]>(['water', 'fire']);
  const [team, setTeam] = useState<Monster[] | null>(null);
  const [run, setRun] = useState(0);
  const [fast, setFast] = useState(false);
  const [settings, setSettings] = useState<WorldSettings>(loadWorldSettings);
  const [battling, setBattling] = useState(false);
  const page = useRef<HTMLElement>(null);
  const [where, setWhere] = useState(keyOf(TELEPORTS[0]));
  const [teleport, setTeleport] = useState<{ nonce: number; map: string; x: number; y: number; facing: 'up' | 'down' | 'left' | 'right' } | undefined>();
  const [cheat, setCheat] = useState<{ nonce: number; apply: (s: WorldState) => WorldState } | undefined>();
  const give = (apply: (s: WorldState) => WorldState) => setCheat({ nonce: (cheat?.nonce ?? 0) + 1, apply });

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
    const t = TELEPORTS.find((x) => keyOf(x) === where)!;
    const s = WORLD_MAPS[t.map].spots.find((p) => p.name === t.spot)!;
    setTeleport({ nonce: (teleport?.nonce ?? 0) + 1, map: t.map, x: s.x, y: s.y, facing: s.facing });
  }

  if (!team || !initial) {
    return (
      <section className="mp-page">
        <h1>Walk around</h1>
        <p>Walk the home town and all six areas, with their Topic Towers. Pick the two monsters you start with, both at level 5. Nothing is saved. Press M or Escape on the map for the menu.</p>
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
              {[...new Set(TELEPORTS.map((t) => t.group))].map((g) => (
                <optgroup key={g} label={g}>
                  {TELEPORTS.filter((t) => t.group === g).map((t) => <option key={keyOf(t)} value={keyOf(t)}>{t.label}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <button type="button" onClick={go}>Go</button>
          <button type="button" onClick={() => give(giveAllBadges)}>Give me all badges</button>
          <button type="button" onClick={() => give(giveFullTeamAndBag)}>Give me a full team and bag</button>
          <label className="pg-check"><input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} /> More battles (every 2-3 steps in long grass)</label>
          <span className="wp-team">
            {team.map((m, i) => <MonsterArt key={i} species={m.species} size={28} still />)}
          </span>
          <button type="button" onClick={() => { setTeam(null); setTeleport(undefined); setCheat(undefined); setRun((r) => r + 1); }}>Start again</button>
        </div>
      </details>
      <WorldGame key={run} initial={initial} settings={settings} onSettingsChange={change} fast={fast} teleport={teleport} cheat={cheat} {...testing} onBattling={(on) => { setBattling(on); onBattling?.(on); }} />
    </section>
  );
}
