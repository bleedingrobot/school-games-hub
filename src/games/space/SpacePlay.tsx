import { useSearchParams } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { fetchSpaceSeed, saveAbandonedGame, saveSpaceGame } from '../../data/botGames';
import type { BotLevel } from '../types';
import { SpaceSolo, type SpaceSaving } from './SpaceSolo';

const saving: SpaceSaving = { seed: fetchSpaceSeed, save: saveSpaceGame, abandon: saveAbandonedGame };

/** Wormholes & Black Holes against bots, for the signed-in student. Finished games are saved. */
export function SpacePlay({ level }: { level: BotLevel }) {
  const { profile } = useAuth();
  const [, setParams] = useSearchParams();
  return (
    <SpaceSolo
      player={{ name: profile?.display_name ?? 'You', avatar: profile?.avatar }}
      level={level}
      onLevelChange={(next) => setParams({ bot: next }, { replace: true })}
      saving={saving}
    />
  );
}
