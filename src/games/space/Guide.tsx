/**
 * How to play and the Star chart for Wormholes & Black Holes, in one pop-up with two tabs.
 * Opens from the settings screen, the game (the "How to play" button or the ? key) and the
 * waiting room. Escape or ✕ closes it, and focus goes back to where it was.
 */
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import type { Square, StarKind } from '../../../shared/space/board';
import { MATHS_CHARGE_STEPS } from '../../../shared/space/engine';
import { FACTS } from '../../../shared/space/facts';
import { ITEMS, type ItemKind } from '../../../shared/space/items';
import { SquarePicture } from './SpaceBoard';
import { loadStarChart } from './starChart';
import { GRAVITY_HELP, GRAVITY_NAMES, ITEM_EMOJI, ITEM_HELP, STAR_HELP, STAR_NAMES } from './text';
import './space.css';

export type GuideTab = 'how' | 'chart';

const STAR_ORDER: StarKind[] = [
  'red-dwarf',
  'yellow-star',
  'blue-giant',
  'white-dwarf',
  'binary-star',
  'neutron-star',
  'pulsar',
  'supernova',
  'matariki',
];

const ITEM_ORDER: ItemKind[] = [
  'booster',
  'hyperdrive',
  'navigator',
  'force-field',
  'escape-pod',
  'repair-kit',
  'warp-key',
  'rescue-beacon',
  'tractor-beam',
  'gravity-anchor',
  'space-mine',
  'quantum-swap',
];

function Row({ picture, name, children }: { picture: ReactNode; name: string; children: ReactNode }) {
  return (
    <li className="space-guide__row">
      <span className="space-guide__picture">{picture}</span>
      <span>
        <strong>{name}</strong> {children}
      </span>
    </li>
  );
}

const Emoji = ({ children }: { children: string }) => (
  <span className="space-guide__emoji" aria-hidden="true">
    {children}
  </span>
);

