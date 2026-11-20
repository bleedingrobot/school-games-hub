/**
 * The new-season ceremony (docs/plans/clans-season-end/PLAN.md, stage 3): five pages shown once, the first time a pupil opens
 * Clan Quest in a new season, and again from the Hall of Legends. It reads what the database saved when the season turned
 * (clan_season_summary), so it shows the clan as it was, not the fresh one. Clan names only, like the Scoreboard: never a pupil's name. Arrow keys turn the pages; Escape skips to the end.
 */
import { useEffect, useRef, useState } from 'react';
import { MONSTER_LOOKS, monsterOf } from '../../../shared/clans/monster';
import { BUILDING_NAMES } from '../../../shared/clans/empire';
import { CONFIG } from '../../../shared/clans/config';
import { isLook } from '../../../shared/clans/looks';
import { VILLAGE_BUILDINGS } from '../../../shared/clans/types';
import { paintedTrophy } from '../../avatar/paintedArt';
import type { ClanSeasonSummary } from '../../data/clans';
import { speak, stopSpeaking } from '../../speech';
import { bannerArt, buildingArt, memberThumb, sceneArt, seasonMonsterArt, stageArt, type SceneId } from './art';
import { SeasonChanges } from './SeasonRoad';

/** Where Bella's clips are (public/voice/clans-season, made with scripts/voice-clips.py). */
export const CEREMONY_VOICE = 'voice/clans-season/';

/** What Bella says on each page. Fixed words (no names, numbers or monsters), so each one has a recorded clip for every season. */
export const CEREMONY_LINES = [
  'The season is over! Every clan fought hard. Here is what happened.',
  'These clans won the most fame. Their names stay in the Hall of Legends forever.',
  'Here is your clan at the end of the season. Look at everything you did!',
  'Your trophies, achievements and the Hall of Legends stay forever. Your levels, gold and buildings start again.',
  'A new season begins! Every clan starts again, so anyone can be the champions. A new monster is coming!',
] as const;

const SCENES: SceneId[] = ['town', 'scoreboard', 'village', 'church', 'town'];

const TROPHY_NAMES: Record<string, string> = {
  'clan-tooth': 'Monster Tooth',
  'clan-banner': 'Clan Banner',
  'clan-veteran': 'Clan Veteran',
};

/** The Clan Veteran's metal: bronze for a first season, silver for a second, gold after (as the database gives it). */
const tierOf = (season: number) => (season <= 1 ? 'bronze' : season === 2 ? 'silver' : 'gold');

function TrophyPicture({ id, season }: { id: string; season: number }) {
  const src = paintedTrophy(id, id === 'clan-veteran' ? tierOf(season) : 'gold', true);
  if (src) return <img src={src} alt="" width={72} height={72} />;
  return <span className="cq-ceremony__trophy-emoji" aria-hidden="true">{id === 'clan-veteran' ? '🎖️' : id === 'clan-banner' ? '🚩' : '🦷'}</span>;
}

function Banner({ clanName, size }: { clanName: string; size: number }) {
  const src = bannerArt(clanName);
  return src ? <img className="cq-ceremony__banner" src={src} alt="" width={size} height={size} /> : <span className="cq-ceremony__banner cq-ceremony__banner--drawn" aria-hidden="true">🛡️</span>;
}

/** The buildings a clan had at the season's end, from what was saved: [name, level, kind] for each above level 0. */
export function builtList(buildings: Record<string, unknown>): { kind: (typeof VILLAGE_BUILDINGS)[number]; name: string; level: number }[] {
  return VILLAGE_BUILDINGS.map((kind) => ({ kind, name: BUILDING_NAMES[kind], level: Number(buildings?.[kind] ?? 0) }))
    .filter((b) => Number.isFinite(b.level) && b.level > 0);
}

