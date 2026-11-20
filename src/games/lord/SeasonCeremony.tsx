/**
 * The end-of-season ceremony (docs/plans/dragon-season-end/PLAN.md, stage 3): five pages shown once, the first time a
 * pupil opens Dragon Maths in a new season, and again from the Hall of Heroes. It reads the results saved by the
 * database when the season turned (lord_season_summary), so it shows the hero as they were, not the fresh one.
 */
import { useEffect, useState } from 'react';
import type { HeroClass } from '../../../shared/lord/types';
import { ARMOURS, CLASSES, WEAPONS } from '../../../shared/lord/data';
import { AvatarImage } from '../../avatar/AvatarImage';
import { paintedPictureByTier, paintedTrophy } from '../../avatar/paintedArt';
import type { SeasonSummary } from '../../data/lord';
import { speak, stopSpeaking } from '../../speech';
import type { SceneId } from './art';
import { BigStage } from './Fight';
import { SeasonChanges } from './SeasonRoad';
import { HeroSprite } from './Sprite';

/** Where Bella's clips are (public/voice/lord-season, made with scripts/voice-clips.py). */
export const CEREMONY_VOICE = 'voice/lord-season/';

/** What Bella says on each page. Fixed words (no names or numbers), so each one has a recorded clip. */
export const CEREMONY_LINES = [
  'The season is over! The Red Dragon has gone back to sleep. For now.',
  'These heroes beat the Red Dragon. Their names stay in the Hall of Heroes forever.',
  'Here is your hero at the end of the season. Look at everything you did!',
  'Your dragon stars, trophies and titles stay forever. Your level, gold and gear start again.',
  'A new season begins! Everyone starts again, so anyone can be the next dragon slayer. Pick your hero!',
] as const;

const SCENES: SceneId[] = ['lair-asleep', 'hall-banners', 'village', 'news', 'village-dawn'];

const TROPHY_NAMES: Record<string, string> = {
  'dm-first-five': 'Dragon Head',
  'dm-slayer': 'Slayer’s Sword',
  'dm-crown': 'Dragon Slayer’s Crown',
  'dm-veteran': 'Season Veteran',
};

function TrophyPicture({ id }: { id: string }) {
  const src = id === 'dm-first-five' ? paintedPictureByTier('dragon-head')?.gold.artSmall : paintedTrophy(id, 'gold', true);
  if (src) return <img src={src} alt="" width={72} height={72} />;
  return <span className="lord-ceremony__trophy-emoji" aria-hidden="true">{id === 'dm-veteran' ? '🎖️' : '🏆'}</span>;
}

