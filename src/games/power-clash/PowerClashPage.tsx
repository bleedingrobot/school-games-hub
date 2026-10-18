import { useSearchParams } from 'react-router';
import { fetchPowerClashSeed, saveAbandonedGame, savePowerClashGame } from '../../data/botGames';
import type { BotLevel } from '../types';
import { PowerClashPlay, type PowerClashSaving } from './PowerClashPlay';

const saving: PowerClashSaving = {
  seed: () => fetchPowerClashSeed(),
  save: (report) => savePowerClashGame(report),
  abandon: (report) => saveAbandonedGame(report),
};

/** Power Clash for the signed-in student. Finished bot games are saved; two-player games on one screen aren't. */
export function PowerClashPage({ level }: { level: BotLevel }) {
  const [, setParams] = useSearchParams();
  return <PowerClashPlay level={level} onLevelChange={(next) => setParams({ bot: next }, { replace: true })} saving={saving} />;
}
