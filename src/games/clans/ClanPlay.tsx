import { useMemo } from 'react';
import { liveClanServer } from '../../data/clans';
import { ClanQuest } from './ClanQuest';

/** Clan Quest on the hub: the clan lives on the school's server (the `clans` function), not in the browser. */
export function ClanPlay() {
  const server = useMemo(() => liveClanServer(), []);
  return <ClanQuest server={server} />;
}
