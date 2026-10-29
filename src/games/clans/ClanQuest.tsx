/** Clan Quest, test version: clan creator, the Mines and fights. Nothing is saved; a refresh starts again. */
import { useEffect, useRef, useState } from 'react';
import { monsterWeek, suppliesOnSale, type Action, type MonsterOutcome, type ShownFight } from '../../../shared/clans/actions';
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
import { MonsterWarning, MonsterWeek, MonsterResult, type MonsterTry } from './MonsterWeek';
import { finishPracticeTry, startPracticeTry } from './monsterPlay';
import { Repick } from './Repick';
import { Mines, Results } from './Mines';
import { armyToLose, armyToWin, changeLook, questToday, questUsed, barracksAndFill, freshQuest, freshRaid, giveFollowers, giveGold, givePoints, giveSupplies, knockOutSome } from './places';
import { ClassRaid } from './ClassRaid';
import { News } from './News';
import { MyVillage } from './MyVillage';
import { Raid } from './Raid';
import { Quest } from './Quest';
import { QUESTS } from '../../../shared/clans/quests';
import { Training } from './Training';
import { Scoreboard } from './Scoreboard';
import type { HallRow } from '../../data/clans';
import { HowToPlay } from './HowToPlay';
import { Achievements, Celebration, VillageDone } from './Achievements';
import { SeasonLine } from './SeasonLine';
import { empireOf, villageComplete } from '../../../shared/clans/empire';
import { awardNext, giveFame, newSeason, type ScoreRow } from './fame';
import { ACHIEVEMENTS, fameFor, type AchievementDef } from '../../../shared/clans/rewards';
import { averageLevel, earn, finishFight, newSession, skipDay, type FightSummary, type Session } from './session';
import { sessionFrom, type ClanServer, type ServerReply } from './remote';
import { bannerArt, questArt, sceneArt, type SceneId } from './art';
import './clans.css';

type Screen = 'home' | 'mines' | 'fight' | 'results' | 'market' | 'training' | 'church' | 'myvillage' | 'raid' | 'quest' | 'news' | 'classraid' | 'scoreboard' | 'achievements' | 'howto' | 'monster';

/** The painting across the top of each screen. Home has none of its own, so it borrows the village. The fight has none across the top (its mine zone is painted behind the
 * monsters, to keep the fight on one screen); its results get one from how it went (`afterFight`). */
