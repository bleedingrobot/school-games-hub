/**
 * Ghost Tag's parts of the Class Live page (docs/GHOST-PLAN.md): the teacher's setup card, the lobby's head, the
 * How to play sheet and the "How it works" page (power-ups and map tricks, pictures once painted).
 */
import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MAPS, MAP_WORDS, MECHANICS, POWERS, POWER_WORDS, UNLOCK, type GhostGame, type GhostMap } from '../../../shared/classlive/ghost';
import { ghostPic, powerPicG } from './GhostBoard';
import { MECH_ABOUT } from './GhostScene';
import { GHOST_HOWTO } from './ghostLines';
import { painted } from './paintedArt';

const MECH_EMOJI = { items: '🎁', teleport: '🕳️', slow: '🕸️', fog: '🌫️', bats: '🦇' } as const;

/** The teacher's card on the Class Live picker. */
export function GhostPickCard({ busy, hostOk, onOpen, timer, art }: {
  busy: boolean; hostOk: boolean;
  onOpen: (body: Record<string, unknown>) => void;
  /** The picker's minutes chips, for this card's length. */
  timer: (length: number, setLength: (m: number) => void) => ReactNode;
  art: (pic: string | null) => ReactNode;
}) {
  const [map, setMap] = useState<GhostMap | 'any'>('any');
  const [length, setLength] = useState(5);
  const [help, setHelp] = useState(false);
  return (
    <section className="cl-card cl-card--active cl-card--ghost" aria-label="Ghost Tag">
      {art(painted('pick', 'ghost', true) ?? painted('ghost', 'map-graveyard', true))}
      <h2 className="cl-card__name">👻 Ghost Tag</h2>
      <p className="cl-card__blurb">Run from the ghosts! Get caught and you become one. A right answer makes you invisible.</p>
      <button type="button" className="cl-btn cl-btn--small fc-guide-btn fc-guide-btn--card" onClick={() => setHelp(true)}>👻 How it works</button>
      {help && <GhostHelp map={map === 'any' ? MAPS[0] : map} onClose={() => setHelp(false)} />}
      <div className="cl-opt">
        <span className="cl-opt__label">Which map?</span>
        <div className="cl-chips" role="group" aria-label="Map">
          <button type="button" className={`cl-choice ${map === 'any' ? 'cl-choice--on' : ''}`} aria-pressed={map === 'any'} onClick={() => setMap('any')}>Surprise me</button>
          {MAPS.map((m) => (
            <button key={m} type="button" className={`cl-choice ${map === m ? 'cl-choice--on' : ''}`} aria-pressed={map === m} onClick={() => setMap(m)}>{MAP_WORDS[m].name}</button>
          ))}
        </div>
      </div>
      {timer(length, setLength)}
      <button type="button" className="cl-btn cl-btn--go" disabled={busy || !hostOk} onClick={() => onOpen({ length, ...(map === 'any' ? {} : { map }) })}>{busy ? 'Opening…' : 'Open the room'}</button>
    </section>
  );
}

export function GhostLobbyHead({ map }: { map: GhostMap }) {
  const [help, setHelp] = useState(false);
  return (
    <>
      {help && <GhostHelp map={map} onClose={() => setHelp(false)} />}
      <h1 className="cl-lobby__title">Ghost Tag</h1>
      <div className="cl-lobby__fact">{MAP_WORDS[map].name}</div>
      <div className="gt-lobby-ghosts" aria-hidden="true"><i>👻</i><i>👻</i><i>👻</i></div>
      <p className="cl-lobby__ask">Run from the ghosts. Get caught and you join them! Who will be the last one standing?</p>
      <button type="button" className="cl-btn fc-guide-btn" onClick={() => setHelp(true)}>👻 How it works</button>
    </>
  );
}

