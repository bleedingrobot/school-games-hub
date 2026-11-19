/**
 * "Yes" on the hub's challenge banner (src/components/ChallengeBanner.tsx) opens the game as `#/<game>?ask=<id>`. Once
 * the game's own "here" lists that challenge, this says yes to it with the game's own step (the same one its pop-up's
 * Yes uses), once, and takes `ask` out of the address.
 *
 * It reads the address itself rather than through the router, so a game still works where it's shown without one.
 * `asks` is the ids of the challenges waiting for this pupil; pass [] until the game is ready to show a fight.
 */
import { useEffect, useRef, useState } from 'react';

/** The `ask` in the hash address (`#/archery?ask=7`), or 0. */
export function askInAddress(hash = window.location.hash): number {
  const query = hash.split('?')[1] ?? '';
  const id = Number(new URLSearchParams(query).get('ask'));
  return Number.isSafeInteger(id) && id > 0 ? id : 0;
}

function dropAskFromAddress() {
  const [path, query = ''] = window.location.hash.split('?');
  const params = new URLSearchParams(query);
  params.delete('ask');
  const rest = params.toString();
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${path}${rest ? `?${rest}` : ''}`);
}

export function useAskFromHub(asks: number[], onYes: (id: number) => void): void {
  const [wanted, setWanted] = useState(askInAddress);
  const yes = useRef(onYes);
  yes.current = onYes;
  useEffect(() => {
    if (!wanted || !asks.includes(wanted)) return;
    setWanted(0);
    dropAskFromAddress();
    yes.current(wanted);
  }, [wanted, asks]);
}
