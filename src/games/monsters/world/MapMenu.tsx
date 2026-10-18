/**
 * The menu on the map (Menu button, or M / Escape): Team, Bag, Monster book, Badges, Settings,
 * and the Monster box (also opened by the box in Harbour Town). All normal HTML in the same
 * Sheet look as the battle screens; walking is locked while one is open. Every change goes
 * through the pure rules in shared/monsters/world/menu.ts.
 */
import { useEffect, useRef, useState } from 'react';
import { TOPICS } from '../../../../shared/maths/skillPacks';
import type { ItemId } from '../../../../shared/monsters/engine';
import { AREAS } from '../../../../shared/monsters/world/areas';
import { applyItem, bookCounts, canHeal, moveToBox, moveToTeam, swapTeam, type MenuResult } from '../../../../shared/monsters/world/menu';
import { ITEM_ORDER } from '../../../../shared/monsters/world/rewards';
import type { WorldState } from '../../../../shared/monsters/world/types';
import { TYPE_LABEL, TYPE_TOPIC } from '../../../../shared/monsters/types';
import { BoxScreen } from '../BoxScreen';
import { HowToPlayBody } from '../HowToPlay';
import { MonsterBookScreen } from '../MonsterBookScreen';
import { ITEM_LABEL } from '../text';
import { BagList, Sheet, TeamList } from '../ui';
import type { WorldSettings } from './settings';

export type MenuPage = 'main' | 'team' | 'bag' | 'book' | 'badges' | 'settings' | 'box' | 'howto';

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
}

const TITLES: Record<MenuPage, string> = { main: 'Menu', team: 'Team', bag: 'Bag', book: 'Monster book', badges: 'Badges', settings: 'Settings', box: 'Monster box', howto: 'How to play' };
const topicLabel = (id: string) => TOPICS.find((t) => t.id === id)?.label ?? id;

export function MapMenu({ page, from, world, settings, onSettingsChange, onGo, onClose, onChange }: MapMenuProps) {
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
      <Sheet title={TITLES[page]} reading={page === 'howto' || page === 'badges'} onBack={back} backLabel={page === 'main' || from === 'object' ? 'Close' : 'Back'}>
        {page === 'main' && (
          <nav aria-label="Menu" className="mm-main">
            {(['team', 'bag', 'book', 'badges', 'settings', 'howto'] as const).map((p) => (
              <button key={p} type="button" className={`mb-btn mm-main__btn mm-main__btn--${p}`} onClick={() => onGo(p)}>
                {TITLES[p]}
                {p === 'book' && <small>{bookCounts(world).owned} owned · {bookCounts(world).seen} met</small>}
                {p === 'badges' && <small>{world.badges.length} of {AREAS.length}</small>}
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
        {page === 'howto' && <HowToPlayBody />}
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
  const [pick, setPick] = useState<number | null>(null);
  return (
    <>
      <p className="mm-help">
        {pick === null ? 'Choose a monster, then choose who to swap places with. The first one goes out first in a battle.' : 'Now choose who to swap places with.'}
      </p>
      <TeamList
        team={world.team}
        active={-1}
        action={(_m, i) => ({ label: pick === null ? 'Swap' : pick === i ? 'Cancel' : 'Swap with', enabled: world.team.length > 1 })}
        onPick={(i) => {
          if (pick === null) setPick(i);
          else if (pick === i) setPick(null);
          else {
            apply(swapTeam(world, pick, i));
            setPick(null);
          }
        }}
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
        return (
          <li key={a.badge} className={`mm-badge${has ? ' is-earned' : ''}`}>
            <span className={`mm-badge__medal mm-badge__medal--${a.type}`} aria-hidden="true">{has ? '★' : ''}</span>
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