/** The How to play sheet (HowTo.tsx). */
export function ghostSheet(game: GhostGame) {
  const H = GHOST_HOWTO;
  return {
    title: 'How to play Ghost Tag', mode: MAP_WORDS[game.map].name, modeSay: null, art: painted('pick', 'ghost', true) ?? painted('ghost', `map-${game.map}`, true),
    steps: [
      { icon: '🕹️', text: 'Move your avatar with the joystick, or the arrow keys.', say: H[0] },
      { icon: '👻', text: 'A few players start as ghosts. If a ghost touches you, you become a ghost too.', say: H[1] },
      { icon: '✨', text: 'Answer a question right to turn invisible for 5 seconds. Ghosts can’t catch you then!', say: H[2] },
      { icon: '🏮', text: 'Ghosts answer too: a speed dash, or a lantern that finds invisible players.', say: H[3] },
      { icon: '🏆', text: 'The last one standing wins the round. Win the most rounds to win!', say: H[4] },
    ],
  };
}

function Pic({ src, emoji }: { src: string | null; emoji: string }) {
  return src ? <img className="fc-guide__pic" src={src} alt="" /> : <span className="fc-guide__pic fc-guide__pic--emoji" aria-hidden="true">{emoji}</span>;
}

/** Power-ups and map tricks, with the chosen map's names (tabs for the others). */
export function GhostHelp({ map, onClose }: { map: GhostMap; onClose: () => void }) {
  const [shown, setShown] = useState<GhostMap>(map);
  const w = MAP_WORDS[shown];
  return createPortal(
    <div className="fc-guide" role="dialog" aria-modal="true" aria-label="How Ghost Tag works">
      <div className="fc-guide__card">
        <header className="fc-guide__head">
          <h2>How Ghost Tag works</h2>
          <button type="button" className="cl-btn cl-btn--small" onClick={onClose}>Close ✕</button>
        </header>
        <ul className="fc-guide__grid">
          <li><Pic src={ghostPic('sheet')} emoji="👻" /><b>Ghosts</b><span>Touch a player to make them a ghost too. Ghosts float through {w.stones.toLowerCase()}.</span></li>
          <li><Pic src={ghostPic('vanish')} emoji="✨" /><b>Vanish</b><span>Answer a question right: invisible for 5 seconds.</span></li>
          <li><Pic src={ghostPic('dash')} emoji="💨" /><b>Ghost dash</b><span>A ghost’s right answer: a burst of speed.</span></li>
          <li><Pic src={ghostPic('lantern')} emoji="🏮" /><b>Lantern</b><span>A ghost’s next right answer: it can see (and catch) invisible players near it.</span></li>
        </ul>
        <h3 className="fc-guide__title">🎁 Power-ups <small>from round {UNLOCK.items}</small></h3>
        <p className="fc-guide__note">Run over one to use it straight away. Only players who aren’t ghosts can pick them up.</p>
        <ul className="fc-guide__grid">
          {POWERS.map((p) => <li key={p}><Pic src={powerPicG(p)} emoji={POWER_WORDS[p].emoji} /><b>{POWER_WORDS[p].name}</b><span>{POWER_WORDS[p].how}</span></li>)}
        </ul>
        <h3 className="fc-guide__title">⚠️ Map tricks</h3>
        <div className="cl-chips fc-guide__maps" role="group" aria-label="Map">
          {MAPS.map((m) => <button key={m} type="button" className={`cl-choice ${shown === m ? 'cl-choice--on' : ''}`} aria-pressed={shown === m} onClick={() => setShown(m)}>{MAP_WORDS[m].name}</button>)}
        </div>
        <p className="fc-guide__note">A new one joins in each round, so the game gets wilder as it goes.</p>
        <ul className="fc-guide__grid">
          <li><Pic src={ghostPic(`${shown}-stone`)} emoji="🪦" /><b>{w.stones}</b><span>Players bump into them. Ghosts float straight through!</span></li>
          {MECHANICS.filter((m) => m !== 'items').map((m) => (
            <li key={m}>
              <Pic src={m === 'fog' ? null : ghostPic(`${shown}-${m === 'slow' ? 'slow' : m === 'teleport' ? 'teleport' : 'bats'}`)} emoji={MECH_EMOJI[m]} />
              <b>{m === 'slow' ? w.slow : m === 'teleport' ? `${w.teleport}s` : m === 'bats' ? w.bats : w.fog} <small>round {UNLOCK[m]}</small></b>
              <span>{MECH_ABOUT[m](w)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
