import { useMemo } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { makeSaver } from '../../data/bondMatch';
import type { BotLevel } from '../types';
import { BondMatchPlay } from './BondMatchPlay';

/** Bond Match inside the hub: finished games are saved for the signed-in student (and queued if the server can't be reached). */
export function BondMatchHub({ level }: { level?: BotLevel }) {
  const { profile } = useAuth();
  const player = profile?.id;
  const saver = useMemo(() => (player ? makeSaver(player) : undefined), [player]);
  return <BondMatchPlay level={level} saver={saver} />;
}
