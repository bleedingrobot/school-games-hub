/** Clan Quest, test version: clan creator, the Mines and fights. Nothing is saved; a refresh starts again. */
import { useEffect, useRef, useState } from 'react';
import type { Action } from '../../../shared/clans/actions';
import type { ShownFight } from '../../../shared/clans/actions';
import type { RecordedRound } from '../../../shared/clans/battleCry';
import type { FightState } from '../../../shared/clans/fight';
import type { Clan } from '../../../shared/clans/types';
import type { Draft } from '../../../shared/clans/create';
import { TOPIC_LABELS, TOPICS, YEAR_BANDS, type PracticalTopic, type YearBand } from '../../../shared/maths/practical';
import { CONFIG } from '../../../shared/clans/config';
import { Creator } from './Creator';
import { Fight, type CryChecked } from './Fight';
import { MemberCard } from './MemberCard';
import { Church } from './Church';
import { Market } from './Market';
import { Mines, Results } from './Mines';
import { armyToLose, armyToWin, changeLook, questToday, questUsed, barracksAndFill, freshQuest, freshRaid, giveFollowers, giveGold, givePoints, giveVault, knockOutSome, pretendGifts, pretendWeekEnd } from './places';
import { ClassRaid } from './ClassRaid';
import { Village } from './Village';
import { VillageNews } from './VillageNews';
import { EmpireHome } from './Empire';
import { Land } from './Land';
import { Barracks } from './Barracks';
import { Raid } from './Raid';
import { Quest } from './Quest';
import { QUESTS } from '../../../shared/clans/quests';
import { Training } from './Training';
import { Scoreboard } from './Scoreboard';
import { HowToPlay } from './HowToPlay';
import { Achievements, Celebration } from './Achievements';
import { awardNext, giveFame, newSeason, type ScoreRow } from './fame';
import { ACHIEVEMENTS, fameFor, type AchievementDef } from '../../../shared/clans/rewards';
import { averageLevel, earn, finishFight, newSession, skipDay, type FightSummary, type Session } from './session';
import { sessionFrom, type ClanServer, type ServerReply } from './remote';
import { bannerArt, questArt, sceneArt, type SceneId } from './art';
import './clans.css';

type Screen = 'home' | 'mines' | 'fight' | 'results' | 'market' | 'training' | 'church' | 'empire' | 'land' | 'barracks' | 'raid' | 'quest' | 'village' | 'news' | 'classraid' | 'scoreboard' | 'achievements' | 'howto';

/** The painting across the top of each screen. Home and Land have none of their own, so they borrow the village and the empire. The fight has none across the top (its mine zone is painted behind the
 * monsters, to keep the fight on one screen); its results get one from how it went (`afterFight`). */
const SCENE_FOR: Partial<Record<Screen, SceneId>> = {
  home: 'village', mines: 'mines', market: 'market', training: 'training', church: 'church', empire: 'empire', land: 'empire', barracks: 'barracks',
  raid: 'raid', classraid: 'raid', quest: 'quests', village: 'village', news: 'news', scoreboard: 'scoreboard',
};

/** A wide painting, the 800 copy on phones. Only decoration, so screen readers skip it. */
function Scene({ name, art: { wide, small } }: { name: string; art: { wide?: string; small?: string } }) {
  if (!wide) return null;
  return <img className="cq-scene" src={wide} srcSet={small && small !== wide ? `${small} 800w, ${wide} 1600w` : undefined} sizes="(max-width: 1100px) 100vw, 1100px" alt="" data-scene={name} />;
}

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
        <button type="button" className="cq-btn" onClick={() => onChange(pretendGifts(session, 200))}>Pretend classmates give 200 gold (test only)</button>
        <button type="button" className="cq-btn" onClick={() => onChange(pretendWeekEnd(session))}>End the village week now (test only)</button>
        <button type="button" className="cq-btn" onClick={() => onChange(giveFame(session, 10))}>Give 10 fame (test only)</button>
        <button type="button" className="cq-btn" onClick={() => onChange(earn(session, { bosses: 1 }))}>Beat a boss: 5 fame and an achievement (test only)</button>
        <button type="button" className="cq-btn" onClick={() => onChange(awardNext(session))}>Earn the next achievement (test only)</button>
        <button type="button" className="cq-btn" onClick={() => onChange(newSeason(session))}>Start a new season: fame back to 0 (test only)</button>
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

