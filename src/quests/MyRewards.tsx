/**
 * My rewards (docs/QUEST-REWARDS-PLAN.md): what class quests gave me, unused first. A Rename Scroll is used through the
 * profile's own-name part, so its button opens the name picker.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { questKind } from '../../shared/quests/kinds';
import { COIN_POUCH, questReward, type CoinGame, type QuestReward } from '../../shared/quests/rewards';
import { heroTitle } from '../../shared/quests/titles';
import { FriendlyError } from '../data/profile';
import { fetchMyQuestRewards, spendQuestReward, type MyQuestReward } from '../data/quests';
import './myRewards.css';

export function useMyQuestRewards() {
  const [rewards, setRewards] = useState<MyQuestReward[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [round, setRound] = useState(0);
  useEffect(() => {
    let live = true;
    fetchMyQuestRewards()
      .then((list) => live && setRewards(list))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [round]);
  return { rewards, failed, unused: rewards?.filter((r) => !r.usedAt).length ?? 0, reload: () => setRound((n) => n + 1) };
}

const USE_WORDS: Record<QuestReward, string> = {
  scroll: '✏️ Make up my name',
  title: 'Pick my title',
  turns: 'Use it today',
  frame: 'Pick my frame',
  coins: 'Open it',
};

const pouchOf = (r: MyQuestReward) => (r.game && r.game in COIN_POUCH ? COIN_POUCH[r.game as CoinGame] : undefined);

/** What a pouch holds, in the game's own words: "200 credits". */
function pouchWords(r: MyQuestReward) {
  const pouch = pouchOf(r);
  if (!pouch) return 'game money';
  if (r.game === 'dragon-maths') return r.amount ? `${r.amount.toLocaleString('en-NZ')} gold` : `${pouch.amount} forest wins of gold`;
  return `${(r.amount ?? pouch.amount).toLocaleString('en-NZ')} ${pouch.money}`;
}

const nzToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

/** A Bonus Turns Day: ask first, because it only lasts until midnight. */
function TurnsCard({ reward, onUsed }: { reward: MyQuestReward; onUsed: () => void }) {
  const kind = questKind(reward.kind);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function use() {
    setBusy(true);
    try {
      await spendQuestReward(reward.id, {});
      onUsed();
    } catch (e) {
      setError(e instanceof FriendlyError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  if (!asking) {
    return (
      <button type="button" className="button button--primary myrewards__use" onClick={() => setAsking(true)}>
        {USE_WORDS.turns}
      </button>
    );
  }
  return (
    <div className="myrewards__ask">
      <p>Unlimited turns in {kind?.game ?? 'this game'} until midnight tonight. Use it now?</p>
      <button type="button" className="button button--primary" disabled={busy} onClick={() => void use()}>
        Yes, use it today
      </button>
      <button type="button" className="button button--light-outline" disabled={busy} onClick={() => setAsking(false)}>
        Not today
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

export function MyRewards({
  rewards,
  failed,
  onUse,
  onChanged,
}: {
  rewards: MyQuestReward[] | null;
  failed: boolean;
  onUse: (r: MyQuestReward) => void;
  onChanged: () => void;
}) {
  if (failed) return <p className="panel__empty">We couldn’t load your rewards.</p>;
  if (!rewards) return <p className="panel__empty">Loading…</p>;
  if (rewards.length === 0) {
    return <p className="panel__empty">Finish a class quest to earn a reward. Your teacher picks what each quest gives.</p>;
  }
  const waiting = rewards.filter((r) => !r.usedAt);
  const used = rewards.filter((r) => r.usedAt);
  const today = nzToday();
  const bonusToday = used.filter((r) => r.reward === 'turns' && r.day === today);
  return (
    <div className="myrewards">
      {bonusToday.map((r) => {
        const kind = questKind(r.kind);
        return (
          <p key={r.id} className="myrewards__today">
            ⏳ Unlimited turns in {kind?.game ?? 'your game'} today!{' '}
            {kind && (
              <Link to={`/${kind.card}`} className="button button--play">
                Play {kind.game}
              </Link>
            )}
          </p>
        );
      })}
      {waiting.length > 0 && (
        <ul className="myrewards__shelf">
          {waiting.map((r) => {
            const info = questReward(r.reward);
            const kind = questKind(r.kind);
            return (
              <li key={r.id} className="myrewards__card">
                <span className="myrewards__emoji" aria-hidden="true">{info?.emoji ?? '🎁'}</span>
                <strong>{info?.name ?? 'Reward'}</strong>
                {kind && <small>From {kind.game}: {kind.name}</small>}
                {info?.ready && r.reward === 'turns' && <TurnsCard reward={r} onUsed={onChanged} />}
                {info?.ready && r.reward === 'coins' && (
                  <p className="myrewards__pouch">
                    {pouchWords(r)} waiting in {kind?.game ?? 'your game'}. Play to collect it!{' '}
                    {kind && (
                      <Link to={`/${kind.card}`} className="button button--play">
                        Play {kind.game}
                      </Link>
                    )}
                  </p>
                )}
                {info?.ready && r.reward !== 'turns' && r.reward !== 'coins' && (
                  <button type="button" className="button button--primary myrewards__use" onClick={() => onUse(r)}>
                    {USE_WORDS[r.reward]}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {used.length > 0 && (
        <details className="myrewards__used">
          <summary>Used ({used.length})</summary>
          <ul>
            {used.map((r) => (
              <li key={r.id}>
                {questReward(r.reward)?.emoji} {questReward(r.reward)?.name}
                {r.title && heroTitle(r.title) ? `: ${heroTitle(r.title)?.name}` : ''}
                {r.reward === 'coins' ? `: ${pouchWords(r)} in ${questKind(r.kind)?.game ?? 'your game'}` : ''}
                {r.reward === 'turns' && r.day ? ` (${questKind(r.kind)?.game ?? ''}, ${r.day === today ? 'today' : r.day})` : ''} ·{' '}
                {questKind(r.kind)?.name ?? ''}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