export function SeasonCeremony({ summary, canRepick, onDone }: {
  summary: ClanSeasonSummary;
  /** The new season's race-and-class pick is still open (the first time it shows). Watched again from the Hall: just "Done". */
  canRepick: boolean;
  /** 'repick' to pick races and classes next, 'keep' to keep them all, 'done' to carry on. */
  onDone: (next: 'repick' | 'keep' | 'done') => void;
}) {
  const [page, setPage] = useState(0);
  const last = CEREMONY_LINES.length - 1;
  const n = summary.season;
  const oldMonster = MONSTER_LOOKS[monsterOf(n)];
  const newKind = monsterOf(n + 1);
  const newMonster = MONSTER_LOOKS[newKind];
  const next = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    speak(CEREMONY_LINES[page], CEREMONY_VOICE);
    next.current?.focus();
  }, [page]);
  useEffect(() => stopSpeaking, []);

  const go = (to: number) => setPage(Math.max(0, Math.min(last, to)));
  const keys = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' && page < last) go(page + 1);
    else if (e.key === 'ArrowLeft') go(page - 1);
    else if (e.key === 'Escape') go(last);
    else return;
    e.preventDefault();
  };

  const mine = summary.mine;
  const top = summary.top[0];
  const built = builtList(mine.buildings);
  const played = mine.fame > 0 || mine.bestLevel > 1;

  let body;
  switch (page) {
    case 0: {
      const giant = seasonMonsterArt(monsterOf(n));
      body = (
        <>
          <p className="cq-ceremony__kicker">The sun sets on Season {n}</p>
          <h2>Season {n} is over!</h2>
          {giant && <img className="cq-ceremony__monster" src={giant} alt="" />}
          <p className="cq-ceremony__lead">
            {CONFIG.season.length} days. {summary.clans} {summary.clans === 1 ? 'clan' : 'clans'}. {oldMonster.name} came to the village, and here’s what happened.
          </p>
          <p className="cq-ceremony__big">
            {summary.monsterWins > 0
              ? <><strong>{summary.monsterWins}</strong> {summary.monsterWins === 1 ? 'clan' : 'clans'} beat {oldMonster.short}!</>
              : <>No pupil’s clan beat {oldMonster.short} this time. He has stomped back to the mountains… for now.</>}
          </p>
        </>
      );
      break;
    }
    case 1:
      body = (
        <>
          <h2>The Hall of Legends</h2>
          <p className="cq-ceremony__lead">The school’s top clans by fame in Season {n}.</p>
          {summary.top.length === 0 && <p className="cq-ceremony__lead">No clan won any fame this time. Will yours be the first in Season {n + 1}?</p>}
          {top && (
            <div className={`cq-ceremony__champion${top.isMe ? ' is-me' : ''}`}>
              <span className="cq-ceremony__crown" aria-hidden="true">👑</span>
              <Banner clanName={top.clanName} size={64} />
              <div>
                <span className="cq-ceremony__gold">Season {n} Champions</span>
                <strong>{top.clanName}{top.isMe && ' (you!)'}</strong>
                <span>{top.fame.toLocaleString()} fame {top.monster && '🦷'}{top.village && '🏰'}</span>
              </div>
            </div>
          )}
          <ol className="cq-ceremony__scroll" start={2}>
            {summary.top.slice(1).map((c, i) => (
              <li key={`${c.clanName}-${i}`} className={c.isMe ? 'is-me' : undefined} style={{ animationDelay: `${0.15 * i}s` }}>
                <span className="cq-ceremony__place" aria-hidden="true">{i + 2}.</span>
                <Banner clanName={c.clanName} size={36} />
                <span className="cq-ceremony__clan">{c.clanName}{c.isMe && ' (you!)'}</span>
                <span>{c.fame.toLocaleString()} fame{c.monster && <span title={`Beat ${oldMonster.short}`}> 🦷</span>}{c.village && <span title="Finished the whole village"> 🏰</span>}</span>
              </li>
            ))}
          </ol>
          {summary.top.length > 0 && <p className="cq-soft cq-ceremony__key">🦷 beat {oldMonster.short} · 🏰 finished the whole village</p>}
          {summary.place === null || summary.place > 10 ? <p className="cq-ceremony__lead">Your clan could be here in Season {n + 1}!</p> : null}
        </>
      );
      break;
    case 2:
      body = (
        <>
          <h2>Your Season {n}</h2>
          <div className="cq-ceremony__clanhead">
            <Banner clanName={mine.clanName} size={56} />
            <div>
              <strong>{mine.clanName}</strong>
              <span>{mine.fame.toLocaleString()} fame{summary.place && summary.place <= 10 ? `, number ${summary.place} in the school` : ''}</span>
            </div>
          </div>
          {!played ? (
            <p className="cq-ceremony__lead">Your clan didn’t get going this season. Season {n + 1} is your clan’s chance!</p>
          ) : (
            <>
              <ul className="cq-ceremony__members">
                {mine.members.map((m) => {
                  const pic = memberThumb(m.race, m.cls, isLook(m.look) ? m.look : 'male-1');
                  return (
                    <li key={m.slot}>
                      {pic ? <img src={pic} alt="" width={64} height={64} /> : <span aria-hidden="true">🧝</span>}
                      <strong>{m.name}</strong>
                      <span>Level {m.level}</span>
                    </li>
                  );
                })}
              </ul>
              <dl className="cq-ceremony__stats">
                <div><dt>Gold</dt><dd>{mine.gold.toLocaleString()}</dd></div>
                <div><dt>Followers</dt><dd>{mine.followers.toLocaleString()}</dd></div>
                <div><dt>{oldMonster.short}</dt><dd>{mine.monsterBeaten ? 'Beaten! 🦷' : mine.monsterTries > 0 ? `${mine.monsterTries} ${mine.monsterTries === 1 ? 'try' : 'tries'}` : 'Not fought'}</dd></div>
                <div><dt>Village</dt><dd>{mine.villageDone ? 'Finished! 🏰' : `${built.length} of ${VILLAGE_BUILDINGS.length} buildings`}</dd></div>
              </dl>
              {built.length > 0 && (
                <ul className="cq-ceremony__buildings" aria-label="Buildings">
                  {built.map((b) => {
                    const art = buildingArt(b.kind, b.level);
                    return <li key={b.kind}>{art && <img src={art} alt="" width={48} height={48} />}<span>{b.name} {b.level}</span></li>;
                  })}
                </ul>
              )}
            </>
          )}
          {summary.trophies.length > 0 && (
            <>
              <h3>Trophies you won</h3>
              <ul className="cq-ceremony__trophies">
                {summary.trophies.map((id, i) => (
                  <li key={id} className={id === 'clan-veteran' ? 'is-new' : undefined} style={{ animationDelay: `${0.3 + 0.3 * i}s` }}>
                    <TrophyPicture id={id} season={n} />
                    <span>{TROPHY_NAMES[id] ?? id}</span>
                  </li>
                ))}
              </ul>
              {summary.trophies.includes('clan-veteran') && <p className="cq-ceremony__lead">Your clan played the season, so it is a <strong>Season {n} Clan</strong>. The Clan Veteran trophy is on your shelf for good.</p>}
            </>
          )}
        </>
      );
      break;
    case 3:
      body = (
        <>
          <h2>What stays, and what starts again</h2>
          <SeasonChanges />
        </>
      );
      break;
    default: {
      const coming = seasonMonsterArt(newKind);
      const dawn = stageArt('new');
      body = (
        <>
          <p className="cq-ceremony__kicker">A new dawn over the village</p>
          <h2>Season {n + 1} begins!</h2>
          {(coming ?? dawn) ? <img className="cq-ceremony__monster" src={coming ?? dawn} alt="" /> : <span className="cq-ceremony__big-emoji" aria-hidden="true">{newMonster.emoji}</span>}
          <p className="cq-ceremony__lead">
            Every clan starts at level 1, so it’s a fair race for fame. Something big is rumbling in the hills: <strong>{newMonster.name}</strong> is coming in monster week!
          </p>
          {canRepick && <p className="cq-ceremony__lead">You can pick your members’ races and classes again, or keep them.</p>}
        </>
      );
    }
  }

  const art = sceneArt(SCENES[page]);
  return (
    <div className="cq-ceremony" role="dialog" aria-modal="true" aria-label={`The Season ${n} ceremony`} onKeyDown={keys}>
      {art.wide && <div className="cq-ceremony__backdrop" style={{ backgroundImage: `url("${art.small ?? art.wide}")` }} aria-hidden="true" />}
      <div className="cq-ceremony__card" key={page} aria-live="polite">{body}</div>
      <div className="cq-ceremony__bar">
        <span className="cq-ceremony__dots" aria-label={`Page ${page + 1} of ${last + 1}`}>
          {CEREMONY_LINES.map((_, i) => <span key={i} className={i === page ? 'is-on' : undefined} />)}
        </span>
        {page > 0 && <button type="button" className="cq-btn" onClick={() => go(page - 1)}>Back</button>}
        <button type="button" className="cq-btn" onClick={() => speak(CEREMONY_LINES[page], CEREMONY_VOICE)} aria-label="Say it again">🔊</button>
        {page < last
          ? <button ref={next} type="button" className="cq-btn cq-btn--hot" onClick={() => go(page + 1)}>Next</button>
          : canRepick
            ? <>
                <button ref={next} type="button" className="cq-btn cq-btn--hot" onClick={() => onDone('repick')}>Pick your clan again</button>
                <button type="button" className="cq-btn" onClick={() => onDone('keep')}>Keep my clan</button>
              </>
            : <button ref={next} type="button" className="cq-btn cq-btn--hot" onClick={() => onDone('done')}>Done</button>}
        {page < last && <button type="button" className="cq-btn" onClick={() => go(last)}>Skip</button>}
      </div>
    </div>
  );
}