/**
 * `initial` starts with a ready-made clan (for tests); normally you make one in the creator.
 * With a `server`, the clan lives on the server: it is loaded when this opens, every change is sent as an action, and
 * what the server answers replaces the browser's copy. With none (the test page), everything stays in the browser.
 */
export function ClanQuest({ seed = Date.now() | 0, initial = null, server, board }: { seed?: number; initial?: Session | null; server?: ClanServer; board?: () => Promise<ScoreRow[]> }) {
  const [session, setSession] = useState<Session | null>(initial);
  const [screen, setScreen] = useState<Screen>('home');
  const [boss, setBoss] = useState(false);
  const [summary, setSummary] = useState<FightSummary | null>(null);
  const [loading, setLoading] = useState<'loading' | 'failed' | 'off' | null>(server ? 'loading' : null);
  /** With a server: the fight being played, as the server has it. */
  const [activeFight, setActiveFight] = useState<ShownFight | null>(null);
  const [fightKey, setFightKey] = useState(0);
  const activeRef = useRef<ShownFight | null>(null);
  /** What the server said when the last round ended the fight (it has been paid). */
  const outcome = useRef<FightSummary | null>(null);
  const [serverSeed, setServerSeed] = useState(seed);
  const [notice, setNotice] = useState('');
  /** Achievements just earned, shown with a small celebration. The first clan the screen sees is not celebrated: those were earned before. */
  const [celebrate, setCelebrate] = useState<AchievementDef[]>([]);
  const knownAchievements = useRef<string[] | null>(null);
  /** The fame the last fight earned (the server's word), for the results screen. */
  const fameEarned = useRef(0);
  /** When a new screen opens, focus its heading so a keyboard or screen-reader user starts at the top of it (not on a button that is gone). */
  const root = useRef<HTMLDivElement>(null);
  const firstScreen = useRef(true);
  useEffect(() => {
    if (firstScreen.current) {
      firstScreen.current = false;
      return;
    }
    if (screen === 'fight') return;
    const heading = root.current?.querySelector<HTMLElement>('section h2, section h1');
    // A screen that has already put focus on its own first button (the quest does) keeps it.
    const now = document.activeElement;
    if (now && now !== document.body && root.current?.querySelector('section')?.contains(now)) return;
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
  }, [screen]);
  /** Actions go to the server one at a time, in the order they were made. */
  const line = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (!session) return;
    const now = session.achievements ?? [];
    if (knownAchievements.current === null) {
      knownAchievements.current = now;
      return;
    }
    const before = knownAchievements.current;
    knownAchievements.current = now;
    const fresh = ACHIEVEMENTS.filter((a) => now.includes(a.id) && !before.includes(a.id));
    if (fresh.length) setCelebrate(fresh);
  }, [session]);

  /** How many actions have been sent and not answered yet. */
  const waiting = useRef(0);

  /** Take the server's word. While more actions are still on their way, only the last answer is shown, so the screen does not flicker back. */
  const take = (reply: ServerReply) => {
    setServerSeed(reply.seed);
    if (waiting.current === 0) {
      setSession((previous) => (reply.state ? sessionFrom(reply.state, previous) : previous));
      // A fight is open on the server (this was opened after a refresh, or on another Chromebook): go straight back to it.
      const open = reply.state?.fight;
      if (open && !activeRef.current) {
        activeRef.current = open;
        setActiveFight(open);
        setScreen('fight');
      }
    }
    if (!reply.ok) setNotice(reply.say);
    else if (waiting.current === 0) setNotice('');
  };
  /** The server's copy of the fight is the truth: show the fight again from it, or leave if it is over. */
  const resyncFight = (fight: ShownFight | null | undefined) => {
    activeRef.current = fight ?? null;
    setActiveFight(fight ?? null);
    setFightKey((k) => k + 1);
    if (!fight) setScreen('home');
  };
  const open = () => {
    if (!server) return;
    setLoading('loading');
    server.send({ type: 'load' }).then((reply) => { take(reply); setLoading(null); }, (error) => setLoading((error as { off?: boolean }).off ? 'off' : 'failed'));
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
  /** Send an action to the server and give back its answer (for screens that need the answer, like a raid). Same line as every other action. */
  const ask = server
    ? (action: Action) =>
        new Promise<ServerReply>((resolve, reject) => {
          waiting.current++;
          line.current = line.current.then(async () => {
            try {
              const reply = await server.send(action);
              waiting.current--;
              take(reply);
              resolve(reply);
            } catch (error) {
              waiting.current--;
              reject(error);
            }
          });
        })
    : undefined;
  const create = (clan: Clan, choices: { name: string; drafts: Draft[] }) => {
    if (!server) return setSession(newSession(clan, seed));
    server.send({ type: 'create', ...choices }).then(take, () => setNotice("We couldn't reach the server, so your clan wasn't made. Please try again."));
    setScreen('home');
  };

  /** Start a mine fight. With a server it asks for one (the server picks the monsters and takes a fight off today's count). */
  const startFight = (b: boolean) => {
    if (!server || !session) {
      setBoss(b);
      setScreen('fight');
      return;
    }
    waiting.current++;
    line.current = line.current.then(async () => {
      try {
        // `ladder`: this screen can show Battle Cry questions from the child's own maths.
        const reply = await server.send({ type: 'fightStart', depth: session.depth, boss: b, ladder: true });
        waiting.current--;
        take(reply);
        if (reply.ok && reply.state?.fight) {
          activeRef.current = reply.state.fight;
          setActiveFight(reply.state.fight);
          setScreen('fight');
        }
      } catch {
        waiting.current--;
        setNotice("We couldn't reach the server, so the fight didn't start. Please try again.");
      }
    });
  };
  /** Each round played is sent as it happens, so the server keeps the fight. Its answer says when the fight is over and paid. */
  const sendRound = (round: number, played: RecordedRound) => {
    if (!server) return;
    waiting.current++;
    line.current = line.current.then(async () => {
      try {
        const reply = await server.send({ type: 'fightRound', round, orders: played.orders, cry: played.cry });
        waiting.current--;
        take(reply);
        if (reply.ok && reply.result.type === 'fightRound' && reply.result.over) {
          outcome.current = reply.result.summary;
          fameEarned.current = reply.result.earned ? fameFor(reply.result.earned) : 0;
          activeRef.current = null;
        } else if (reply.ok && reply.state?.fight) {
          // The server's copy, with this round in it, in case the fight has to be shown again.
          activeRef.current = reply.state.fight;
        } else if (!reply.ok) {
          resyncFight(reply.state?.fight);
        }
      } catch {
        waiting.current--;
        try {
          const reply = await server.send({ type: 'load' });
          take(reply);
          resyncFight(reply.state?.fight);
        } catch {
          // Nothing more to do: the fight is safe on the server and is shown again when the connection is back.
        }
        setNotice("We couldn't reach the server, so that round wasn't saved. Please try again.");
      }
    });
  };
  /** A ladder fight's Battle Cry answer, marked by the server (in the same line as the rounds, so they stay in order). */
  const checkCry = async (round: number, answer: number, ms: number): Promise<CryChecked> => {
    const reply = await ask!({ type: 'cryCheck', round, answer, ms }).catch(() => {
      throw new Error('We couldn’t reach the server to check that. Try again.');
    });
    if (!reply.ok || reply.result.type !== 'cryCheck') throw new Error(reply.ok ? 'We couldn’t check that one. Try again.' : reply.say);
    // Keep the server's copy with this mark, so showing the fight again replays it the same way.
    if (reply.state?.fight) activeRef.current = reply.state.fight;
    return { correct: reply.result.correct, answer: reply.result.answer, given: reply.result.given };
  };
  /** The fight screen is done. With a server, wait for the answer to the last round, then show how it went. */
  const finishServer = () => {
    line.current = line.current.then(() => {
      const summary = outcome.current;
      outcome.current = null;
      if (summary) {
        setSummary(summary);
        setActiveFight(null);
        setScreen('results');
      } else if (activeRef.current) {
        setNotice('The server has not finished that fight yet. Here it is again.');
        resyncFight(activeRef.current);
      }
    });
  };

  const finish = (fight: FightState) => {
    if (!session) return;
    const done = finishFight(session, fight, boss);
    setSession(done.session);
    fameEarned.current = done.fame;
    setSummary(done.summary);
    setScreen('results');
  };

  // After a fight: the victory painting for a win, the rest painting when the clan was knocked out, the Mines otherwise.
  const afterFight: SceneId | undefined = screen === 'results' && summary ? (summary.result === 'won' ? 'victory' : summary.result === 'lost' ? 'rest' : 'mines') : undefined;
  const scene = loading !== null ? undefined : session ? afterFight ?? SCENE_FOR[screen] : 'creator';
  // Today's quest has its own painting (all day, done or not); the general one is only for a day with no quest.
  const quest = screen === 'quest' && session ? questToday(session) : null;

  return (
    <div className="cq" ref={root}>
      <header className="cq-top">
        <h1>Clan Quest</h1>
        <span className="cq-soft">{session ? `${session.clan.name} · ${session.clan.gold} gold · ${session.clan.followers} followers · ${session.fame ?? 0} fame` : 'Test version: nothing is saved'}</span>
      </header>
      {quest ? <Scene key={`quest-${quest.id}`} name={`quest-${quest.id}`} art={questArt(quest.title)} /> : scene && <Scene key={scene} name={scene} art={sceneArt(scene)} />}
      <Celebration fresh={celebrate} onClose={() => setCelebrate([])} />
      {notice && <p className="cq-note" role="alert">{notice}</p>}
      {loading === 'loading' ? (
        <p role="status">Opening your clan…</p>
      ) : loading === 'failed' ? (
        <div className="cq-panel" role="alert">
          <p>We couldn't reach your clan just now.</p>
          <button type="button" className="cq-btn cq-btn--hot" onClick={open}>Try again</button>
        </div>
      ) : loading === 'off' ? (
        <p className="cq-panel" role="status">Clan Quest isn't switched on yet. Ask your teacher when it will be ready!</p>
      ) : !session ? (
        <Creator seed={serverSeed} onDone={(clan, choices) => { create(clan, choices); setScreen('home'); }} />
      ) : (
        <>
          {!server && <SettingsStrip session={session} onChange={setSession} open={screen === 'home'} />}
          {screen === 'home' && (
            <section aria-label="Your clan">
              <div className="cq-clanhead">
                {bannerArt(session.clan.name) && <img className="cq-clanbanner" src={bannerArt(session.clan.name)} alt="" />}
                <div>
                  <h2>{session.clan.name}</h2>
                  <p className="cq-soft">Practising: {session.settings.enabledTopics.length ? session.settings.enabledTopics.map((t) => TOPIC_LABELS[t].toLowerCase()).join(', ') : 'nothing today'}</p>
                </div>
              </div>
              <div className="cq-cards">
                {session.clan.members.map((m, i) => (
                  <MemberCard key={m.name} member={m} leader={i === 0} onLook={(look) => { const next = changeLook(session, i, look); if (next) change(next, { type: 'look', member: i, look }); }} />
                ))}
              </div>
              {session.news && session.news.length > 0 && (
                <ul className="cq-soft" aria-label="Village news">
                  {session.news.slice(0, 5).map((line, i) => <li key={`${i}-${line}`}>{line}</li>)}
                </ul>
              )}
              {session.notes && session.notes.length > 0 && (
                <div className="cq-panel" role="group" aria-label="While you were away">
                  <h3>While you were away</h3>
                  <ul>{session.notes.map((n) => <li key={n}>{n}</li>)}</ul>
                </div>
              )}
              <p>Gold: <strong>{session.clan.gold}</strong> · Followers: <strong>{session.clan.followers}</strong> · Average level: <strong>{Math.round(averageLevel(session.clan) * 10) / 10}</strong> · Fame: <strong>{session.fame ?? 0}</strong> (season {session.season ?? 1})</p>
              <div className="cq-actions">
                <button type="button" className="cq-btn cq-btn--hot" onClick={() => setScreen('mines')}>Go to the Mines</button>
                <button type="button" className="cq-btn" onClick={() => setScreen('market')}>The Market</button>
                <button type="button" className="cq-btn" onClick={() => setScreen('training')}>The Training Hall</button>
                <button type="button" className="cq-btn" onClick={() => setScreen('church')}>The Church</button>
                <button type="button" className="cq-btn" onClick={() => setScreen('empire')}>The Empire</button>
                <button type="button" className="cq-btn" onClick={() => setScreen('quest')}>{questUsed(session) ? 'Quest (done for today)' : 'Quest'}</button>
                <button type="button" className="cq-btn" onClick={() => setScreen('village')}>The Village</button>
                <button type="button" className="cq-btn" onClick={() => setScreen('news')}>Village news</button>
                <button type="button" className="cq-btn" onClick={() => setScreen('scoreboard')}>Scoreboard</button>
                <button type="button" className="cq-btn" onClick={() => setScreen('howto')}>How to play</button>
                <button type="button" className="cq-btn" onClick={() => setScreen('achievements')}>Achievements ({(session.achievements ?? []).length} of {ACHIEVEMENTS.length})</button>
              </div>
            </section>
          )}
          {screen === 'mines' && (
            <Mines session={session} onDepth={(depth) => setSession({ ...session, depth })} onBack={() => setScreen('home')} onGo={startFight} />
          )}
          {screen === 'market' && <Market session={session} onChange={change} onBack={() => setScreen('home')} />}
          {screen === 'training' && <Training session={session} onChange={change} onBack={() => setScreen('home')} />}
          {screen === 'church' && <Church session={session} onChange={change} onBack={() => setScreen('home')} />}
          {screen === 'empire' && <EmpireHome session={session} onChange={change} onBack={() => setScreen('home')} onLand={() => setScreen('land')} onBarracks={() => setScreen('barracks')} onRaid={() => setScreen('raid')} onClassRaid={() => setScreen('classraid')} />}
          {screen === 'barracks' && <Barracks session={session} onChange={change} onBack={() => setScreen('empire')} />}
          {screen === 'raid' && <Raid session={session} onChange={change} onBack={() => setScreen('empire')} />}
          {screen === 'village' && <Village session={session} onChange={change} onBack={() => setScreen('home')} onNews={() => setScreen('news')} />}
          {screen === 'news' && <VillageNews session={session} onBack={() => setScreen('home')} />}
          {screen === 'scoreboard' && <Scoreboard session={session} load={board} onBack={() => setScreen('home')} />}
          {screen === 'howto' && <HowToPlay fightsPerDay={session.fightsPerDay} onBack={() => setScreen('home')} />}
          {screen === 'achievements' && <Achievements session={session} onBack={() => setScreen('home')} />}
          {screen === 'classraid' && <ClassRaid session={session} ask={ask} onSession={setSession} onBack={() => setScreen('empire')} />}
          {screen === 'quest' && <Quest key={`${session.day}-${session.questPick ?? 0}`} session={session} onChange={change} onBack={() => setScreen('home')} />}
          {screen === 'land' && <Land session={session} onChange={change} onBack={() => setScreen('empire')} />}
          {screen === 'fight' && !server && <Fight key={session.fightNo} session={session} boss={boss} onFinish={finish} />}
          {screen === 'fight' && server && activeFight && (
            <Fight key={`${activeFight.no}-${fightKey}`} session={session} open={activeFight} boss={activeFight.boss} onRound={sendRound} onCheck={checkCry} onFinish={finishServer} />
          )}
          {screen === 'results' && summary && <Results summary={summary} members={session.clan.members} fame={fameEarned.current} onDone={() => setScreen('home')} />}
        </>
      )}
      <footer className="cq-credits">Game rules adapted from The Clans by Allen Ussher (1997). Paintings made for School Games Hub; small pictures from Kenney's 1-Bit Pack (CC0).</footer>
    </div>
  );
}
