/** Smash Quest's calm screens: picking a hero, home, and what an adventure earned. */
import { useState } from 'react';
import { CLASS_INFO, CLASSES, GEAR, INNKEEPER, LOOKS, SLOTS, gearById, gearStats, type GearInfo, trainerFor, zoneById, type HeroClass, type Look } from '../../../shared/bonkers/content';
import { MAX_LEVEL } from '../../../shared/bonkers/config';
import { heroPower, replay, starsToTrainer, type Hero, type Progress } from '../../../shared/bonkers/engine';
import type { AdventureView, FinishReply, LoadReply } from './backend';
import { nextBossWords, type BossStop, type SeasonView } from '../../../shared/bonkers/season';
import { grannySays, levelTitle, questWords, xp } from './words';

const LOOK_WORDS: Record<Look, string> = { boy: 'Boy', girl: 'Girl', animal: 'Animal' };

export function HeroPick({ hero, busy, onPick }: { hero: Hero | null; busy: boolean; onPick: (cls: HeroClass, look: Look) => void }) {
  const [cls, setCls] = useState<HeroClass | null>(hero?.cls ?? null);
  const [look, setLook] = useState<Look>(hero?.look ?? 'girl');
  const info = cls ? CLASS_INFO[cls] : null;
  return (
    <section className="bq-hero-pick" aria-label="Pick your hero">
      <Granny line={hero ? 'A new look? Lovely! Your class stays the same all season.' : `Welcome home! I’m ${INNKEEPER.name}. Pick your hero, dearie. You keep them all season!`} />
      <div className="bq-classes">
        {CLASSES.map((c) => {
          const ci = CLASS_INFO[c];
          const locked = !!hero && hero.cls !== c;
          return (
            <button
              key={c} type="button" className={`bq-class${cls === c ? ' bq-class--on' : ''}`} style={{ '--bq-c': ci.colour } as React.CSSProperties}
              aria-pressed={cls === c} disabled={locked} onClick={() => setCls(c)}
            >
              <span className="bq-class__emoji" aria-hidden="true">{ci.emoji[look]}</span>
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
      <button type="button" className="bq-btn bq-btn--big" disabled={!cls || busy} onClick={() => cls && onPick(cls, look)}>
        {info ? `Be the ${info.names[look]}!` : 'Pick a hero'}
      </button>
    </section>
  );
}

function Granny({ line }: { line: string }) {
  return (
    <div className="bq-granny">
      <span className="bq-granny__face" aria-hidden="true">{INNKEEPER.emoji}<span className="bq-granny__jet">🚀</span></span>
      <p className="bq-granny__bubble" aria-live="polite"><b>{INNKEEPER.name}:</b> {line}</p>
    </div>
  );
}

function HeroBadge({ hero, p }: { hero: Hero; p: Progress }) {
  const ci = CLASS_INFO[hero.cls];
  return (
    <div className="bq-badge" style={{ '--bq-c': ci.colour } as React.CSSProperties}>
      <span className="bq-badge__emoji" aria-hidden="true">{ci.emoji[hero.look]}</span>
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
            <span aria-hidden="true">{g?.emoji}</span> {g?.name}
            {g && <Stats g={g} />}
          </li>
        );
      })}
    </ul>
  );
}

const SHORT_DAY = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** The season's boss road: a Friday boss each week and the mega boss on the last Friday. Tap a stop for its line. */
function SeasonTimeline({ season }: { season: SeasonView }) {
  const [open, setOpen] = useState<number | null>(null);
  const pick = season.stops.find((s) => s.week === open) ?? season.stops.find((s) => s.state === 'today' || s.state === 'next') ?? null;
  const along = Math.min(100, Math.max(0, (100 * (season.day - 1)) / Math.max(1, season.days - 1)));
  const stopWords = (s: BossStop) => (s.state === 'beaten-time' ? 'Been and gone' : s.state === 'today' ? 'Today!' : SHORT_DAY(s.date));
  return (
    <section className="bq-card bq-season" aria-label={`Season ${season.number}, week ${season.week} of ${season.weeks}`}>
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
                <span className="bq-season__emoji" aria-hidden="true">{s.boss.emoji}</span>
                <span className="bq-season__label">{s.kind === 'mega' ? 'MEGA' : `Wk ${s.week}`}</span>
                <span className="bq-season__when">{stopWords(s)}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      {pick && (
        <p className="bq-season__note" aria-live="polite">
          <b>{pick.boss.emoji} {pick.boss.name}</b> {pick.kind === 'mega' ? '(the season’s mega boss)' : `(Friday, week ${pick.week})`}: {pick.boss.blurb}
          {pick.state === 'beaten-time' ? '' : ' Your class chips away at it all week!'}
        </p>
      )}
    </section>
  );
}

