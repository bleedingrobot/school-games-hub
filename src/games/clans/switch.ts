import { useEffect, useState } from 'react';
import { fetchClansEnabled } from '../../data/clans';
import { CLAN_QUEST_ON } from '../registry';

/**
 * Is Clan Quest switched on by the teacher? null while loading (treated as off, so the card never flashes up).
 * Nothing is asked of the server while the code switch (CLAN_QUEST_ON) is off, because the card isn't there at all.
 */
export function useClansEnabled(): boolean | null {
  const [on, setOn] = useState<boolean | null>(CLAN_QUEST_ON ? null : false);
  useEffect(() => {
    if (!CLAN_QUEST_ON) return;
    let current = true;
    fetchClansEnabled().then((v) => current && setOn(v), () => current && setOn(false));
    return () => {
      current = false;
    };
  }, []);
  return on;
}
