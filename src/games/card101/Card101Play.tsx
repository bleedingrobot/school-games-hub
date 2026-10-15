import { useSearchParams } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import type { BotLevel } from '../types';
import { Card101Solo } from './Card101Solo';

/** 101 against bots, for the signed-in student. Not saved yet (Stage 10.3). */
export function Card101Play({ level }: { level: BotLevel }) {
  const { profile } = useAuth();
  const [, setParams] = useSearchParams();
  return (
    <Card101Solo
      player={{ name: profile?.display_name ?? 'You', avatar: profile?.avatar }}
      level={level}
      onLevelChange={(next) => setParams({ bot: next }, { replace: true })}
    />
  );
}
