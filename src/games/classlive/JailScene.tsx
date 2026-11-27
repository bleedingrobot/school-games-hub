/**
 * Real-life Four Corners on the big screen (docs/JAIL-PLAN.md): the classroom countdown-and-dice page (jailStage.ts),
 * fed with who is in jail and who has just come back in, from the room's screen row.
 */
import { useEffect, useRef } from 'react';
import type { JailGame } from '../../../shared/classlive/jail';
import { rosterNames } from '../../../shared/classlive/jailServer';
import type { ScreenView } from '../../../shared/classlive/server';
import { voiceSlug } from '../../speech';
import { trackUrl, type Track } from './music';
import { painted } from './paintedArt';
import { mountJailStage } from './jailStage';
import { next, VOICE_FOLDER } from './voiceLines';

interface Stage {
  setJail(list: { id: string; name: string }[], backs: number, how: string): void;
  backIn(name: string): void;
  setCode(code: string | null): void;
  showOver(text: string, names: string[]): void;
  destroy(): void;
}

/** The classroom page's file names, from the hub's own copies of the pictures, music and Bella's clips. */
function asset(file: string): string {
  const m = /^(map|back|dice)-([a-z]+)\.webp$/.exec(file);
  if (m) return (m[1] === 'dice' ? painted('corners-fx', `dice-${m[2]}`) : painted('corners', `${m[1]}-${m[2]}`)) ?? '';
  const t = /^(corners-[a-z]+(?:-hot)?)\.mp3$/.exec(file);
  if (t) return trackUrl(t[1] as Track) ?? '';
  return '';
}

export function JailScene({ screen, game, over, onEnd, onRelease, onAgain }: {
  screen: ScreenView;
  game: JailGame;
  over: boolean;
  onEnd: () => void;
  onRelease: (pupil: string) => void;
  onAgain: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<Stage | null>(null);
  const seen = useRef<number | null>(null);
  const hooks = useRef({ onEnd, onRelease, onAgain });
  hooks.current = { onEnd, onRelease, onAgain };
  const names = rosterNames(game);
  const nameOf = (id: string) => (screen.showNames ? names[id] ?? 'Someone' : 'Someone');

  useEffect(() => {
    if (!host.current) return;
    const s = mountJailStage(host.current, {
      map: game.map,
      asset,
      voice: (line: string) => `${VOICE_FOLDER}${line}.mp3`,
      backLine: () => voiceSlug(next('backIn')),
      onEnd: () => hooks.current.onEnd(),
      onRelease: (id: string) => hooks.current.onRelease(id),
      onAgain: () => hooks.current.onAgain(),
    }) as Stage;
    stage.current = s;
    return () => { s.destroy(); stage.current = null; };
    // One stage for the whole game (its map can be changed on it).
  }, []);

  // Who is in jail (names only: no scores on the big screen).
  const inJail = Object.entries(game.mine).filter(([, m]) => m.inAt !== null).sort((a, b) => (a[1].inAt as number) - (b[1].inAt as number)).map(([id]) => id);
  const key = `${inJail.join(',')}|${game.backs.length}|${screen.showNames}`;
  useEffect(() => {
    stage.current?.setJail(
      inJail.map((id) => ({ id, name: nameOf(id) })), game.backs.length,
      `Out? Tap your name on a jail station and get ${game.need} right. Tap a name here to let them out.`,
    );
  }, [key]);

  useEffect(() => { stage.current?.setCode(over ? null : screen.joinCode); }, [screen.joinCode, over]);

  // "<name> is back in!" once for each new comeback (not the ones from before this screen opened).
  useEffect(() => {
    const evs = screen.events as unknown as { type: string; seq: number; pupil?: string }[];
    if (seen.current === null) { seen.current = screen.seq; return; }
    const fresh = evs.filter((e) => e.seq > (seen.current as number)).sort((a, b) => a.seq - b.seq);
    if (!fresh.length) return;
    seen.current = Math.max(...fresh.map((e) => e.seq));
    for (const e of fresh) if (e.type === 'jail_back' && e.pupil) stage.current?.backIn(nameOf(e.pupil));
  }, [screen.seq]);

  useEffect(() => {
    if (!over) return;
    const n = game.backs.length;
    const who = [...new Set(game.backs.map((b) => b.id))].map(nameOf);
    stage.current?.showOver(n === 0 ? 'Nobody needed the jail today. Well done, everyone!' : `${n} ${n === 1 ? 'comeback' : 'comebacks'} from jail. Great maths, everyone!`, screen.showNames ? who : []);
  }, [over]);

  return <div ref={host} className="jl-stage" />;
}
