import { useEffect, useMemo, useState } from 'react';
import { fetchClanTypedNames, fetchScoreboard, liveClanServer } from '../../data/clans';
import { ClanQuest } from './ClanQuest';

/** Clan Quest on the hub: the clan lives on the school's server (the `clans` function), not in the browser. */
export function ClanPlay() {
  const server = useMemo(() => liveClanServer(), []);
  // The teacher's switch for made-up hero names. If it can't be read the list is used (the server checks again anyway).
  const [typedNames, setTypedNames] = useState(false);
  useEffect(() => {
    let current = true;
    fetchClanTypedNames().then((on) => current && setTypedNames(on), () => undefined);
    return () => {
      current = false;
    };
  }, []);
  return <ClanQuest server={server} board={fetchScoreboard} typedNames={typedNames} />;
}
