/** Clan Quest, test version: clan creator, the Mines and fights. Nothing is saved; a refresh starts again. */
import { useEffect, useRef, useState } from 'react';
import type { Action } from '../../../shared/clans/actions';
import type { FightState } from '../../../shared/clans/fight';
import type { Clan } from '../../../shared/clans/types';
import type { Draft } from '../../../shared/clans/create';
import { TOPIC_LABELS, TOPICS, YEAR_BANDS, type PracticalTopic, type YearBand } from '../../../shared/maths/practical';
import { CONFIG } from '../../../shared/clans/config';
import { Creator } from './Creator';
import { Fight } from './Fight';
import { MemberCard } from './MemberCard';
import { Church } from './Church';
import { Market } from './Market';
import { Mines, Results } from './Mines';
import { armyToLose, armyToWin, questUsed, barracksAndFill, freshQuest, freshRaid, giveFollowers, giveGold, givePoints, giveVault, knockOutSome } from './places';
import { EmpireHome } from './Empire';
import { Land } from './Land';
import { Barracks } from './Barracks';
import { Raid } from './Raid';
import { Quest } from './Quest';
import { QUESTS } from '../../../shared/clans/quests';
import { Training } from './Training';
import { averageLevel, finishFight, newSession, skipDay, type FightSummary, type Session } from './session';
import { sessionFrom, type ClanServer, type ServerReply } from './remote';
import './clans.css';

type Screen = 'home' | 'mines' | 'fight' | 'results' | 'market' | 'training' | 'church' | 'empire' | 'land' | 'barracks' | 'raid' | 'quest';

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
        <button type="button" className="cq-btn" onClick={() => onChange(giveFollowers(session, 100))}>Give 100 followers (test only)</button>
        <button type="button" className="cq-btn" onClick={() => onChange(giveVault(session, 1000))}>Put 1,000 gold in the vault (test only)</button>
        <button type="button" className="cq-btn" onClick={() => onChange(barracksAndFill(session))}>Build a barracks and fill it (test only)</button>
        <button type="button" className="cq-btn" onClick={() => onChange(armyToWin(session))}>Win the next raid (test only)</button>
        <button type="button" className="cq-btn" onClick={() => onChange(armyToLose(session))}>Lose the next raid (test only)</button>
        <button type="button" className="cq-btn" onClick={() => onChange(freshRaid(session))}>Allow another raid today (test only)</button>
        <button type="button" className="cq-btn" onClick={() => onChange(freshQuest(session))}>Allow another quest today (test only)</button>
        <label>
          Try quest number
          <select value={session.questPick ?? 0} onChange={(e) => onChange({ ...session, questPick: Number(e.target.value) || undefined })}>
            <option value={0}>Today's quest</option>
            {QUESTS.map((q) => <option key={q.id} value={q.id}>{q.id}. {q.title}</option>)}
          </select>
        </label>
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

const NO_FIGHTS_YET = 'Mine fights are not saved on the server yet, so they wait for the next stage.';

/**
 * `initial` starts with a ready-made clan (for tests); normally you make one in the creator.
 * With a `server`, the clan lives on the server: it is loaded when this opens, every change is sent as an action, and
 * what the server answers replaces the browser's copy. With none (the test page), everything stays in the browser.
 */