function HowToPlay() {
  return (
    <div className="space-guide__body">
      <section>
        <h3>The race</h3>
        <p>
          Every rocket launches from Earth on square 1. Roll the dice and fly that many squares. The first rocket to dock at
          the space station on the last square wins, and everyone else gets a place by how far they got.
        </p>
        <p>
          <strong>Your turn:</strong> use one item if you want to, then press <strong>Roll</strong>. Tap any square on the board
          to see what it does.
        </p>
      </section>

      <section>
        <h3>Squares</h3>
        <ul className="space-guide__list">
          <Row picture={<SquarePicture square={{ kind: 'wormhole', to: 0 }} />} name="Wormhole.">
            Land on its mouth to zoom up to where it comes out.
          </Row>
          <Row picture={<SquarePicture square={{ kind: 'black-hole', to: 0 }} />} name="Black hole.">
            Land on it and you fall down. A Force Field blocks it.
          </Row>
          {STAR_ORDER.map((star) => (
            <Row key={star} picture={<SquarePicture square={{ kind: 'star', star }} />} name={`${STAR_NAMES[star]}.`}>
              {star === 'matariki' ? 'A sharing star: everyone gets a gift!' : STAR_HELP[star]}
            </Row>
          ))}
          {(['heavy', 'low', 'slingshot'] as const).map((gravity) => (
            <Row key={gravity} picture={<SquarePicture square={{ kind: 'gravity', gravity }} />} name={`${GRAVITY_NAMES[gravity]}.`}>
              {GRAVITY_HELP[gravity]}
            </Row>
          ))}
          <Row picture={<SquarePicture square={{ kind: 'gate', twin: 0 }} />} name="Gate.">
            Jump through to its twin gate, or stay where you are.
          </Row>
          <Row picture={<SquarePicture square={{ kind: 'mystery' }} />} name="Mystery coordinates.">
            Pick one of three cards. Most send you forward, but not all!
          </Row>
          <Row picture={<Emoji>☄️</Emoji>} name="Comet.">
            Land anywhere on its tail to ride up to its head. It moves forward every round.
          </Row>
          <Row picture={<SquarePicture square={{ kind: 'nebula' } as Square} />} name="Nebula.">
            What’s left after a supernova. Nothing happens here.
          </Row>
        </ul>
        <p className="space-guide__note">
          A rocket can only do 3 squares’ worth of zooming in one turn. After that, squares wait until next time.
        </p>
      </section>

      <section>
        <h3>Items</h3>
        <p>
          Stars give you items. You can hold 3. Use one before you roll: tap it, or press 1, 2 or 3. ⭐ means rare. Items
          marked 🎯 slow another rocket down.
        </p>
        <ul className="space-guide__list space-guide__list--items">
          {ITEM_ORDER.map((item) => (
            <Row key={item} picture={<Emoji>{ITEM_EMOJI[item]}</Emoji>} name={`${ITEMS[item].name}${ITEMS[item].rare ? ' ⭐' : ''}${ITEMS[item].kind === 'hinder' ? ' 🎯' : ''}.`}>
              {item === 'rescue-beacon' ? 'Jump forward 10. Only for the rocket in last place, a long way behind.' : ITEM_HELP[item]}
            </Row>
          ))}
        </ul>
      </section>

      <section>
        <h3>Playing fair</h3>
        <ul className="space-guide__bullets">
          <li>Nobody can aim at the rocket in last place.</li>
          <li>A rocket that gets hit is shielded ✨ until its next turn.</li>
          <li>You can’t aim at the same rocket twice in a row.</li>
          <li>No Quantum Swap with a rocket that’s nearly at the station.</li>
          <li>One Space Mine each at a time, and it fizzles out after 5 rounds.</li>
          <li>The rocket in last place gets better items from stars.</li>
          <li>Classic mode has no items at all: just wormholes and black holes.</li>
        </ul>
      </section>

      <section>
        <h3>Cosmic events</h3>
        <p>If they’re switched on, something happens to everyone every 5 rounds:</p>
        <ul className="space-guide__list">
          <Row picture={<Emoji>☀️</Emoji>} name="Solar wind.">
            Everyone gets +1 on their next roll.
          </Row>
          <Row picture={<Emoji>🌠</Emoji>} name="Meteor shower.">
            Asteroids land on 5 squares for one round. Landing on one costs an item (or 1 square if you have none).
          </Row>
          <Row picture={<Emoji>🌀</Emoji>} name="Wormhole shift.">
            One wormhole changes where it comes out.
          </Row>
        </ul>
      </section>

      <section>
        <h3>Fuel ⛽</h3>
        <p>
          Every game has a fuel gauge, so it can’t go on forever. If the fuel runs out before anyone docks, places go by how far
          everyone got. You’ll get a warning 5 rounds before.
        </p>
      </section>

      <section>
        <h3>Mission Control maths 🧮</h3>
        <p>
          If maths is on, you get maths questions. They come from your own maths practice, or from the focus your teacher
          picked, so they match what you’re learning. A wrong answer never costs you anything: the worst that happens is a normal move.
        </p>
        <ul className="space-guide__bullets">
          <li>
            <strong>After your turn:</strong> a question appears on a small card while the others take their turns. Answer
            it and a right answer gives you <strong>+{MATHS_CHARGE_STEPS} on your next roll</strong>. You can skip it.
          </li>
          <li>
            <strong>Wormhole:</strong> land on a wormhole and you get a question. Right, and you’re <strong>powered up</strong>:
            you come out a few squares further on. Wrong, and you ride the wormhole as usual.
          </li>
          <li>
            <strong>Black hole:</strong> land on a black hole and you get a question. Right, and you only fall <strong>half
            as far</strong>. Wrong, and you fall all the way.
          </li>
          <li>Type your answer and press <kbd>Enter</kbd>. Your answers go into your maths records.</li>
        </ul>
      </section>

      <section>
        <h3>Playing classmates</h3>
        <p>
          You have 30 seconds for a turn and 15 seconds for a choice. If you miss 3 turns in a row, autopilot flies your rocket
          so the game goes on for everyone (and you won’t get points for that game). You can take the controls back.
        </p>
        <p>
          With maths on, a wormhole or black hole question has a <strong>20-second</strong> timer. If time runs out, you move
          as usual and nothing is marked wrong.
        </p>
      </section>

      <section>
        <h3>Keys</h3>
        <ul className="space-guide__bullets">
          <li>
            <kbd>Space</kbd> or <kbd>Enter</kbd>: roll.
          </li>
          <li>
            <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd>: use an item, or pick a mystery card. <kbd>1</kbd> to <kbd>6</kbd>: pick
            your Navigator roll.
          </li>
          <li>Arrow keys: move between buttons, like the cards or the rockets to aim at.</li>
          <li>
            <kbd>Esc</kbd>: close things. <kbd>?</kbd>: open this help.
          </li>
        </ul>
      </section>
    </div>
  );
}

