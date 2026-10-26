/**
 * Clans art Stage A.2: the market and the clan home screen in two painted frames, to choose between.
 * Real screens and a pretend clan; nothing is saved. Build: npm run clans:frame. Open #iron-market, #oak-home and so on.
 */
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Market } from '../../src/games/clans/Market';
import { MemberCard } from '../../src/games/clans/MemberCard';
import { averageLevel, makeClan, newSession, startingDrafts, type Session } from '../../src/games/clans/session';
import { giveGold } from '../../src/games/clans/places';
import '../../src/games/clans/clans.css';
import './frames.css';
import { art } from './Sprite';

type Frame = 'iron' | 'oak';
type Screen = 'home' | 'market';
const FRAMES: [Frame, string][] = [['iron', 'Stone and iron'], ['oak', 'Oak and brass']];
const SCREENS: [Screen, string][] = [['home', 'Clan home'], ['market', 'Market']];

function fromHash(): [Frame, Screen] {
  const [f, s] = location.hash.slice(1).split('-');
  return [f === 'oak' ? 'oak' : 'iron', s === 'market' ? 'market' : 'home'];
}

const start = () => giveGold(newSession(makeClan('The Night Owls', startingDrafts(7)), 7), 260);

function Home({ session, go }: { session: Session; go: (s: Screen) => void }) {
  const clan = session.clan;
  return (
    <section aria-label="Your clan">
      <div className="cq-clanhead">
        <img className="cq-clanbanner" src={art('banner-owls')} alt="" />
        <div>
          <h2>{clan.name}</h2>
          <p className="cq-soft">Practising: adding and taking away, times tables</p>
        </div>
      </div>
      <div className="cq-cards">
        {clan.members.map((m, i) => <MemberCard key={m.name} member={m} leader={i === 0} />)}
      </div>
      <p className="cq-sums">Gold: <strong>{clan.gold}</strong> · Followers: <strong>{clan.followers}</strong> · Average level: <strong>{Math.round(averageLevel(clan) * 10) / 10}</strong> · Fame: <strong>{session.fame ?? 0}</strong> (season 1)</p>
      <div className="cq-actions">
        <button type="button" className="cq-btn cq-btn--hot">Go to the Mines</button>
        <button type="button" className="cq-btn" onClick={() => go('market')}>The Market</button>
        <button type="button" className="cq-btn">The Training Hall</button>
        <button type="button" className="cq-btn">The Church</button>
        <button type="button" className="cq-btn">The Empire</button>
        <button type="button" className="cq-btn">Quest</button>
        <button type="button" className="cq-btn">The Village</button>
        <button type="button" className="cq-btn">Village news</button>
        <button type="button" className="cq-btn">Scoreboard</button>
      </div>
    </section>
  );
}

function TryOut() {
  const [[frame, screen], setView] = useState(fromHash);
  const [session, setSession] = useState(start);
  useEffect(() => {
    const on = () => setView(fromHash());
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  const show = (f: Frame, s: Screen) => { history.replaceState(null, '', `#${f}-${s}`); setView([f, s]); };
  const scene = art(screen === 'market' ? 'scene-market' : 'scene-village');
  return (
    <>
      <nav className="tryout-bar" aria-label="Try-out">
        <strong>Try-out:</strong>
        {FRAMES.map(([f, label]) => (
          <button key={f} type="button" aria-pressed={frame === f} onClick={() => show(f, screen)}>{label}</button>
        ))}
        <span className="tryout-gap" />
        {SCREENS.map(([s, label]) => (
          <button key={s} type="button" aria-pressed={screen === s} onClick={() => show(frame, s)}>{label}</button>
        ))}
      </nav>
      <div className={`frame frame--${frame}`}>
        <div className="cq">
          <header className="cq-top">
            <h1>Clan Quest</h1>
            <span className="cq-soft">Day {session.day} · {session.clan.gold} gold</span>
          </header>
          <figure className="cq-scene" style={{ backgroundImage: `url(${scene})` }} aria-hidden="true" />
          {screen === 'home' && <Home session={session} go={(s) => show(frame, s)} />}
          {screen === 'market' && <Market session={session} onChange={(s) => setSession(s)} onBack={() => show(frame, 'home')} />}
          <footer className="cq-credits">Game rules adapted from The Clans by Allen Ussher (1997). Paintings made for School Games Hub.</footer>
        </div>
      </div>
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TryOut />
  </StrictMode>,
);