export function ClanQuest({ seed = Date.now() | 0, initial = null, server }: { seed?: number; initial?: Session | null; server?: ClanServer }) {
  const [session, setSession] = useState<Session | null>(initial);
  const [screen, setScreen] = useState<Screen>('home');
  const [boss, setBoss] = useState(false);
  const [summary, setSummary] = useState<FightSummary | null>(null);
  const [loading, setLoading] = useState<'loading' | 'failed' | null>(server ? 'loading' : null);
  const [serverSeed, setServerSeed] = useState(seed);
  const [notice, setNotice] = useState('');
  /** Actions go to the server one at a time, in the order they were made. */
  const line = useRef<Promise<void>>(Promise.resolve());

  /** How many actions have been sent and not answered yet. */
  const waiting = useRef(0);

  /** Take the server's word. While more actions are still on their way, only the last answer is shown, so the screen does not flicker back. */
  const take = (reply: ServerReply) => {
    setServerSeed(reply.seed);
    if (waiting.current === 0) setSession((previous) => (reply.state ? sessionFrom(reply.state, previous) : previous));
    if (!reply.ok) setNotice(reply.say);
    else if (waiting.current === 0) setNotice('');
  };
  const open = () => {
    if (!server) return;
    setLoading('loading');
    server.send({ type: 'load' }).then((reply) => { take(reply); setLoading(null); }, () => setLoading('failed'));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(open, [server]);

  /** A screen changed something. Show it at once, and (with a server) ask the server to do the same: its answer wins. */
  const change = (next: Session, action?: Action) => {
    if (!server || !action) return setSession(next);
    const before = session;
    setSession(next);
    setNotice('');
    waiting.current++;
    line.current = line.current.then(async () => {
      try {
        const reply = await server.send(action);
        waiting.current--;
        take(reply);
      } catch {
        waiting.current--;
        // Not saved. Ask for the clan as the server has it; if even that fails, put things back as they were.
        try {
          const reply = await server.send({ type: 'load' });
          take(reply);
        } catch {
          setSession(before);
        }
        setNotice("We couldn't reach the server, so that didn't happen. Please try again.");
      }
    });
  };
  const create = (clan: Clan, choices: { name: string; drafts: Draft[] }) => {
    if (!server) return setSession(newSession(clan, seed));
    server.send({ type: 'create', ...choices }).then(take, () => setNotice("We couldn't reach the server, so your clan wasn't made. Please try again."));
    setScreen('home');
  };

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
      {notice && <p className="cq-note" role="alert">{notice}</p>}
      {loading === 'loading' ? (
        <p role="status">Opening your clan…</p>
      ) : loading === 'failed' ? (
        <div className="cq-panel" role="alert">
          <p>We couldn't reach your clan just now.</p>
          <button type="button" className="cq-btn cq-btn--hot" onClick={open}>Try again</button>
        </div>
      ) : !session ? (
        <Creator seed={serverSeed} onDone={(clan, choices) => { create(clan, choices); setScreen('home'); }} />
      ) : (
        <>
          {!server && <SettingsStrip session={session} onChange={setSession} open={screen === 'home'} />}
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
                <button type="button" className="cq-btn" onClick={() => setScreen('empire')}>The Empire</button>
                <button type="button" className="cq-btn" onClick={() => setScreen('quest')}>{questUsed(session) ? 'Quest (done for today)' : 'Quest'}</button>
              </div>
            </section>
          )}
          {screen === 'mines' && (
            <Mines session={session} onDepth={(depth) => setSession({ ...session, depth })} onBack={() => setScreen('home')} onGo={(b) => { setBoss(b); setScreen('fight'); }} locked={server ? NO_FIGHTS_YET : undefined} />
          )}
          {screen === 'market' && <Market session={session} onChange={change} onBack={() => setScreen('home')} />}
          {screen === 'training' && <Training session={session} onChange={change} onBack={() => setScreen('home')} />}
          {screen === 'church' && <Church session={session} onChange={change} onBack={() => setScreen('home')} />}
          {screen === 'empire' && <EmpireHome session={session} onChange={change} onBack={() => setScreen('home')} onLand={() => setScreen('land')} onBarracks={() => setScreen('barracks')} onRaid={() => setScreen('raid')} />}
          {screen === 'barracks' && <Barracks session={session} onChange={change} onBack={() => setScreen('empire')} />}
          {screen === 'raid' && <Raid session={session} onChange={change} onBack={() => setScreen('empire')} />}
          {screen === 'quest' && <Quest key={`${session.day}-${session.questPick ?? 0}`} session={session} onChange={change} onBack={() => setScreen('home')} />}
          {screen === 'land' && <Land session={session} onChange={change} onBack={() => setScreen('empire')} />}
          {screen === 'fight' && <Fight key={session.fightNo} session={session} boss={boss} onFinish={finish} />}
          {screen === 'results' && summary && <Results summary={summary} members={session.clan.members} onDone={() => setScreen('home')} />}
        </>
      )}
      <footer className="cq-credits">Game rules adapted from The Clans by Allen Ussher (1997). Pictures: Kenney's 1-Bit Pack (CC0).</footer>
    </div>
  );
}
