// The preview's copy of src/data/powerGames.ts: the same types and helpers, but the calls go to the stand-in server.
export * from '../../src/data/powerGames';
export { askPower, fetchPowerGame, fetchMyOpenPowerGames, fetchPowerLobby, watchPowerGame } from './standIn';
