/**
 * The menu on the map (Menu button, or M / Escape): Team, Bag, Monster book, Badges, Settings,
 * Change my look (once the painted looks are there), and the Monster box (also opened by the box in Harbour Town). All normal HTML in the same
 * Sheet look as the battle screens; walking is locked while one is open. Every change goes
 * through the pure rules in shared/monsters/world/menu.ts.
 */
import { useEffect, useRef, useState } from 'react';
import { TOPICS } from '../../../../shared/maths/skillPacks';
import type { ItemId } from '../../../../shared/monsters/engine';
import { AREAS } from '../../../../shared/monsters/world/areas';
import { applyItem, bookCounts, canHeal, moveToBox, moveToFront, moveToTeam, type MenuResult } from '../../../../shared/monsters/world/menu';
import { ITEM_ORDER } from '../../../../shared/monsters/world/rewards';
import type { WorldState } from '../../../../shared/monsters/world/types';
import { TYPE_LABEL, TYPE_TOPIC } from '../../../../shared/monsters/types';
import { badgePic } from '../art/painted';
import { BoxScreen } from '../BoxScreen';
import { HowToPlayBody } from '../HowToPlay';
import { hasLooks, LookPicker, lookName } from '../LookPicker';
import { MonsterBookScreen } from '../MonsterBookScreen';
import { ITEM_LABEL } from '../text';
import { BagList, Sheet, TeamList } from '../ui';
import type { WorldSettings } from './settings';
import type { GameMap } from '../../../../shared/monsters/world/types';
import { questOf, type QuestOptions } from '../../../../shared/monsters/world/questWorld';
import { BoardPage, EggPage, QuestLogPage, TinkerPage } from './QuestPages';
import { PuzzlePage } from './PuzzlePage';
import { puzzleById } from '../../../../shared/monsters/quests/puzzles';

export type MenuPage = 'main' | 'team' | 'bag' | 'book' | 'badges' | 'settings' | 'box' | 'howto' | 'look' | 'quests' | 'eggs' | 'tinker' | 'board' | 'puzzle';

export interface MapMenuProps {
  page: MenuPage;
  /** Opened from the Menu (Back goes to the Menu) or from an object on the map such as the box (Back goes to the map). */
  from: 'menu' | 'object';
  world: WorldState;
  settings: WorldSettings;
  onSettingsChange: (s: WorldSettings) => void;
  onGo: (page: MenuPage) => void;
  onClose: () => void;
  onChange: (next: WorldState) => void;
  /** The map you are on (the egg basket hatches here) and today's day, pupil and play days. */
  map?: GameMap;
  questOpts?: QuestOptions;
  /** The puzzle on the puzzle page (its id in quests/puzzles.ts). */
  puzzle?: string;
}

const TITLES: Record<MenuPage, string> = { main: 'Menu', team: 'Team', bag: 'Bag', book: 'Monster book', badges: 'Badges', settings: 'Settings', box: 'Monster box', howto: 'How to play', look: 'Change my look', quests: 'Quests', eggs: 'Egg basket', tinker: 'The Tinker', board: 'Notice board', puzzle: 'Puzzle' };
const topicLabel = (id: string) => TOPICS.find((t) => t.id === id)?.label ?? id;