export function Inn({ loaded, busy, note, onQuest, onChangeLook }: {
  loaded: LoadReply; busy: boolean; note: string | null; onQuest: (id: string) => void; onChangeLook: () => void;
}) {
  const p = loaded.progress;
  const out = loaded.waiting === 0;
  return (
    <section className="bq-inn" aria-label="Home">
      <Granny line={grannySays(p, loaded.waiting)} />
      {loaded.season && <SeasonTimeline season={loaded.season} />}
      <div className="bq-card bq-inn__hero">
        {p.hero && <HeroBadge hero={p.hero} p={p} />}
        <StarBar p={p} />
        <LevelRoad level={p.level} />
        <GearRow p={p} />
        <button type="button" className="bq-link" onClick={onChangeLook}>Change your look</button>
      </div>
      <h2 className="bq-h2">
        Today’s quests
        <span className="bq-waiting">{loaded.waiting === null ? 'Unlimited today' : `${loaded.waiting} adventure${loaded.waiting === 1 ? '' : 's'} waiting`}</span>
      </h2>
      <div className="bq-quests">
        {loaded.quests.map((q) => {
          const zone = zoneById(q.zone);
          const w = questWords(q);
          const face = q.kind === 'big' ? zone?.big.emoji : q.kind === 'hunt' ? zone?.monsters[q.monster].emoji : zone?.monsters[0].emoji;
          return (
            <button
              key={q.id} type="button" className="bq-quest" disabled={busy || out} onClick={() => onQuest(q.id)}
              style={{ background: `linear-gradient(${zone?.sky[0]}, ${zone?.sky[1]} 70%, ${zone?.ground} 70%)` }}
            >
              <span className="bq-quest__face" aria-hidden="true">{face}</span>
              <span className="bq-quest__zone">{zone?.name}</span>
              <strong>{w.title}</strong>
              <span>{w.what}</span>
              <span className="bq-quest__go">{out ? 'Tomorrow!' : 'Go!'}</span>
            </button>
          );
        })}
      </div>
      {note && <p className="bq-note" role="alert">{note}</p>}
    </section>
  );
}

export function Results({ before, result, current, onInn }: { before: Progress; result: FinishReply; current: AdventureView; onInn: () => void }) {
  const r = replay(current.adventure, current.marks);
  const fights = r.results.filter((x) => !x.trainer);
  const won = fights.filter((x) => x.outcome === 'won').length;
  const trainer = trainerFor(before.level);
  const w = questWords(current.adventure.quest);
  return (
    <section className="bq-results bq-card" aria-label="Adventure done">
      <h2 className="bq-h2">{result.levelUp ? `Level ${result.levelUp}! ${levelTitle(result.levelUp)}!` : 'Adventure done!'}</h2>
      {result.levelUp && trainer && <p className="bq-big-line"><span aria-hidden="true">{trainer.emoji}</span> {trainer.beaten}</p>}
      {r.trainerMet && !r.trainerWon && trainer && <p className="bq-big-line"><span aria-hidden="true">{trainer.emoji}</span> {trainer.name} won this time. They’ll be waiting next adventure!</p>}
      <ul className="bq-tally">
        <li>🥊 Fights won: <b>{won} of {fights.length}</b></li>
        <li>{r.questDone ? '✅' : '➖'} {w.title}: <b>{r.questDone ? 'done!' : 'not this time'}</b></li>
        <li>✨ XP: <b>+{xp(result.starsEarned)}</b></li>
        {result.stickers > 0 && <li>🏷️ Stickers: <b>+{result.stickers}</b></li>}
      </ul>
      {result.gear.length > 0 && (
        <div className="bq-chest">
          <p className="bq-chest__lid" aria-hidden="true">🧰✨</p>
          <p>Treasure chest!</p>
          <ul>
            {result.gear.map((id) => {
              const g = gearById(id);
              return (
                <li key={id} className="bq-chest__item">
                  <span aria-hidden="true">{g?.emoji}</span> {g?.name} <span className="bq-chest__new">NEW!</span>
                  {g && <Stats g={g} />}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {result.points > 0 && <p className="bq-points">+{result.points} hub points</p>}
      <StarBar p={result.progress} />
      <button type="button" className="bq-btn bq-btn--big" onClick={onInn}>Back home</button>
    </section>
  );
}
