/**
 * My rewards (docs/QUEST-REWARDS-PLAN.md): what class quests gave me, unused first. A Rename Scroll is used through the
 * profile's own-name part, so its button opens the name picker.
 */
import { useEffect, useState } from 'react';
import { questKind } from '../../shared/quests/kinds';
import { questReward, type QuestReward } from '../../shared/quests/rewards';
import { heroTitle } from '../../shared/quests/titles';
import { fetchMyQuestRewards, type MyQuestReward } from '../data/quests';
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

export function MyRewards({ rewards, failed, onUse }: { rewards: MyQuestReward[] | null; failed: boolean; onUse: (r: MyQuestReward) => void }) {
  if (failed) return <p className="panel__empty">We couldn’t load your rewards.</p>;
  if (!rewards) return <p className="panel__empty">Loading…</p>;
  if (rewards.length === 0) {
    return <p className="panel__empty">Finish a class quest to earn a reward. Your teacher picks what each quest gives.</p>;
  }
  const waiting = rewards.filter((r) => !r.usedAt);
  const used = rewards.filter((r) => r.usedAt);
  return (
    <div className="myrewards">
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
                {info?.ready && (
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
                {r.title && heroTitle(r.title) ? `: ${heroTitle(r.title)?.name}` : ''} · {questKind(r.kind)?.name ?? ''}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