export function MapMenu({ page, from, world, settings, onSettingsChange, onGo, onClose, onChange, map, questOpts = {}, puzzle }: MapMenuProps) {
  const root = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState('');
  const back = () => (page === 'main' || from === 'object' ? onClose() : onGo('main'));

  // Each page puts the keyboard on its first button, so a screen reader reads from the top.
  useEffect(() => {
    setMessage('');
    root.current?.querySelector<HTMLElement>('button:not(:disabled), input')?.focus({ preventScroll: true });
  }, [page]);

  const apply = (r: MenuResult) => {
    if (r.ok) {
      onChange(r.state);
      setMessage(r.message);
    } else setMessage(r.why);
  };

  return (
    <div
      ref={root}
      className="mm"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          back();
        } else if ((e.key === 'm' || e.key === 'M') && !(e.target instanceof HTMLInputElement)) {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <Sheet title={page === 'puzzle' ? (puzzleById(puzzle ?? '')?.title ?? TITLES.puzzle) : TITLES[page]} reading={page === 'howto' || page === 'badges'} onBack={back} backLabel={page === 'main' || from === 'object' ? 'Close' : 'Back'}>
        {page === 'main' && (
          <nav aria-label="Menu" className="mm-main">
            {(['team', 'bag', 'quests', 'eggs', 'book', 'badges', 'settings', 'howto', ...(hasLooks() ? ['look' as const] : [])] as const).map((p) => (
              <button key={p} type="button" className={`mb-btn mm-main__btn mm-main__btn--${p}`} onClick={() => onGo(p)}>
                {TITLES[p]}
                {p === 'book' && <small>{bookCounts(world).owned} owned · {bookCounts(world).seen} met</small>}
                {p === 'badges' && <small>{world.badges.length} of {AREAS.length}</small>}
                {p === 'look' && <small>{world.look ? lookName(world.look) : 'Not chosen yet'}</small>}
                {p === 'quests' && <small>{Object.keys(questOf(world).quests).length} going</small>}
                {p === 'eggs' && <small>{questOf(world).eggs.length} of 3</small>}
                {p === 'team' && <small>{world.team.length} of 6{world.box.length ? `, ${world.box.length} in the box` : ''}</small>}
              </button>
            ))}
            <button type="button" className="mb-btn mb-btn--primary mm-main__go" onClick={onClose}>Back to the map</button>
          </nav>
        )}
        {page === 'team' && <TeamPage world={world} apply={apply} />}
        {page === 'bag' && <BagPage world={world} apply={apply} />}
        {page === 'book' && <MonsterBookScreen seen={world.seen} owned={world.owned} />}
        {page === 'badges' && <BadgesPage world={world} />}
        {page === 'quests' && <QuestLogPage world={world} />}
        {page === 'eggs' && map && <EggPage world={world} apply={apply} map={map} opts={questOpts} />}
        {page === 'tinker' && <TinkerPage world={world} apply={apply} />}
        {page === 'board' && <BoardPage world={world} apply={apply} opts={questOpts} />}
        {page === 'puzzle' && puzzle && <PuzzlePage world={world} apply={apply} id={puzzle} opts={questOpts} />}
        {page === 'howto' && <HowToPlayBody />}
        {page === 'look' && (
          <LookPicker
            value={world.look}
            onChange={(look) => {
              onChange({ ...world, look });
              setMessage(`Your look is now ${lookName(look)}.`);
            }}
          />
        )}
        {page === 'box' && (
          <BoxScreen
            team={world.team}
            box={world.box}
            onToBox={(i) => apply(moveToBox(world, i))}
            onToTeam={(i) => apply(moveToTeam(world, i))}
          />
        )}
        {page === 'settings' && (
          <div className="mm-settings">
            <label><input type="checkbox" checked={settings.calm} onChange={(e) => onSettingsChange({ ...settings, calm: e.target.checked })} /> Calm (no quick-answer bonus, nothing timed)</label>
            <label><input type="checkbox" checked={settings.multipleChoice} onChange={(e) => onSettingsChange({ ...settings, multipleChoice: e.target.checked })} /> Choose answers (instead of the number pad)</label>
            <label><input type="checkbox" checked={settings.dpad} onChange={(e) => onSettingsChange({ ...settings, dpad: e.target.checked })} /> On-screen arrows (for touch screens)</label>
            <p className="mb-empty">Sound follows the speaker button at the top of the page.</p>
          </div>
        )}
        <p className="mm-msg" role="status" aria-live="polite">{message}</p>
      </Sheet>
    </div>
  );
}

function TeamPage({ world, apply }: { world: WorldState; apply: (r: MenuResult) => void }) {
  return (
    <>
      <p className="mm-help">Your first monster goes out first in a battle. Tap Go first on the one you want to send out.</p>
      <TeamList
        team={world.team}
        active={-1}
        action={(_m, i) => (i === 0 ? { label: 'Goes first', enabled: false } : { label: 'Go first', enabled: true })}
        onPick={(i) => apply(moveToFront(world, i))}
      />
    </>
  );
}

function BagPage({ world, apply }: { world: WorldState; apply: (r: MenuResult) => void }) {
  const [item, setItem] = useState<ItemId | null>(null);
  const [note, setNote] = useState('');
  const hurt = world.team.some((_, i) => canHeal(world, i) === null);
  if (item) {
    return (
      <>
        <p className="mm-help">Use the {ITEM_LABEL[item]} on which monster?</p>
        <TeamList
          team={world.team}
          active={-1}
          action={(_m, i) => ({ label: 'Heal', enabled: canHeal(world, i) === null })}
          onPick={(i) => {
            apply(applyItem(world, item, i));
            setItem(null);
          }}
        />
        <button type="button" className="mb-btn mb-btn--small mm-cancel" onClick={() => setItem(null)}>Cancel</button>
      </>
    );
  }
  return (
    <>
      {world.repel > 0 && <p className="mm-help">Repel is working: {world.repel} more steps in long grass with no wild battles.</p>}
      {note && <p className="mm-help" role="status">{note}</p>}
      <BagList
        bag={world.bag}
        wild={false}
        items={[...ITEM_ORDER]}
        ballNote="Balls are thrown in a battle, at a wild monster."
        onPick={(it) => {
          setNote('');
          if (it === 'repel') apply(applyItem(world, 'repel'));
          else if (it === 'potion' || it === 'super-potion') {
            if (hurt) setItem(it);
            else setNote('Nobody needs it right now: every monster is at full health or tired out (a rest at a healing spot helps those).');
          }
        }}
      />
    </>
  );
}

function BadgesPage({ world }: { world: WorldState }) {
  return (
    <ul className="mm-badges" aria-label="Badges">
      {AREAS.map((a) => {
        const has = world.badges.includes(a.badge);
        const pic = badgePic(a.badge);
        return (
          <li key={a.badge} className={`mm-badge${has ? ' is-earned' : ''}`}>
            {/* The painted badge, greyed out until it is won; decorative, since the words say which badge and whether you have it. */}
            {pic ? (
              <img className="mm-badge__pic" src={pic} alt="" decoding="async" draggable={false} />
            ) : (
              <span className={`mm-badge__medal mm-badge__medal--${a.type}`} aria-hidden="true">{has ? '★' : ''}</span>
            )}
            <span className="mm-badge__text">
              <strong>{TYPE_LABEL[a.type]} badge</strong>
              <small>{topicLabel(TYPE_TOPIC[a.type])}</small>
              <small>{has ? 'Earned!' : `Win it in the ${TYPE_LABEL[a.type]} Tower, ${a.name}`}</small>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
