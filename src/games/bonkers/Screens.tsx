/** Smash Quest's calm screens: picking a hero, home, and what an adventure earned. */
import { useState } from 'react';
import { useEnterGoes } from './keys';
import { HeroFigure } from './Shop';
import { AchievementPop } from '../../achievements/AchievementPop';
import { Pic, bossArt, chestArt, gearArt, heroArt, heroPickArt, homeArt, monsterArt, zoneArt } from './art';
import { CLASS_INFO, CLASSES, GEAR, LOOKS, SLOTS, gearById, gearStats, type GearInfo, trainerFor, zoneById, type HeroClass, type Look } from '../../../shared/bonkers/content';
import { MAX_LEVEL } from '../../../shared/bonkers/config';
import { heroPower, replay, starsToTrainer, type Hero, type Progress } from '../../../shared/bonkers/engine';
import type { AdventureView, ClassBoss, FinishReply, LoadReply } from './backend';
import { nextBossWords, type BossStop, type SeasonView } from '../../../shared/bonkers/season';
import { GRANNY, grannySays, levelTitle, questWords, xp } from './words';
import { Granny } from './Granny';

const LOOK_WORDS: Record<Look, string> = { boy: 'Boy', girl: 'Girl', animal: 'Animal' };

/** A calm screen filling the window: its painting edge to edge, the content on top (docs/FULL-WINDOW.md). */
export function Screen({ label, pic, className, children }: { label: string; pic: string | undefined; className?: string; children: React.ReactNode }) {
  return (
    <section className={`bq-screen${className ? ` ${className}` : ''}`} aria-label={label}>
      <div className="bq-stage__bg" style={pic ? { background: `center bottom / cover no-repeat url(${pic})` } : undefined} aria-hidden="true" />
      <div className="bq-screen__inner">{children}</div>
    </section>
  );
}

export function HeroPick({ hero, busy, onPick }: { hero: Hero | null; busy: boolean; onPick: (cls: HeroClass, look: Look) => void }) {
  const [cls, setCls] = useState<HeroClass | null>(hero?.cls ?? null);
  const [look, setLook] = useState<Look>(hero?.look ?? 'girl');
  const info = cls ? CLASS_INFO[cls] : null;
  return (
    <Screen label="Pick your hero" pic={heroPickArt()} className="bq-hero-pick">
      <h1 className="bq-shout">{hero ? 'A new look!' : 'Pick your hero!'}</h1>
      <Granny line={hero ? GRANNY.newLook : GRANNY.pick} />
      <div className="bq-classes">
        {CLASSES.map((c) => {
          const ci = CLASS_INFO[c];
          const locked = !!hero && hero.cls !== c;
          return (
            <button
              key={c} type="button" className={`bq-class${cls === c ? ' bq-class--on' : ''}`} style={{ '--bq-c': ci.colour } as React.CSSProperties}
              aria-pressed={cls === c} disabled={locked} onClick={() => setCls(c)}
            >
              <span className="bq-class__emoji" aria-hidden="true"><Pic src={heroArt(c, look, 1)} emoji={ci.emoji[look]} /></span>
              {cls === c && <span className="bq-class__tick" aria-hidden="true">✔</span>}
              <strong>{ci.names[look]}</strong>
              <span className="bq-class__blurb">{ci.blurb}</span>
              <span className="bq-class__move"><b>{ci.move.name}:</b> {ci.move.does}</span>
            </button>
          );
        })}
      </div>
      <div className="bq-looks" role="group" aria-label="Look">
        {LOOKS.map((l) => (
          <button key={l} type="button" className={`bq-btn bq-btn--soft${look === l ? ' bq-btn--picked' : ''}`} aria-pressed={look === l} onClick={() => setLook(l)}>
            <span aria-hidden="true">{info ? info.emoji[l] : l === 'boy' ? '🧒' : l === 'girl' ? '👧' : '🐾'}</span> {l === 'animal' && info ? info.animal[0].toUpperCase() + info.animal.slice(1) : LOOK_WORDS[l]}
          </button>
        ))}
      </div>
      <button type="button" className="bq-btn bq-btn--big bq-btn--go" disabled={!cls || busy} onClick={() => cls && onPick(cls, look)}>
        {info ? `Be the ${info.names[look]}!` : 'Pick a hero'}
      </button>
    </Screen>
  );
}

