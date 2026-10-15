import { useSearchParams } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { fetch101Seed, save101Game, saveAbandonedGame } from '../../data/botGames';
import type { BotLevel } from '../types';
import { Card101Solo, type Card101Saving } from './Card101Solo';

const saving: Card101Saving = { seed: fetch101Seed, save: save101Game, abandon: saveAbandonedGame };

/** 101 against bots, for the signed-in student. Finished games are saved. */
export function Card101Play({ level }: { level: BotLevel }) {
  const { profile } = useAuth();
  const [, setParams] = useSearchParams();
  return (
    <Card101Solo
      player={{ name: profile?.display_name ?? 'You', avatar: profile?.avatar }}
      level={level}
      onLevelChange={(next) => setParams({ bot: next }, { replace: true })}
      saving={saving}
    />
  );
}
