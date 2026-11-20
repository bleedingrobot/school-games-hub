import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { isDaily, questKind } from '../../shared/quests/kinds';
import { questReward } from '../../shared/quests/rewards';
import { questWeek, weekday } from '../../shared/quests/week';
import type { MyQuest } from '../data/quests';
import type { MovesByGame } from '../data/movesLeft';
import { paintedTrophy } from '../avatar/paintedArt';
import type { Tier } from '../avatar/earnedPictures';
import { questArt } from './art';
import './questBar.css';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Quests done → the Questing Hero metal that win gives (migration 20261118000100, quest_won). */
const TROPHY_AT: Record<number, Tier> = { 5: 'bronze', 10: 'silver', 20: 'gold' };

function remembered(key: string): number {
  try {
    return Number(localStorage.getItem(key) ?? '') || 0;
  } catch {
    return 0;
  }
}
function remember(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* nothing depends on it */
  }
}

/**
 * The weekly class quest on the home page (docs/CLASS-QUESTS-PLAN.md): the quest's painting with seven day-stones across it.
 * The quest comes in the home page's one answer (my_home_page). Shows nothing when the class has no quest. Days newly lit since
 * the pupil last looked flare up; a win plays a fanfare once.
 */
export function QuestBar({ quest: mine, moves }: { quest: MyQuest | null | undefined; moves?: MovesByGame }) {
  const kind = questKind(mine?.quest.kind);
  const week = useMemo(
    () => (mine ? questWeek(mine.quest.startsOn, mine.today, mine.days, mine.quest.daysNeeded) : null),
    [mine],
  );

  // Which stones are newly lit, and whether the win fanfare is still to play (both remembered per quest in this browser).
  // Each is only remembered once it has been seen, as the home page can open twice in a row.
  const [seenLit, setSeenLit] = useState<number | null>(null);
  const [seenCount, setSeenCount] = useState<number | null>(null);
  const [fanfare, setFanfare] = useState(false);
  const wonKey = mine ? `quest-won-${mine.quest.id}` : '';
  useEffect(() => {
    if (!mine || !week) return;
    const litKey = `quest-lit-${mine.quest.id}`;
    const countKey = `quest-count-${mine.quest.id}`;
    setSeenLit(remembered(litKey));
    setSeenCount(remembered(countKey));
    if (mine.won && !remembered(`quest-won-${mine.quest.id}`)) setFanfare(true);
    const seen = window.setTimeout(() => {
      remember(litKey, week.done);
      remember(countKey, mine.count ?? 0);
    }, 2500);
    return () => window.clearTimeout(seen);
  }, [mine, week]);

  if (!mine || !kind || !week) return null;

  const art = questArt(kind.id);
  const todayStone = week.days.find((d) => d.date === mine.today);
  const chip = moves?.[kind.card]?.chips[0];
  const turnsLeft = chip ? Number.parseInt(chip.text, 10) : NaN;
  // A daily quest counts lit days (5 of 7); a weekly one counts goes, planets or villagers towards its target.
  const daily = isDaily(kind.rule);
  const count = daily ? week.done : (mine.count ?? 0);
  const target = daily ? week.needed : (mine.target ?? kind.amount ?? 1);
  const toGo = Math.max(0, target - count);
  let todayLine: string;
  if (!week.running) todayLine = mine.won ? 'Quest complete! Ask your teacher for the next one.' : 'This quest is over.';
  else if (mine.won) todayLine = 'You did it! Keep playing for fun.';
  else if (!daily) todayLine = `${kind.goal} this week: ${plural(toGo, 'more', 'more')} to go.`;
  else if (todayStone?.state === 'done') todayLine = 'Today done! ✓ Come back tomorrow.';
  else if (kind.rule === 'turns' && Number.isFinite(turnsLeft) && turnsLeft > 0) todayLine = `${kind.goal}: ${plural(turnsLeft, kind.unit.one, kind.unit.many)} left today.`;
  else todayLine = `${kind.goal} today.`;
  const showPlay = week.running && !mine.won && (!daily || todayStone?.state !== 'done');
  const grew = !daily && seenCount !== null && count > seenCount;

  const fill = Math.min(1, count / target);
  // This win reached a new metal of the Questing Hero trophy (the server gives it at 5, 10 and 20 quests).
  const metal = TROPHY_AT[mine.questsDone];
  const reward = questReward(mine.quest.reward);
  const trophy = metal ? paintedTrophy('quest-hero', metal) : undefined;
  let litOrder = 0;
  return (
    <section
      className={`qbar qbar--${kind.id}${mine.won ? ' qbar--won' : ''}${week.running ? '' : ' qbar--over'}`}
      aria-label={`Class quest: ${kind.game}, ${kind.name}. ${count} of ${daily ? `${target} days` : plural(target, kind.unit.one, kind.unit.many)}.`}
      style={{ '--qbar-art': art ? `url(${art})` : undefined, '--qbar-fill': fill } as CSSProperties}
    >
      <div className="qbar__art" aria-hidden="true" />
      <div className="qbar__shade" aria-hidden="true" />
      <div className="qbar__sparkles" aria-hidden="true">
        {Array.from({ length: 10 }, (_, n) => (
          <i key={n} style={{ '--n': n } as CSSProperties} />
        ))}
      </div>

      <header className="qbar__top">
        <span className="qbar__tag">⚔️ {daily ? 'Daily' : 'Weekly'} class quest</span>
        <h2 className="qbar__title">
          {kind.game}: <strong>{kind.name}</strong>
        </h2>
        {reward && (
          <span className="qbar__reward" title={reward.what}>
            🎁 {reward.emoji} {reward.name}
          </span>
        )}
        {mine.classWon > 0 && (
          <span className="qbar__class" title="Classmates who have finished this quest">
            🏅 {plural(mine.classWon, 'hero', 'heroes')} finished
          </span>
        )}
      </header>

      <ol className="qbar__stones">
        {week.days.map((d, n) => {
          const fresh = d.state === 'done' && seenLit !== null && litOrder++ >= seenLit;
          return (
            <li
              key={d.date}
              className={`qbar__stone is-${d.state}${fresh ? ' is-fresh' : ''}`}
              style={{ '--i': n } as CSSProperties}
              aria-label={`${weekday(d.date)}: ${d.state === 'done' ? 'done' : d.state === 'today' ? 'today' : d.state === 'missed' ? 'missed' : 'still to come'}`}
            >
              <span className="qbar__gem">{d.state === 'done' ? kind.spark : d.state === 'missed' ? '·' : ''}</span>
              <span className="qbar__day">{d.date === mine.today ? 'Today' : weekday(d.date)}</span>
            </li>
          );
        })}
      </ol>

      <footer className="qbar__bottom">
        <div className={`qbar__meter${grew ? ' is-growing' : ''}`} aria-hidden="true">
          <div className="qbar__meter-fill" />
        </div>
        <p className="qbar__count">
          <strong>
            {Math.min(count, target)} of {daily ? `${target} days` : plural(target, kind.unit.one, kind.unit.many)}
          </strong>
          {week.running && !mine.won && ` · ${plural(week.left, 'day', 'days')} left`}
          {mine.won && ' · Quest complete! 🏆'}
          {daily && week.outOfReach && !mine.won && ' · keep playing for next time!'}
        </p>
        <p className="qbar__today">{todayLine}</p>
        {mine.won && reward && mine.myReward && (
          <Link to="/profile#rewards" className="button button--primary qbar__go">
            {reward.emoji} Use my {reward.name}
          </Link>
        )}
        {showPlay && (
          <Link to={`/${kind.card}`} className="button button--play qbar__go">
            <span aria-hidden="true">▶</span> Play {kind.game}
          </Link>
        )}
      </footer>

      {fanfare && (
        <div className="qbar__fanfare" role="status" onAnimationEnd={(e) => {
            if (e.target !== e.currentTarget) return;
            remember(wonKey, 1);
            setFanfare(false);
          }}>
          <div className="qbar__burst" aria-hidden="true" />
          {Array.from({ length: 24 }, (_, n) => (
            <i key={n} className="qbar__confetti" style={{ '--n': n } as CSSProperties} aria-hidden="true" />
          ))}
          <p className="qbar__banner">
            {trophy && <img className="qbar__trophy" src={trophy} alt="" />}
            <span>Quest complete!</span>
            {trophy && <small>Questing Hero trophy: {TROPHY_AT[mine.questsDone]}!</small>}
            {reward && mine.myReward && (
              <small className="qbar__got">
                You earned a {reward.emoji} {reward.name}!
              </small>
            )}
            <small>{plural(mine.questsDone, 'quest', 'quests')} done</small>
          </p>
        </div>
      )}
    </section>
  );
}