function StarChart() {
  const [found] = useState(loadStarChart);
  const count = FACTS.filter((f) => found.has(f.id)).length;
  return (
    <div className="space-guide__body">
      <p>
        Land your rocket on things to discover space facts. You’ve found <strong>{count}</strong> of {FACTS.length}.
        <span className="space-guide__note"> (Your Star chart is kept on this device only.)</span>
      </p>
      <ul className="space-chart">
        {FACTS.map((f) => {
          const known = found.has(f.id);
          return (
            <li key={f.id} className={`space-chart__card${known ? '' : ' is-hidden'}`}>
              <span className="space-chart__emoji" aria-hidden="true">
                {known ? f.emoji : '❔'}
              </span>
              <strong>{f.name}</strong>
              <span>{known ? f.fact : `Not found yet. Land on ${f.star ? 'this star' : 'one'} to find out.`}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function SpaceGuide({ tab: startTab, onClose }: { tab: GuideTab; onClose: () => void }) {
  const [tab, setTab] = useState<GuideTab>(startTab);
  const box = useRef<HTMLDivElement>(null);

  // Focus the dialog when it opens, and give focus back to whatever had it when it closes.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
    return () => before?.focus?.();
  }, []);

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();
      onClose();
      return;
    }
    // Keep Tab inside the pop-up.
    if (event.key === 'Tab' && box.current) {
      const focusable = Array.from(box.current.querySelectorAll<HTMLElement>('button, [href], [tabindex="0"]'));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        last.focus();
        event.preventDefault();
      } else if (!event.shiftKey && document.activeElement === last) {
        first.focus();
        event.preventDefault();
      }
    }
  }

  function tabKeys(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const next: GuideTab = tab === 'how' ? 'chart' : 'how';
    setTab(next);
    box.current?.querySelector<HTMLElement>(`#space-guide-tab-${next}`)?.focus();
    event.preventDefault();
  }

  return (
    <div className="space-guide" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="space-guide__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="space-guide-title"
        ref={box}
        onKeyDown={onKeyDown}
      >
        <div className="space-guide__top">
          <h2 id="space-guide-title" className="sr-only">
            Wormholes &amp; Black Holes help
          </h2>
          <div className="space-guide__tabs" role="tablist" aria-label="Help" onKeyDown={tabKeys}>
            {(
              [
                ['how', '📖 How to play'],
                ['chart', '⭐ Star chart'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                id={`space-guide-tab-${id}`}
                type="button"
                role="tab"
                aria-selected={tab === id}
                aria-controls="space-guide-panel"
                tabIndex={tab === id ? 0 : -1}
                className="space-guide__tab"
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <button type="button" className="space-info__close space-guide__close" onClick={onClose} aria-label="Close help">
            ✕
          </button>
        </div>
        <div id="space-guide-panel" role="tabpanel" aria-labelledby={`space-guide-tab-${tab}`} tabIndex={0} className="space-guide__panel">
          {tab === 'how' ? <HowToPlay /> : <StarChart />}
        </div>
      </div>
    </div>
  );
}
