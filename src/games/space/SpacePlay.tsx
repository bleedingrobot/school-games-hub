import { useSearchParams } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import type { BotLevel } from '../types';
import { SpaceSolo } from './SpaceSolo';

/** Wormholes & Black Holes against bots, for the signed-in student. */
export function SpacePlay({ level }: { level: BotLevel }) {
  const { profile } = useAuth();
  const [, setParams] = useSearchParams();
  return (
    <SpaceSolo
      player={{ name: profile?.display_name ?? 'You', avatar: profile?.avatar }}
      level={level}
      onLevelChange={(next) => setParams({ bot: next }, { replace: true })}
    />
  );
}
