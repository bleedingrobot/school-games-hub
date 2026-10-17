import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { fetchSpaceSeed, saveAbandonedGame, saveSpaceGame } from '../../data/botGames';
import { loadGemKeep } from '../../data/gemKeep';
import type { BotLevel } from '../types';
import { useMathsMode } from './mathsMode';
import { SpaceSolo, type SpaceMaths, type SpaceSaving } from './SpaceSolo';

const saving: SpaceSaving = { seed: fetchSpaceSeed, save: saveSpaceGame, abandon: saveAbandonedGame };

/** Wormholes & Black Holes against bots, for the signed-in student. Finished games are saved. */
export function SpacePlay({ level }: { level: BotLevel }) {
  const { profile } = useAuth();
  const [, setParams] = useSearchParams();
  // null: still reading the teacher's maths switch.
  const mode = useMathsMode();
  const player = profile?.id ?? '';
  // undefined: still loading the student's times-table records; null: no maths.
  const [maths, setMaths] = useState<SpaceMaths | null | undefined>(undefined);

  useEffect(() => {
    if (mode === null) return;
    if (mode === 'off') {
      setMaths(null);
      return;
    }
    let current = true;
    void loadGemKeep(player).then((data) => {
      if (!current) return;
      const { enabledTables, division, missingFactor, multipleChoice } = data.settings;
      setMaths({ mode, enabledTables, division, missingFactor, multipleChoice, facts: data.facts });
    });
    return () => {
      current = false;
    };
  }, [mode, player]);

  if (maths === undefined) {
    return (
      <p className="panel__empty" role="status">
        Getting Mission Control ready…
      </p>
    );
  }
  return (
    <SpaceSolo
      player={{ name: profile?.display_name ?? 'You', avatar: profile?.avatar }}
      level={level}
      onLevelChange={(next) => setParams((p) => ({ ...Object.fromEntries(p), bot: next }), { replace: true })}
      saving={saving}
      maths={maths ?? undefined}
    />
  );
}
