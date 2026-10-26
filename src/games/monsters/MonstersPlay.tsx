/**
 * Maths Monsters for the signed-in student: loads their saved game (or starts a new one), and saves
 * as they play. Saving moments: a new game, a healing spot, after a Tower battle, on getting a badge,
 * every few minutes, and when the page is hidden or closed. See src/data/monsters.ts.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FactStats } from '../../../shared/maths/leitner';
import { makePack, type TopicId } from '../../../shared/maths/skillPacks';
import { WORLD_MAPS } from '../../../shared/monsters/maps';
import type { BattleReport } from '../../../shared/monsters/save/check';
import type { TypeId } from '../../../shared/monsters/types';
import type { WorldState } from '../../../shared/monsters/world/types';
import { newWorld } from '../../../shared/monsters/world/world';
import { useAuth } from '../../auth/AuthContext';
import {
  enqueueSave, flushQueue, loadMonsters, readTail, savingStopped, writeTail, type FlushResult, type MonstersData, type Tail,
} from '../../data/monsters';
import { StartScreen } from './StartScreen';
import { loadWorldSettings, saveWorldSettings, type WorldSettings } from './world/settings';
import { WorldGame } from './world/WorldGame';

/** How often a long stretch of play is saved (milliseconds). */
export const AUTOSAVE_MS = 3 * 60_000;

export const WORDS = {
  loading: 'Opening the map…',
  saved: 'Your game is saved to your account.',
  later: 'Saving later: your game is safe on this Chromebook and goes up when the internet is back.',
  stopped: 'Your game couldn’t be saved this time. You can keep playing, and next time you open Maths Monsters you’ll carry on from your last save.',
  closed: 'Maths Monsters isn’t open yet. Check back soon!',
  cantLoad: 'We couldn’t open your game. Check the internet and try again.',
};

type Status = 'saved' | 'later' | 'stopped';

