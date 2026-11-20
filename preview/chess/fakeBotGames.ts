// The preview saves nothing: these stand in for src/data/botGames.
export async function saveBotGame() {
  await new Promise((resolve) => setTimeout(resolve, 400));
}
export function saveAbandonedGame() {}
export async function refreshSaveToken() {}
