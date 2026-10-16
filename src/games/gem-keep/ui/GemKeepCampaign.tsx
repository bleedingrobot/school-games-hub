/**
 * The whole of Gem Keep: the campaign map, and a level once one is picked.
 */
import { useState } from 'react';
import { CAMPAIGN } from '../../../../shared/gem-keep/levels';
import type { SkillPack } from '../../../../shared/maths/skillPack';
import { TimesTables } from '../../../../shared/maths/skillPacks/timesTables';
import type { GameEngine } from '../engine/GameEngine';
import { loadProgress, saveProgress, withKey, withWin, type CampaignProgress } from '../progress';
import { DEFAULT_SETTINGS, type GemKeepSettings } from '../settings';
import { CampaignMap } from './CampaignMap';
import { GemKeepGame } from './GemKeepGame';

export function GemKeepCampaign({
  settings = DEFAULT_SETTINGS,
  onEngine,
}: {
  settings?: GemKeepSettings;
  onEngine?: (engine: GameEngine) => void;
}) {
  const [progress, setProgress] = useState<CampaignProgress>(loadProgress);
  const [playing, setPlaying] = useState<number | null>(null);
  // One set of maths records for the whole visit, so mastery carries from level to level.
  const [pack] = useState<SkillPack>(() => new TimesTables());

  function update(change: (p: CampaignProgress) => CampaignProgress) {
    setProgress((p) => {
      const next = change(p);
      saveProgress(next);
      return next;
    });
  }

  if (playing === null) return <CampaignMap progress={progress} onPlay={setPlaying} />;
  const level = CAMPAIGN[playing];
  return (
    <GemKeepGame
      key={level.id}
      level={level}
      levelNumber={playing + 1}
      settings={settings}
      pack={pack}
      onEngine={onEngine}
      keyDone={!!progress[level.id]?.keyPassed}
      onWin={(stars) => update((p) => withWin(p, level.id, stars))}
      onKeyPassed={() => update((p) => withKey(p, level.id))}
      onNext={playing + 1 < CAMPAIGN.length ? () => setPlaying(playing + 1) : undefined}
      onMap={() => setPlaying(null)}
    />
  );
}
