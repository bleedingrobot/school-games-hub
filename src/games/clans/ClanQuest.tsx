/** Clan Quest, test version: clan creator, the Mines and fights. Nothing is saved; a refresh starts again. */
import { useState } from 'react';
import type { FightState } from '../../../shared/clans/fight';
import { TOPIC_LABELS, TOPICS, YEAR_BANDS, type PracticalTopic, type YearBand } from '../../../shared/maths/practical';
import { CONFIG } from '../../../shared/clans/config';
import { Creator } from './Creator';
import { Fight } from './Fight';
import { MemberCard } from './MemberCard';
import { Church } from './Church';
import { Market } from './Market';
import { Mines, Results } from './Mines';
import { giveGold, givePoints, knockOutSome } from './places';
import { Training } from './Training';
import { averageLevel, finishFight, newSession, skipDay, type FightSummary, type Session } from './session';
import './clans.css';

type Screen = 'home' | 'mines' | 'fight' | 'results' | 'market' | 'training' | 'church';

/** For James's test only: stands in for the Teacher page, which comes later. */
function SettingsStrip({ session, onChange, open }: { session: Session; onChange: (s: Session) => void; open: boolean }) {
  const s = session.settings;
  const toggle = (t: PracticalTopic) =>
    onChange({ ...session, settings: { ...s, enabledTopics: s.enabledTopics.includes(t) ? s.enabledTopics.filter((x) => x !== t) : [...s.enabledTopics, t] } });
  return (
    <details className="cq-settings" open={open}>
      <summary>Test settings (stand in for the Teacher page)</summary>
      <div className="cq-settings__row">
        <label>
          Year
          <select value={s.yearBand} onChange={(e) => onChange({ ...session, settings: { ...s, yearBand: Number(e.target.value) as YearBand } })}>
            {YEAR_BANDS.map((b) => <option key={b} value={b}>Year {b}</option>)}
          </select>
        </label>
        <label>
          Depth
          <input type="number" min={0} max={CONFIG.maxLevel} value={session.depth} onChange={(e) => onChange({ ...session, depth: Math.max(0, Math.min(CONFIG.maxLevel, Number(e.target.value) || 0)) })} />
        </label>
        <button type="button" className="cq-btn" onClick={() => onChange(skipDay(session))}>Skip a day</button>
        <span className="cq-soft">Day {session.day}</span>
      </div>
      <div className="cq-settings__row" role="group" aria-label="Test shortcuts">
        <button type="button" className="cq-btn" onClick={() => onChange(giveGold(session, 500))}>Give 500 gold (test only)</button>
        <button type="button" className="cq-btn" onClick={() => onChange(givePoints(session, 12))}>Give 12 training points to everyone (test only)</button>
        <button type="button" className="cq-btn" onClick={() => onChange(knockOutSome(session, 2))}>Knock out two members (test only)</button>
      </div>
      <fieldset className="cq-settings__topics">
        <legend>Maths topics</legend>
        {TOPICS.map((t) => (
          <label key={t}>
            <input type="checkbox" checked={s.enabledTopics.includes(t)} onChange={() => toggle(t)} /> {TOPIC_LABELS[t]}
          </label>
        ))}
      </fieldset>
    </details>
  );
}

/** `initial` starts with a ready-made clan (for tests); normally you make one in the creator. */
export function ClanQuest({ seed = Date.now() | 0, initial = null }: { seed?: number; initial?: Session | null }) {
  const [session, setSession] = useState<Session | null>(initial);
  const [screen, setScreen] = useState<Screen>('home');
  const [boss, setBoss] = useState(false);
  const [summary, setSummary] = useState<FightSummary | null>(null);

  const finish = (fight: FightState) => {
    if (!session) return;
    const done = finishFight(session, fight);
    setSession(done.session);
    setSummary(done.summary);
    setScreen('results');
  };

  return (
    <div className="cq">
      <header className="cq-top">
        <h1>Clan Quest</h1>
        <span className="cq-soft">{session ? `${session.clan.name} · ${session.clan.gold} gold · ${session.clan.followers} followers` : 'Test version: nothing is saved'}</span>
      </header>
      {!session ? (
        <Creator seed={seed} onDone={(clan) => { setSession(newSession(clan, seed)); setScreen('home'); }} />
      ) : (
        <>
          <SettingsStrip session={session} onChange={setSession} open={screen === 'home'} />
          {screen === 'home' && (
            <section aria-label="Your clan">
              <h2>{session.clan.name}</h2>
              <p className="cq-soft">Practising: {session.settings.enabledTopics.length ? session.settings.enabledTopics.map((t) => TOPIC_LABELS[t].toLowerCase()).join(', ') : 'nothing today'}</p>
              <div className="cq-cards">
                {session.clan.members.map((m, i) => <MemberCard key={m.name} member={m} leader={i === 0} />)}
              </div>
              <p>Gold: <strong>{session.clan.gold}</strong> · Followers: <strong>{session.clan.followers}</strong> · Average level: <strong>{Math.round(averageLevel(session.clan) * 10) / 10}</strong></p>
              <div className="cq-actions">
                <button type="button" className="cq-btn cq-btn--hot" onClick={() => setScreen('mines')}>Go to the Mines</button>
                <button type="button" className="cq-btn" onClick={() => setScreen('market')}>The Market</button>
                <button type="button" className="cq-btn" onClick={() => setScreen('training')}>The Training Hall</button>
                <button type="button" className="cq-btn" onClick={() => setScreen('church')}>The Church</button>
              </div>
            </section>
          )}
          {screen === 'mines' && (
            <Mines session={session} onDepth={(depth) => setSession({ ...session, depth })} onBack={() => setScreen('home')} onGo={(b) => { setBoss(b); setScreen('fight'); }} />
          )}
          {screen === 'market' && <Market session={session} onChange={setSession} onBack={() => setScreen('home')} />}
          {screen === 'training' && <Training session={session} onChange={setSession} onBack={() => setScreen('home')} />}
          {screen === 'church' && <Church session={session} onChange={setSession} onBack={() => setScreen('home')} />}
          {screen === 'fight' && <Fight key={session.fightNo} session={session} boss={boss} onFinish={finish} />}
          {screen === 'results' && summary && <Results summary={summary} members={session.clan.members} onDone={() => setScreen('home')} />}
        </>
      )}
      <footer className="cq-credits">Game rules adapted from The Clans by Allen Ussher (1997). Pictures: Kenney's 1-Bit Pack (CC0).</footer>
    </div>
  );
}
