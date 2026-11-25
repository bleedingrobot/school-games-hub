/** How to play, on its own page. Every number is read from the game's settings (shared/starweb/config.ts). */
import { useEffect, useRef } from 'react';
import { ARMS, ARM_GOAL, ARM_NAMES } from '../../../shared/classlive/stars';
import { CREATURES, FREE_AFTER_LIT, GOLD, POINT_SKIES_A_DAY, POINTS, SILVER, WILD_CAP } from '../../../shared/starweb/config';
import { ARM_COLOURS } from '../classlive/arms';

export function HowToPlay({ onBack }: { onBack: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <section className="sw-howto" aria-labelledby="sw-how-h">
      <header className="sw-howto__top">
        <h1 id="sw-how-h" className="sw-title" tabIndex={-1} ref={heading}>How to play</h1>
        <button type="button" className="sw-btn" onClick={onBack}>Back</button>
      </header>
      <section>
        <h2 className="sw-h2">One fact you know</h2>
        <p>A times fact you know well glows in the middle of the sky, like 6 × 7 = 42. Type facts you can work out from it, like 7 × 6 = 42, 42 ÷ 6 = 7 or 12 × 7 = 84, and press <b>Send ⭐</b>. A real keyboard works too: <b>x</b> or <b>*</b> for ×, <b>/</b> for ÷.</p>
      </section>
      <section>
        <h2 className="sw-h2">Seven arms</h2>
        <p>Every true fact that links to the one you know lights a star in one of seven arms, with how we know it.</p>
        <ul className="sw-howto__arms">
          {ARMS.map((a) => <li key={a} style={{ '--arm': ARM_COLOURS[a] } as React.CSSProperties}><b>{ARM_NAMES[a]}</b>: {ARM_GOAL[a]} {ARM_GOAL[a] === 1 ? 'star' : 'stars'} to light it</li>)}
        </ul>
      </section>
      <section>
        <h2 className="sw-h2">Medals</h2>
        <p>Light every arm for <b>bronze</b> and a creature draws itself. Keep going: {SILVER} stars is <b>silver</b>, {GOLD} is <b>gold</b> and a supernova. Only {WILD_CAP} Wild links count towards silver and gold. There is no clock: take your time and think.</p>
      </section>
      <section>
        <h2 className="sw-h2">Stuck?</h2>
        <p>The line under the keypad always says what to try next. If no new star comes for a while, a hint shows, then a bigger one, then <b>Show me</b> with an example on a different fact. You can also press <b>I’m stuck</b>.</p>
      </section>
      <section>
        <h2 className="sw-h2">Your Star Map</h2>
        <p>Each lit sky makes its two times tables glow on your Star Map, at its best medal. {CREATURES.map((c) => `${c.name} joins at ${c.at} tables`).join(', ')}. After {FREE_AFTER_LIT} lit skies you can play a Free sky from any fact you choose.</p>
        <p>Points: {POINTS[1]} for bronze, {POINTS[2]} for silver, {POINTS[3]} for gold, for your first {POINT_SKIES_A_DAY} lit skies each day. Leave a sky whenever you like: your stars are kept and it carries on next time.</p>
      </section>
    </section>
  );
}
