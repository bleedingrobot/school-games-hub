import { useEffect, useState } from 'react';
import { fetchRules, RANKS, type Rules } from '../data/progress';

/**
 * "How points work", for students. The numbers come from the database, so this page
 * always says exactly what the scoring does.
 */
export function HowPoints() {
  const [rules, setRules] = useState<Rules | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    fetchRules()
      .then((r) => current && setRules(r))
      .catch(() => current && setFailed(true));
    return () => {
      current = false;
    };
  }, []);

  if (failed) return <p className="panel__empty">We couldn’t load this page just now. Please try again soon.</p>;
  if (!rules) return <p className="panel__empty">Loading…</p>;

  return (
    <div className="how-points">
      <h1 className="page-title">How points work</h1>

      <section className="panel" aria-labelledby="earn-title">
        <h2 id="earn-title" className="panel__title">
          Every game you finish earns points
        </h2>
        <table className="stats-table points-table">
          <caption>Points for each game</caption>
          <thead>
            <tr>
              <th scope="col">Playing</th>
              <th scope="col">Lose</th>
              <th scope="col">Draw</th>
              <th scope="col">Win</th>
            </tr>
          </thead>
          <tbody>
            {(
              [
                ['Very Easy bot', rules.bot['very-easy']],
                ['Easy bot', rules.bot.easy],
                ['Medium bot', rules.bot.medium],
                ['A friend', rules.friend],
              ] as const
            ).map(([who, p]) => (
              <tr key={who}>
                <th scope="row">{who}</th>
                <td>{p.lost}</td>
                <td>{p.drawn}</td>
                <td>{p.won}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="how-points__list">
          <li>
            <strong>Even losing earns points.</strong> Trying a harder bot earns more, and playing a friend earns the most.
          </li>
          <li>
            Bots can earn you up to <strong>{rules.botDailyCap} points a day</strong>. After that, bot games still count
            for achievements.
          </li>
          <li>
            Playing the same friend? Your first <strong>{rules.pairDailyLimit} games together each day</strong> earn
            points.
          </li>
          <li>
            Every achievement earns <strong>{rules.achievementPoints} bonus points</strong>.
          </li>
          <li>
            Games only count if you each make <strong>at least 10 moves</strong>. Leaving a game early earns nothing, and
            counts as a loss.
          </li>
        </ul>
      </section>

      <section className="panel" aria-labelledby="levels-title">
        <h2 id="levels-title" className="panel__title">
          Levels
        </h2>
        <p>Points take you up levels. Each level needs a few more points than the last.</p>
        <ol className="level-steps">
          {rules.levels.slice(1, 8).map((points, i) => (
            <li key={points}>
              <strong>Level {i + 2}</strong> <span>{points} points</span>
            </li>
          ))}
          <li>
            <strong>…and on!</strong>
          </li>
        </ol>
      </section>

      <section className="panel" aria-labelledby="badges-title">
        <h2 id="badges-title" className="panel__title">
          Badges: Bronze, Silver, Gold and Champion
        </h2>
        <p>
          You have a hidden score for chess and another for checkers. Everyone starts in the same place, with a{' '}
          {RANKS.bronze.emoji} Bronze badge.
        </p>
        <ul className="how-points__list">
          <li>Only games against friends change it. Bot games never do.</li>
          <li>When you win, you take some of the other player’s score. When you lose, they take some of yours.</li>
          <li>
            Beat someone better than you and you climb a lot. Beat someone newer than you and you climb only a little.
          </li>
          <li>One game can never change it by much, so keep playing!</li>
        </ul>
        <ul className="badge-steps">
          <li>
            {RANKS.silver.emoji} <strong>Silver:</strong> win about 3 more games than you lose, against players at your
            level
          </li>
          <li>
            {RANKS.gold.emoji} <strong>Gold:</strong> about 8 more wins than losses
          </li>
          <li>
            {RANKS.champion.emoji} <strong>Champion:</strong> keep beating good players, and play at least{' '}
            {rules.championMinGames} games against friends
          </li>
        </ul>
      </section>

      <section className="panel" aria-labelledby="boards-title">
        <h2 id="boards-title" className="panel__title">
          Leaderboards
        </h2>
        <ul className="how-points__list">
          <li>
            <strong>This week:</strong> points earned since Monday. Play at least {rules.weeklyMinGames} games this week
            to be on it.
          </li>
          <li>
            <strong>All time:</strong> the best players against friends, by badge. Play at least {rules.allTimeMinGames}{' '}
            games against friends to be on it.
          </li>
          <li>
            <strong>Most improved:</strong> who climbed the most this week. Play at least {rules.improvedMinGames} games
            against friends this week.
          </li>
        </ul>
      </section>
    </div>
  );
}