const SCENE_FOR: Partial<Record<Screen, SceneId>> = {
  home: 'village', mines: 'mines', market: 'market', training: 'training', church: 'church', myvillage: 'village',
  raid: 'raid', classraid: 'raid', quest: 'quests', news: 'news', scoreboard: 'scoreboard',
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
        <button type="button" className="cq-btn" onClick={() => onChange(barracksAndFill(session))}>Build the Barracks and fill it (test only)</button>
        <button type="button" className="cq-btn" onClick={() => onChange(armyToWin(session))}>Win the next raid (test only)</button>
        <button type="button" className="cq-btn" onClick={() => onChange(armyToLose(session))}>Lose the next raid (test only)</button>
        <button type="button" className="cq-btn" onClick={() => onChange(freshRaid(session))}>Allow another raid today (test only)</button>
        <button type="button" className="cq-btn" onClick={() => onChange(freshQuest(session))}>Allow another quest today (test only)</button>
        <button type="button" className="cq-btn" onClick={() => onChange(giveFame(session, 10))}>Give 10 fame (test only)</button>
        <button type="button" className="cq-btn" onClick={() => onChange(earn(session, { bosses: 1 }))}>Beat a boss: 5 fame and an achievement (test only)</button>
        <button type="button" className="cq-btn" onClick={() => onChange(awardNext(session))}>Earn the next achievement (test only)</button>
        <button type="button" className="cq-btn" onClick={() => onChange(giveSupplies(session))}>Give a full set of monster supplies (test only)</button>
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
export function ClanQuest({ seed = Date.now() | 0, initial = null, server, board, hall, typedNames = false }: { seed?: number; initial?: Session | null; server?: ClanServer; board?: () => Promise<ScoreRow[]>; hall?: () => Promise<HallRow[] | null>; typedNames?: boolean }) {
  const [session, setSession] = useState<Session | null>(initial);
  const [screen, setScreen] = useState<Screen>('home');
  const [boss, setBoss] = useState(false);
  const [summary, setSummary] = useState<FightSummary | null>(null);
  const [loading, setLoading] = useState<'loading' | 'failed' | 'off' | null>(server ? 'loading' : null);
  /** With a server: the fight being played, as the server has it. */
  const [activeFight, setActiveFight] = useState<ShownFight | null>(null);
  const [fightKey, setFightKey] = useState(0);
  /** The monster try just finished (for the results screen), and with no server the practice try being played. */
  const [monsterDone, setMonsterDone] = useState<MonsterOutcome | null>(null);
  const [practiceFight, setPracticeFight] = useState<ShownFight | null>(null);
  const monsterOut = useRef<MonsterOutcome | null>(null);
  /** True while a monster try is starting: the siege is shown before the fight, so the reply must not jump straight to it. */
  const holdFight = useRef(false);
  const activeRef = useRef<ShownFight | null>(null);
  /** What the server said when the last round ended the fight (it has been paid). */
  const outcome = useRef<FightSummary | null>(null);
  const [serverSeed, setServerSeed] = useState(seed);
  const [notice, setNotice] = useState('');
  /** Achievements just earned, shown with a small celebration. The first clan the screen sees is not celebrated: those were earned before. */
  const [celebrate, setCelebrate] = useState<AchievementDef[]>([]);
  const knownAchievements = useRef<string[] | null>(null);
  /** Was the village complete the last time we looked? (null until the first clan is seen: that one is not celebrated.) */
  const knownComplete = useRef<boolean | null>(null);
  const [villageDone, setVillageDone] = useState(false);
  /** The reply said a new season has just begun. */
  const [newSeasonNotice, setNewSeasonNotice] = useState(false);
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
    // The Master Builder badge has its own dialog (below), so it is left out of the small celebration.
    const fresh = ACHIEVEMENTS.filter((a) => now.includes(a.id) && !before.includes(a.id) && a.id !== 'cq-master-builder');
    if (fresh.length) setCelebrate(fresh);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const complete = villageComplete(empireOf(session.clan));
    const before = knownComplete.current;
    knownComplete.current = complete;
    if (before === false && complete) setVillageDone(true);
  }, [session]);

  /** How many actions have been sent and not answered yet. */
  const waiting = useRef(0);

  /** Take the server's word. While more actions are still on their way, only the last answer is shown, so the screen does not flicker back. */
  const take = (reply: ServerReply) => {
    setServerSeed(reply.seed);
    if (reply.newSeason) setNewSeasonNotice(true);
    if (waiting.current === 0) {
      setSession((previous) => (reply.state ? sessionFrom(reply.state, previous) : previous));
      // A fight is open on the server (this was opened after a refresh, or on another Chromebook): go straight back to it.
      const open = reply.state?.fight;
      if (open && !activeRef.current && !holdFight.current) {
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
      setMonsterDone(null);
      setPracticeFight(null);
      setScreen('fight');
      return;
    }
    setMonsterDone(null);
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
          monsterOut.current = reply.result.monster ?? null;
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
        setMonsterDone(monsterOut.current);
        monsterOut.current = null;
        setSummary(summary);
        setActiveFight(null);
        setScreen('results');
      } else if (activeRef.current) {
        setNotice('The server has not finished that fight yet. Here it is again.');
        resyncFight(activeRef.current);
      }
    });
  };

  /** Today's monster try. With a server it sends monsterStart (the siege answer) and gives back how the siege went; without one it is Practice. */
  const startMonster = async (answer: number | null): Promise<MonsterTry> => {
    if (!server || !session) {
      const out = startPracticeTry(session!, answer);
      setSession(out.session);
      return { ok: true, resumed: false, right: out.right, answer: out.answer, siege: out.siege, open: out.open };
    }
    holdFight.current = true;
    let reply: ServerReply;
    try {
      reply = await ask!({ type: 'monsterStart', siege: answer, ladder: true });
    } finally {
      holdFight.current = false;
    }
    const open = reply.state?.fight;
    if (!reply.ok || reply.result.type !== 'monsterStart' || !open?.monster) {
      // The screen shows the words itself, so the banner at the top stays quiet.
      setNotice('');
      return { ok: false, say: reply.ok ? 'The monster try did not start. Please try again.' : reply.say };
    }
    return { ok: true, resumed: reply.result.resumed, right: reply.result.right, answer: reply.result.answer, siege: open.monster.siege, open };
  };
  /** The siege is over: on to the clan fight. */
  const enterMonsterFight = (open: ShownFight) => {
    setMonsterDone(null);
    if (!server) setPracticeFight(open);
    else {
      activeRef.current = open;
      setActiveFight(open);
      setFightKey((k) => k + 1);
    }
    setScreen('fight');
  };

  const finish = (fight: FightState) => {
    if (!session) return;
    if (practiceFight) {
      const done = finishPracticeTry(session, practiceFight, fight);
      setSession(done.session);
      fameEarned.current = 0;
      setSummary(done.summary);
      setMonsterDone(done.monster);
      setPracticeFight(null);
      setScreen('results');
      return;
    }
    setMonsterDone(null);
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
  // A new season has reset the clan and it has not said "keep going" yet: it may pick its members' races and classes again first.
  const repicking = !!session && session.clan.repick !== undefined && session.clan.repick === session.clan.season;

  return (
    <div className="cq" ref={root}>
      <header className="cq-top">
        <h1>Clan Quest</h1>
        <span className="cq-soft">{session ? `${session.clan.name} · ${session.clan.gold} gold · ${session.clan.followers} followers · ${session.fame ?? 0} fame` : 'Test version: nothing is saved'}</span>
      </header>
      {quest ? <Scene key={`quest-${quest.id}`} name={`quest-${quest.id}`} art={questArt(quest.title)} /> : scene && <Scene key={scene} name={scene} art={sceneArt(scene)} />}
      <Celebration fresh={celebrate} onClose={() => setCelebrate([])} />
      {villageDone && <VillageDone onClose={() => setVillageDone(false)} />}
      {newSeasonNotice && (
        <div className="cq-celebrate" role="status">
          <p>A new season has begun! Your clan starts fresh. Your badges and the Hall of Legends stay forever.</p>
          <button type="button" className="cq-btn" onClick={() => setNewSeasonNotice(false)}>OK</button>
        </div>
      )}
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
        <Creator seed={serverSeed} typedNames={typedNames} onDone={(clan, choices) => { create(clan, choices); setScreen('home'); }} />
      ) : (
        <>
          {!server && <SettingsStrip session={session} onChange={setSession} open={screen === 'home'} />}
          {screen === 'home' && repicking && <Repick session={session} onChange={change} />}
          {screen === 'home' && !repicking && (
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
                <ul className="cq-soft" aria-label="News">
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
              <SeasonLine clock={session.clock} />
              {suppliesOnSale(session.clock) && !monsterWeek(session.clock) && <MonsterWarning clock={session.clock} />}
              <div className="cq-actions">
                <button type="button" className="cq-btn cq-btn--hot" onClick={() => setScreen('mines')}>Go to the Mines</button>
                {(monsterWeek(session.clock) || !server) && (
                  <button type="button" className="cq-btn cq-btn--hot" onClick={() => setScreen('monster')}>{monsterWeek(session.clock) ? 'The Monster' : 'The Monster (practice)'}</button>
                )}
                <button type="button" className="cq-btn" onClick={() => setScreen('market')}>The Market</button>
                <button type="button" className="cq-btn" onClick={() => setScreen('training')}>The Training Hall</button>
                <button type="button" className="cq-btn" onClick={() => setScreen('church')}>The Church</button>
                <button type="button" className="cq-btn cq-btn--hot" onClick={() => setScreen('myvillage')}>My Village</button>
                <button type="button" className="cq-btn" onClick={() => setScreen('quest')}>{questUsed(session) ? 'Quest (done for today)' : 'Quest'}</button>
                <button type="button" className="cq-btn" onClick={() => setScreen('news')}>News</button>
                <button type="button" className="cq-btn" onClick={() => setScreen('scoreboard')}>Scoreboard</button>
                <button type="button" className="cq-btn" onClick={() => setScreen('howto')}>How to play</button>
                <button type="button" className="cq-btn" onClick={() => setScreen('achievements')}>Achievements ({(session.achievements ?? []).length} of {ACHIEVEMENTS.length})</button>
              </div>
            </section>
          )}
          {screen === 'mines' && (
            <Mines session={session} onDepth={(depth) => setSession({ ...session, depth })} onBack={() => setScreen('home')} onGo={startFight} />
          )}
          {screen === 'monster' && <MonsterWeek session={session} practice={!server} onTry={startMonster} onFight={enterMonsterFight} onBack={() => setScreen('home')} />}
          {screen === 'market' && <Market session={session} onChange={change} onBack={() => setScreen('home')} />}
          {screen === 'training' && <Training session={session} onChange={change} onBack={() => setScreen('home')} />}
          {screen === 'church' && <Church session={session} onChange={change} onBack={() => setScreen('home')} />}
          {screen === 'myvillage' && <MyVillage session={session} onChange={change} onBack={() => setScreen('home')} onRaid={() => setScreen('raid')} onClassRaid={() => setScreen('classraid')} />}
          {screen === 'raid' && <Raid session={session} onChange={change} onBack={() => setScreen('myvillage')} />}
          {screen === 'news' && <News session={session} onBack={() => setScreen('home')} />}
          {screen === 'scoreboard' && <Scoreboard session={session} load={board} hall={hall} onBack={() => setScreen('home')} />}
          {screen === 'howto' && <HowToPlay fightsPerDay={session.fightsPerDay} onBack={() => setScreen('home')} />}
          {screen === 'achievements' && <Achievements session={session} onBack={() => setScreen('home')} />}
          {screen === 'classraid' && <ClassRaid session={session} ask={ask} onSession={setSession} onBack={() => setScreen('myvillage')} />}
          {screen === 'quest' && <Quest key={`${session.day}-${session.questPick ?? 0}`} session={session} onChange={change} onBack={() => setScreen('home')} />}
          {screen === 'fight' && !server && <Fight key={`${session.fightNo}-${practiceFight ? 'monster' : 'mines'}`} session={session} boss={boss} open={practiceFight ?? undefined} onFinish={finish} />}
          {screen === 'fight' && server && activeFight && (
            <Fight key={`${activeFight.no}-${fightKey}`} session={session} open={activeFight} boss={activeFight.boss} onRound={sendRound} onCheck={checkCry} onFinish={finishServer} />
          )}
          {screen === 'results' && summary && (
            <Results
              summary={summary} members={session.clan.members} fame={fameEarned.current} onDone={() => setScreen('home')}
              extra={monsterDone && <MonsterResult outcome={monsterDone} session={session} />}
              onMines={!monsterDone && session.fightsLeft > 0 && session.clan.members.some((m) => !m.knockedOut) ? () => setScreen('mines') : undefined}
            />
          )}
        </>
      )}
      <footer className="cq-credits">Game rules adapted from The Clans by Allen Ussher (1997). Paintings made for School Games Hub; small pictures from Kenney's 1-Bit Pack (CC0).</footer>
    </div>
  );
}
