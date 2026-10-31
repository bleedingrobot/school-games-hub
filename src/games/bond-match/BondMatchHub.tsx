import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { makeSaver } from '../../data/bondMatch';
import { fetchMyLadder } from '../../data/ladder';
import type { BotLevel } from '../types';
import { BondMatchPlay } from './BondMatchPlay';
import { suggestBond, type BondSuggestion } from './suggest';

/**
 * Bond Match inside the hub: finished games are saved for the signed-in student (and queued if the server can't be reached).
 * The student's maths focus and ladder place are only read, to suggest a bond; Bond Match never writes anything maths-related.
 */
export function BondMatchHub({ level }: { level?: BotLevel }) {
  const { profile } = useAuth();
  const player = profile?.id;
  const saver = useMemo(() => (player ? makeSaver(player) : undefined), [player]);
  const [suggested, setSuggested] = useState<BondSuggestion | null>(null);

  useEffect(() => {
    if (!player) return;
    let live = true;
    // No suggestion is fine: the picker works as before if this can't be read.
    void fetchMyLadder().then((ladder) => { if (live) setSuggested(suggestBond(ladder)); }, () => undefined);
    return () => { live = false; };
  }, [player]);

  return <BondMatchPlay level={level} saver={saver} suggested={suggested} />;
}