function HeroBadge({ hero, p }: { hero: Hero; p: Progress }) {
  const ci = CLASS_INFO[hero.cls];
  return (
    <div className="bq-badge" style={{ '--bq-c': ci.colour } as React.CSSProperties}>
      <span className="bq-badge__emoji" aria-hidden="true"><Pic src={heroArt(hero.cls, hero.look, p.level)} emoji={ci.emoji[hero.look]} /></span>
      <div>
        <strong>{ci.names[hero.look]}</strong>
        <span className="bq-badge__lvl">Level {p.level}: {levelTitle(p.level)}</span>
        <span className="bq-badge__pow">Smash power {heroPower(p)} · {p.stickers} stickers</span>
      </div>
    </div>
  );
}

function StarBar({ p }: { p: Progress }) {
  if (p.level >= MAX_LEVEL) return <p className="bq-bar__done">🏆 Top level! 🏆</p>;
  const need = starsToTrainer(p.level);
  const t = trainerFor(p.level);
  return (
    <div className="bq-bar">
      <div className="bq-bar__label"><span>✨ {xp(p.stars)} / {xp(need)} XP</span><span>{t?.emoji} {t?.name}</span></div>
      <div className="bq-bar__track" role="progressbar" aria-label="XP to your trainer" aria-valuemin={0} aria-valuemax={xp(need)} aria-valuenow={xp(p.stars)}>
        <div className="bq-bar__fill" style={{ width: `${Math.min(100, (100 * p.stars) / need)}%` }} />
      </div>
    </div>
  );
}

function LevelRoad({ level }: { level: number }) {
  return (
    <ol className="bq-road" aria-label={`Level ${level} of ${MAX_LEVEL}`}>
      {Array.from({ length: MAX_LEVEL }, (_, i) => i + 1).map((n) => (
        <li key={n} className={n < level ? 'bq-road--done' : n === level ? 'bq-road--now' : ''}>{n}</li>
      ))}
    </ol>
  );
}

/** A piece of gear's stat lines: "+16 Smash", "+5 Crit"… (flavour, see gearStats). */
function Stats({ g }: { g: GearInfo }) {
  return (
    <span className="bq-stats">
      {gearStats(g).map((s) => <span key={s.label} className="bq-stat"><span aria-hidden="true">{s.icon}</span> +{s.value} {s.label}</span>)}
    </span>
  );
}

function GearRow({ p }: { p: Progress }) {
  return (
    <ul className="bq-gear" aria-label="Your gear">
      {SLOTS.map((slot) => {
        const g = GEAR.find((x) => x.slot === slot && x.tier === p.gear[slot]);
        return (
          <li key={slot} title={g?.name}>
            <span className="bq-gear__icon" aria-hidden="true"><Pic src={g && gearArt(g.id)} emoji={g?.emoji ?? ''} /></span>
            <span className="bq-gear__name">{g?.name}</span>
            {g && <Stats g={g} />}
          </li>
        );
      })}
    </ul>
  );
}

