/** How to play, on its own page. Every number is read from the game's settings (shared/glyph/config.ts). */
import { useEffect, useRef } from 'react';
import { GLYPH_CHOICES, GOES_PER_WALL, PASS_FIRST_GO, TEMPLES, WALLS_PER_TEMPLE } from '../../../shared/glyph/config';

export function HowToPlay({ onBack }: { onBack: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <section className="gg-howto" aria-labelledby="gg-how-h">
      <header className="gg-map__top">
        <h2 id="gg-how-h" className="gg-h" tabIndex={-1} ref={heading}>How to play</h2>
        <button type="button" className="gg-btn" onClick={onBack}>Back</button>
      </header>
      <div className="gg-howto__body">
        <section>
          <h3 className="gg-h3">The gold stone</h3>
          <p>Each wall of the temple has a gold stone with a fraction on it. Tap every tile that is worth the same. Tapped tiles glow green. Tap again to put one out.</p>
        </section>
        <section>
          <h3 className="gg-h3">Light the runes</h3>
          <p>When you have your tiles, press <strong>Light the runes</strong>. {GLYPH_CHOICES} glyphs slide out. Pick the one that matches your green tiles, or press "None of them match".</p>
        </section>
        <section>
          <h3 className="gg-h3">Two goes</h3>
          <p>You get {GOES_PER_WALL} goes at each wall. If your first go is not right, you see why, then you try again from your tiles. After a second miss the right tiles light up for you and the wall opens, with no star.</p>
        </section>
        <section>
          <h3 className="gg-h3">Help</h3>
          <p>A fraction bar can sit under the gold stone. The lens lays a tile's bar beside it. The arrows show what the top and bottom were times-ed by. Help never lights a tile for you.</p>
        </section>
        <section>
          <h3 className="gg-h3">Temples</h3>
          <p>{WALLS_PER_TEMPLE} walls make a temple. Open <strong>{PASS_FIRST_GO}</strong> at the first go to pass it and open the next. There are {TEMPLES.length} temples:</p>
          <ol>
            {TEMPLES.map((t) => <li key={t.id}>{t.name}</li>)}
          </ol>
        </section>
      </div>
    </section>
  );
}