export function MonstersPlay() {
  const { profile } = useAuth();
  const player = profile?.id ?? '';
  const [data, setData] = useState<MonstersData | null>(null);
  const [tryAgain, setTryAgain] = useState(0);
  const [status, setStatus] = useState<Status>('saved');
  const [initial, setInitial] = useState<WorldState | null>(null);
  const [settings, setSettings] = useState<WorldSettings>(loadWorldSettings);

  const tail = useRef<Tail | null>(null);
  const latest = useRef<WorldState | null>(null);
  const dirty = useRef(false);
  const heal = useRef('');
  const badges = useRef(0);
  const battling = useRef(false);
  const afterBattle = useRef(false);
  const packs = useRef(new Map<TopicId, ReturnType<typeof makePack>>());

  useEffect(() => {
    let current = true;
    setData(null);
    void loadMonsters(player).then((loaded) => {
      if (!current) return;
      packs.current.clear();
      tail.current = loaded.tail;
      latest.current = loaded.tail?.world ?? null;
      heal.current = loaded.tail ? healKey(loaded.tail.world) : '';
      badges.current = loaded.tail?.world.badges.length ?? 0;
      dirty.current = (loaded.tail?.battles.length ?? 0) > 0;
      setInitial(loaded.tail?.world ?? null);
      setStatus(loaded.offline ? 'later' : 'saved');
      setData(loaded);
      // Anything fought on this device since its last save goes up now.
      if (!loaded.offline && dirty.current) saveNow();
    });
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, tryAgain]);

  const report = useCallback((result: FlushResult) => setStatus(result === 'done' ? 'saved' : result === 'refused' ? 'stopped' : 'later'), []);

  /** Puts everything since the last save in the queue and sends it. */
  const saveNow = useCallback(
    (keepalive = false) => {
      const t = tail.current;
      const world = latest.current;
      if (!t || !world || savingStopped(player)) return;
      if (dirty.current || t.start || t.battles.length) {
        const seq = t.base + 1;
        enqueueSave(player, {
          saveId: crypto.randomUUID(), seq, at: Date.now(), ...(t.start ? { start: t.start } : {}), world, battles: t.battles,
        });
        tail.current = { base: seq, world, battles: [] };
        writeTail(player, tail.current);
        dirty.current = false;
      }
      void flushQueue(player, keepalive).then(report);
    },
    [player, report],
  );

  // Every few minutes of play, and when the page goes away.
  useEffect(() => {
    if (!data) return;
    const timer = window.setInterval(() => {
      if (dirty.current && !battling.current) saveNow();
    }, AUTOSAVE_MS);
    // The page is being hidden or closed: send what there is (keepalive lets the request finish).
    const hide = (e: Event) => {
      if (e.type === 'pagehide' || document.visibilityState === 'hidden') saveNow(true);
    };
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', hide);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', hide);
    };
  }, [data, saveNow]);

  const onState = useCallback(
    (world: WorldState) => {
      latest.current = world;
      dirty.current = true;
      if (tail.current) tail.current = { ...tail.current, world };
      const h = healKey(world);
      const moment = h !== heal.current || world.badges.length > badges.current || afterBattle.current;
      heal.current = h;
      badges.current = world.badges.length;
      if (moment && !battling.current) {
        afterBattle.current = false;
        saveNow();
      } else if (tail.current) writeTailSoon(player, tail.current);
    },
    [player, saveNow],
  );

  const onBattle = useCallback(
    (battle: BattleReport, trainer?: { badge?: string }) => {
      if (!tail.current) return;
      tail.current = { ...tail.current, battles: [...tail.current.battles, battle] };
      writeTail(player, tail.current);
      dirty.current = true;
      // A Tower battle is saved as soon as the world has carried on (the next state).
      if (trainer?.badge) afterBattle.current = true;
    },
    [player],
  );

  function begin(picks: [TypeId, TypeId], team: ReturnType<typeof import('../../../shared/monsters/world/start').startTeam>, look?: string) {
    const world = { ...newWorld({ maps: WORLD_MAPS }, team, Math.floor(Math.random() * 2 ** 31)), ...(look ? { look } : {}) };
    tail.current = { base: 0, world, battles: [], start: picks };
    latest.current = world;
    heal.current = healKey(world);
    badges.current = 0;
    writeTail(player, tail.current);
    setInitial(world);
    saveNow();
  }

  const topicFacts = useCallback(
    (topic: TopicId): FactStats[] => (data?.facts ?? []).filter((f) => f.pack === topic),
    [data],
  );
  const packFor = useMemo(
    () => (topic: TopicId) => {
      let pack = packs.current.get(topic);
      if (!pack) {
        pack = makePack(topic, topicFacts(topic));
        packs.current.set(topic, pack);
      }
      return pack;
    },
    [topicFacts],
  );

  if (!data) {
    return (
      <p className="panel__empty" role="status">
        {WORDS.loading}
      </p>
    );
  }
  if (!data.settings.enabled && !data.offline) return <p className="panel__empty">{WORDS.closed}</p>;
  if (!initial) {
    if (data.offline) {
      return (
        <div className="panel__empty" role="alert">
          <p>{WORDS.cantLoad}</p>
          <button type="button" className="button button--primary" onClick={() => setTryAgain((n) => n + 1)}>
            Try again
          </button>
        </div>
      );
    }
    return <StartScreen onStart={begin} />;
  }
  return (
    <div className="mp-play">
      <WorldGame
        initial={initial}
        settings={settings}
        onSettingsChange={(s) => {
          setSettings(s);
          saveWorldSettings(s);
        }}
        onState={onState}
        onBattle={onBattle}
        // The nurse healed the team: that is a place to save (after this step has finished updating).
        onMoment={() => window.setTimeout(() => saveNow(), 0)}
        onBattling={(on) => {
          battling.current = on;
        }}
        enabledTopics={data.settings.topics}
        packFor={packFor}
      />
      <p className="mp-play__note" role="status">
        {status === 'saved' ? WORDS.saved : status === 'later' ? WORDS.later : WORDS.stopped}
      </p>
    </div>
  );
}

/** Where you would wake up: changes when you talk to a nurse. */
const healKey = (w: WorldState) => `${w.heal.map}:${w.heal.x}:${w.heal.y}`;

/** The device copy is written at most every 2 seconds while walking. */
let pending: number | undefined;
function writeTailSoon(player: string, tail: Tail) {
  if (pending !== undefined) return;
  pending = window.setTimeout(() => {
    pending = undefined;
    const t = readTail(player);
    // Never write over a newer tail (a save moved on) with an old one.
    if (t && t.base === tail.base) writeTail(player, { ...t, world: tail.world });
  }, 2000);
}