const SHORT_DAY = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** The season's boss road: a Friday boss each week and the mega boss on the last Friday. Tap a stop for its line. */
function SeasonTimeline({ season, boss }: { season: SeasonView; boss: ClassBoss | null }) {
  const [open, setOpen] = useState<number | null>(null);
  const pick = season.stops.find((s) => s.week === open) ?? season.stops.find((s) => s.state === 'today' || s.state === 'next') ?? null;
  const along = Math.min(100, Math.max(0, (100 * (season.day - 1)) / Math.max(1, season.days - 1)));
  const stopWords = (s: BossStop) => (s.state === 'beaten-time' ? 'Been and gone' : s.state === 'today' ? 'Today!' : SHORT_DAY(s.date));
  return (
    <section className="bq-panel bq-season" aria-label={`Season ${season.number}, week ${season.week} of ${season.weeks}`}>
      <div className="bq-season__top">
        <h2 className="bq-season__title">Season {season.number} <span>Week {season.week} of {season.weeks}</span></h2>
        <p className="bq-season__next">{nextBossWords(season)}</p>
      </div>
      <div className="bq-season__road">
        <div className="bq-season__track" aria-hidden="true"><div className="bq-season__fill" style={{ width: `${along}%` }} /></div>
        <ol className="bq-season__stops">
          {season.stops.map((s) => (
            <li key={s.week}>
              <button
                type="button"
                className={`bq-season__stop bq-season__stop--${s.state} bq-season__stop--${s.kind}${pick?.week === s.week ? ' bq-season__stop--picked' : ''}`}
                aria-pressed={pick?.week === s.week}
                aria-label={`${s.kind === 'mega' ? 'Mega boss' : `Week ${s.week} Friday boss`}: ${s.boss.name}, ${stopWords(s)}`}
                onClick={() => setOpen(s.week)}
              >
                <span className="bq-season__emoji" aria-hidden="true"><Pic src={bossArt(s.boss.name)} emoji={s.boss.emoji} /></span>
                <span className="bq-season__label">{s.kind === 'mega' ? 'MEGA' : `Wk ${s.week}`}</span>
                <span className="bq-season__when">{stopWords(s)}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      {boss && <BossBar boss={boss} />}
      {pick && (
        <p className="bq-season__note" aria-live="polite">
          <b>{pick.boss.emoji} {pick.boss.name}</b> {pick.kind === 'mega' ? '(the season’s mega boss)' : `(Friday, week ${pick.week})`}: {pick.boss.blurb}
          {pick.state === 'beaten-time' ? '' : ' Your class chips away at it all week!'}
        </p>
      )}
    </section>
  );
}

/** How far the class has dented this week's boss (B.3). */
function BossBar({ boss }: { boss: ClassBoss }) {
  const pc = Math.min(100, Math.round((100 * boss.dealt) / Math.max(1, boss.hp)));
  return (
    <div className={`bq-bossbar${boss.beaten ? ' bq-bossbar--beaten' : ''}${boss.mega ? ' bq-bossbar--mega' : ''}`}>
      <span className="bq-bossbar__face" aria-hidden="true"><Pic src={bossArt(boss.name)} emoji={boss.emoji} /></span>
      <div className="bq-bossbar__words">
        <b>{boss.beaten ? `Your class beat ${boss.name}! 🎉` : `Your class vs ${boss.name}`}</b>
        <div className="bq-bossbar__track" role="progressbar" aria-label={`Your class has dented ${boss.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pc}>
          <div className="bq-bossbar__fill" style={{ width: `${pc}%` }} />
        </div>
        <span className="bq-bossbar__hint">
          {boss.beaten ? 'Everyone who helped wins a trophy!' : boss.today ? (boss.fought ? `${pc}% done. Your classmates can finish it today!` : `${pc}% done. Boss fight today: finish it!`) : `${pc}% dented. Every right answer helps, then Friday's boss fight finishes it.`}
        </span>
      </div>
    </div>
  );
}

/** Friday's boss fight, on top of the day's quests (it never uses up an adventure). */
function BossQuest({ boss, busy, onGo }: { boss: ClassBoss; busy: boolean; onGo: () => void }) {
  const pc = Math.min(100, Math.round((100 * boss.dealt) / Math.max(1, boss.hp)));
  return (
    <button type="button" className={`bq-quest bq-quest--boss${boss.mega ? ' bq-quest--mega' : ''}`} disabled={busy} onClick={onGo}>
      <span className="bq-quest__zone">{boss.mega ? 'MEGA BOSS' : 'FRIDAY BOSS'}</span>
      <span className="bq-quest__face" aria-hidden="true"><Pic src={bossArt(boss.name)} emoji={boss.emoji} /></span>
      <span className="bq-quest__words">
        <strong>{boss.name}</strong>
        <span>Your class has dented it {pc}%. Win your boss fight to finish it! (It doesn’t use an adventure.)</span>
      </span>
      <span className="bq-quest__go">FIGHT!</span>
    </button>
  );
}

export function Inn({ loaded, busy, note, onQuest, onChangeLook, onShop, onBook }: {
  loaded: LoadReply; busy: boolean; note: string | null; onQuest: (id: string) => void; onChangeLook: () => void;
  onShop: () => void; onBook: () => void;
}) {
  const p = loaded.progress;
  const out = loaded.waiting === 0;
  const ci = p.hero ? CLASS_INFO[p.hero.cls] : null;
  return (
    <Screen label="Home" pic={homeArt()} className="bq-home">
      <div className="bq-home__hero" style={ci ? ({ '--bq-c': ci.colour } as React.CSSProperties) : undefined}>
        <Granny line={grannySays(p, loaded.waiting)} className="bq-granny--fly" />
        {p.hero && ci && (
          <div className="bq-home__me">
            <span className="bq-home__figure" aria-hidden="true"><HeroFigure cls={p.hero.cls} look={p.hero.look} level={p.level} hat={p.hat} pet={p.pet} /></span>
            <span className="bq-home__lvl" aria-hidden="true">Lv {p.level}</span>
          </div>
        )}
        <div className="bq-panel bq-inn__hero">
          {p.hero && <HeroBadge hero={p.hero} p={p} />}
          <StarBar p={p} />
          <LevelRoad level={p.level} />
          <GearRow p={p} />
          <button type="button" className="bq-link" onClick={onChangeLook}>Change your look</button>
        </div>
      </div>
      <div className="bq-home__go">
        {loaded.season && <SeasonTimeline season={loaded.season} boss={loaded.boss ?? null} />}
        <div className="bq-home__row">
        <div className="bq-home__more">
          <button type="button" className="bq-btn bq-btn--small bq-btn--shop" onClick={onShop}>🛍️ Sticker shop <span>🏷️ {p.stickers}</span></button>
          <button type="button" className="bq-btn bq-btn--small bq-btn--book" onClick={onBook}>📖 Monster Book</button>
        </div>
        <h2 className="bq-h2 bq-h2--banner">
          Today’s quests
          <span className="bq-waiting">{loaded.waiting === null ? 'Unlimited today' : `${loaded.waiting} adventure${loaded.waiting === 1 ? '' : 's'} waiting`}</span>
        </h2>
        </div>
        <div className="bq-quests">
          {loaded.boss?.quest && <BossQuest boss={loaded.boss} busy={busy} onGo={() => onQuest(loaded.boss!.quest!.id)} />}
          {loaded.quests.map((q, i) => {
            const zone = zoneById(q.zone);
            const w = questWords(q);
            const mon = q.kind === 'big' ? zone?.big : q.kind === 'hunt' ? zone?.monsters[q.monster] : zone?.monsters[0];
            const pic = zone && zoneArt(zone.id);
            return (
              <button
                key={q.id} type="button" className="bq-quest" disabled={busy || out} onClick={() => onQuest(q.id)}
                style={{ background: pic ? `center bottom / cover no-repeat url(${pic})` : `linear-gradient(${zone?.sky[0]}, ${zone?.sky[1]} 70%, ${zone?.ground} 70%)`, animationDelay: `${i * 0.15}s` }}
              >
                <span className="bq-quest__zone">{zone?.name}</span>
                <span className="bq-quest__face" aria-hidden="true"><Pic src={mon && monsterArt(mon.id)} emoji={mon?.emoji ?? ''} /></span>
                <span className="bq-quest__words">
                  <strong>{w.title}</strong>
                  <span>{w.what}</span>
                </span>
                <span className="bq-quest__go">{out ? 'Tomorrow!' : 'GO!'}</span>
              </button>
            );
          })}
        </div>
        {note && <p className="bq-note" role="alert">{note}</p>}
      </div>
    </Screen>
  );
}

export function Results({ before, result, current, onInn, offline }: {
  before: Progress; result: FinishReply; current: AdventureView; onInn: () => void; offline?: boolean;
}) {
  useEnterGoes();
  const r = replay(current.adventure, current.marks);
  const fights = r.results.filter((x) => !x.trainer);
  const won = fights.filter((x) => x.outcome === 'won').length;
  const trainer = trainerFor(before.level);
  const w = questWords(current.adventure.quest);
  return (
    <Screen label="Adventure done" pic={homeArt()} className="bq-results-screen">
      <div className="bq-rays bq-rays--gold" aria-hidden="true" />
      {result.gear.length === 0 && (
        <p className="bq-results__chest" aria-hidden="true"><Pic src={chestArt(true)} emoji="🧰" /></p>
      )}
      <div className="bq-results bq-panel">
      <h2 className="bq-h2 bq-h2--shout">{result.levelUp ? `Level ${result.levelUp}! ${levelTitle(result.levelUp)}!` : 'Adventure done!'}</h2>
      {result.levelUp && trainer && <p className="bq-big-line"><span aria-hidden="true">{trainer.emoji}</span> {trainer.beaten}</p>}
      {r.trainerMet && !r.trainerWon && trainer && <p className="bq-big-line"><span aria-hidden="true">{trainer.emoji}</span> {trainer.name} won this time. They’ll be waiting next adventure!</p>}
      {current.adventure.quest.kind === 'boss' && result.boss?.beaten && (
        <p className="bq-shout bq-shout--small">Your class beat {result.boss.name}!</p>
      )}
      {before.stats.adventures === 0 && <Granny line={GRANNY.tipResults} className="bq-granny--tip" />}
      <ul className="bq-tally">
        <li>🥊 Fights won: <b>{won} of {fights.length}</b></li>
        <li>{r.questDone ? '✅' : '➖'} {w.title}: <b>{r.questDone ? 'done!' : 'not this time'}</b></li>
        <li>✨ XP: <b>+{xp(result.starsEarned)}</b></li>
        {result.stickers > 0 && <li>🏷️ Stickers: <b>+{result.stickers}</b></li>}
        {result.bossDamage > 0 && result.boss && <li>👹 You dented {result.boss.name}: <b>{result.bossDamage}</b></li>}
      </ul>
      {result.gear.length > 0 && (
        <div className="bq-chest">
          <p className="bq-chest__lid" aria-hidden="true">{chestArt(true) ? <Pic src={chestArt(true)} emoji="" /> : '🧰✨'}</p>
          <p>Treasure chest!</p>
          <ul>
            {result.gear.map((id) => {
              const g = gearById(id);
              return (
                <li key={id} className="bq-chest__item">
                  <span className="bq-gear__icon" aria-hidden="true"><Pic src={g && gearArt(g.id)} emoji={g?.emoji ?? ''} /></span> {g?.name} <span className="bq-chest__new">NEW!</span>
                  {g && <Stats g={g} />}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {result.points > 0 && <p className="bq-points">+{result.points} hub points</p>}
      <StarBar p={result.progress} />
      <button type="button" className="bq-btn bq-btn--big bq-btn--go" onClick={onInn}>Back home</button>
      </div>
      <AchievementPop games={['bonkers']} watch={result} off={offline} atOpen />
    </Screen>
  );
}