export function SeasonCeremony({ summary, look, canPick, onDone }: {
  summary: SeasonSummary;
  /** The new season's class pick is open (the first time it shows). Watched again from the Hall: just "Done". */
  canPick: boolean;
  /** The hero's look (it is kept from season to season). */
  look?: string;
  /** 'class' to pick a hero next, 'village' to carry on. */
  onDone: (next: 'class' | 'village') => void;
}) {
  const [page, setPage] = useState(0);
  const last = CEREMONY_LINES.length - 1;
  const n = summary.season;

  useEffect(() => {
    speak(CEREMONY_LINES[page], CEREMONY_VOICE);
  }, [page]);
  useEffect(() => stopSpeaking, []);

  const mine = summary.mine;
  const heroClass = (mine.heroClass in CLASSES ? mine.heroClass : 'knight') as HeroClass;
  const top = summary.slayers[0];

  let body;
  switch (page) {
    case 0:
      body = (
        <>
          <p className="lord-ceremony__kicker">The sun sets on Season {n}</p>
          <h2 className="lord-ceremony__title">Season {n} is over!</h2>
          <p className="lord-ceremony__lead">Scorchtail the Red Dragon has crawled back into the lair to sleep… for now.</p>
          <p className="lord-ceremony__big">
            {summary.kills > 0
              ? <>The heroes of your school beat the dragon <strong>{summary.kills}</strong> {summary.kills === 1 ? 'time' : 'times'}!</>
              : <>Nobody beat the dragon this season. It is still waiting…</>}
          </p>
        </>
      );
      break;
    case 1:
      body = (
        <>
          <h2 className="lord-ceremony__title">The Hall of Heroes</h2>
          {summary.slayers.length === 0 && <p className="lord-ceremony__lead">No names this time. Will yours be the first in Season {n + 1}?</p>}
          {top && top.kills >= 2 && (
            <div className="lord-ceremony__champion">
              <span className="lord-ceremony__crown" aria-hidden="true">👑</span>
              <AvatarImage avatar={top.avatar} size={64} />
              <div>
                <strong>{top.name}</strong>{top.isMe && ' (you!)'}
                <span>Ultimate Dragon Slayer: beat the dragon {top.kills} times!</span>
              </div>
            </div>
          )}
          <ul className="lord-ceremony__slayers">
            {summary.slayers.filter((s) => !(s === top && s.kills >= 2)).map((s, i) => (
              <li key={`${s.name}-${i}`} className={s.isMe ? 'is-me' : undefined} style={{ animationDelay: `${0.15 * i}s` }}>
                <AvatarImage avatar={s.avatar} size={36} />
                <span>{s.name}{s.isMe && ' (you!)'}</span>
                <span aria-hidden="true">{'⚔️'.repeat(Math.min(3, s.kills))}</span>
              </li>
            ))}
          </ul>
        </>
      );
      break;
    case 2:
      body = (
        <>
          <h2 className="lord-ceremony__title">Your Season {n}</h2>
          <div className="lord-ceremony__mine">
            <div className="lord-ceremony__hero"><HeroSprite heroClass={heroClass} look={look} scale={6} label={`Your ${CLASSES[heroClass].name}`} /></div>
            <dl className="lord-ceremony__stats">
              <div><dt>Class</dt><dd>{CLASSES[heroClass].name}</dd></div>
              <div><dt>Level</dt><dd>{mine.level}</dd></div>
              <div><dt>Masters beaten</dt><dd>{mine.masters}</dd></div>
              <div><dt>Forest wins</dt><dd>{mine.forestWins}</dd></div>
              <div><dt>Arena wins</dt><dd>{mine.arenaWins}</dd></div>
              <div><dt>Gold</dt><dd>{mine.gold}</dd></div>
              <div><dt>Weapon</dt><dd>{WEAPONS[mine.weapon]?.name ?? '—'}</dd></div>
              <div><dt>Armour</dt><dd>{ARMOURS[mine.armour]?.name ?? '—'}</dd></div>
              <div><dt>Dragon wins</dt><dd>{mine.dragons}</dd></div>
            </dl>
          </div>
          {summary.trophies.length > 0 && (
            <>
              <h3 className="lord-ceremony__sub">Trophies you won</h3>
              <ul className="lord-ceremony__trophies">
                {summary.trophies.map((id, i) => (
                  <li key={id} className={id === 'dm-veteran' ? 'is-new' : undefined} style={{ animationDelay: `${0.3 + 0.3 * i}s` }}>
                    <TrophyPicture id={id} />
                    <span>{TROPHY_NAMES[id] ?? id}</span>
                  </li>
                ))}
              </ul>
              {summary.trophies.includes('dm-veteran') && <p className="lord-ceremony__lead">You played the whole season, so you are a <strong>Season {n} Hero</strong>. The Season Veteran trophy is on your shelf for good.</p>}
            </>
          )}
        </>
      );
      break;
    case 3:
      body = (
        <>
          <h2 className="lord-ceremony__title">What stays, and what starts again</h2>
          <SeasonChanges />
        </>
      );
      break;
    default:
      body = (
        <>
          <p className="lord-ceremony__kicker">A new dawn over the village</p>
          <h2 className="lord-ceremony__title">Season {n + 1} begins!</h2>
          <p className="lord-ceremony__lead">Everyone starts at level 1, so it’s a fair race. Train hard, beat the masters, and face the dragon before the season ends.</p>
          {canPick && <p className="lord-ceremony__lead">You can pick a new class, or keep the one you had.</p>}
        </>
      );
  }

  return (
    <BigStage scene={SCENES[page]} label={`Season ${n} ceremony`} className="lord-ceremony">
      <div className="lord-ceremony__card" key={page}>{body}</div>
      <div className="lord-big__bar lord-ceremony__bar">
        <span className="lord-ceremony__dots" aria-label={`Page ${page + 1} of ${last + 1}`}>
          {CEREMONY_LINES.map((_, i) => <span key={i} className={i === page ? 'is-on' : undefined} />)}
        </span>
        {page > 0 && <button type="button" className="lord-btn lord-btn--glass" onClick={() => setPage(page - 1)}>Back</button>}
        <button type="button" className="lord-btn lord-btn--glass" onClick={() => speak(CEREMONY_LINES[page], CEREMONY_VOICE)} aria-label="Say it again">🔊</button>
        {page < last
          ? <button type="button" className="lord-btn lord-btn--hot lord-btn--big" autoFocus onClick={() => setPage(page + 1)}>Next</button>
          : canPick
            ? <>
                <button type="button" className="lord-btn lord-btn--hot lord-btn--big" autoFocus onClick={() => onDone('class')}>Pick your hero</button>
                <button type="button" className="lord-btn lord-btn--glass" onClick={() => onDone('village')}>Keep my class</button>
              </>
            : <button type="button" className="lord-btn lord-btn--hot lord-btn--big" autoFocus onClick={() => onDone('village')}>Done</button>}
        {page < last && <button type="button" className="lord-btn lord-btn--glass" onClick={() => setPage(last)}>Skip</button>}
      </div>
    </BigStage>
  );
}
