/**
 * Glitches' parts of the Class Live page (docs/CREW-PLAN.md): the teacher's setup card, the lobby's head, the
 * How to play sheet and the "How it works" page (roles, machines, meetings, power-ups and tricks).
 */
import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { JAM_DELAY, JAMMED_WIN, MACHINES, POWERS, POWER_WORDS, UNLOCK, fixNeed } from '../../../shared/classlive/crew';
import { crewPic } from './CrewBoard';
import { CREW_HOWTO } from './crewLines';
import { painted } from './paintedArt';

/** The teacher's card on the Class Live picker. */
export function CrewPickCard({ busy, hostOk, onOpen, timer, art }: {
  busy: boolean; hostOk: boolean;
  onOpen: (body: Record<string, unknown>) => void;
  timer: (length: number, setLength: (m: number) => void) => ReactNode;
  art: (pic: string | null) => ReactNode;
}) {
  const [length, setLength] = useState(15);
  const [help, setHelp] = useState(false);
  return (
    <section className="cl-card cl-card--active cl-card--crew" aria-label="Glitches">
      {art(painted('pick', 'crew', true) ?? painted('crew', 'map-factory', true))}
      <h2 className="cl-card__name">🤖 Glitches</h2>
      <p className="cl-card__blurb">Keep the robot factory running with maths. But a few secret Glitches are jamming the machines! You call the meetings; the class votes in secret.</p>
      <p className="cl-card__blurb"><small>Best for 8 or more pupils. A shift is 4 minutes; press <b>Call a meeting</b> (or M) when you want the class to talk.</small></p>
      <button type="button" className="cl-btn cl-btn--small fc-guide-btn fc-guide-btn--card" onClick={() => setHelp(true)}>🤖 How it works</button>
      {help && <CrewHelp onClose={() => setHelp(false)} />}
      {timer(length, setLength)}
      <button type="button" className="cl-btn cl-btn--go" disabled={busy || !hostOk} onClick={() => onOpen({ length })}>{busy ? 'Opening…' : 'Open the room'}</button>
    </section>
  );
}

export function CrewLobbyHead() {
  const [help, setHelp] = useState(false);
  return (
    <>
      {help && <CrewHelp onClose={() => setHelp(false)} />}
      <h1 className="cl-lobby__title">Glitches</h1>
      <div className="cl-lobby__fact">The Robot Factory</div>
      <div className="gt-lobby-ghosts sc-lobby-bots" aria-hidden="true"><i>🤖</i><i>🔧</i><i>⚡</i></div>
      <p className="cl-lobby__ask">Most of you are Crew. A few of you are secret Glitches. Can the Crew keep the factory running?</p>
      <button type="button" className="cl-btn fc-guide-btn" onClick={() => setHelp(true)}>🤖 How it works</button>
    </>
  );
}

/** The How to play sheet (HowTo.tsx). */
export function crewSheet() {
  const H = CREW_HOWTO;
  return {
    title: 'How to play Glitches', mode: 'The Robot Factory', modeSay: null, art: painted('pick', 'crew', true) ?? painted('crew', 'map-factory', true),
    steps: [
      { icon: '🕹️', text: 'Steer with the joystick, or the arrow keys.', say: H[0] },
      { icon: '🤫', text: 'Check your device: most of you are Crew, a few are secret Glitches.', say: H[1] },
      { icon: '📋', text: 'Crew: answer questions at your jobs to fill the power bar, and fix sparking machines.', say: H[2] },
      { icon: '⚡', text: 'Glitches: jam a machine. It starts sparking a few seconds later.', say: H[3] },
      { icon: '🚨', text: 'Your teacher calls a meeting: talk it over, then vote in secret. Fill the power bar or find every Glitch to win!', say: H[4] },
    ],
  };
}

function Pic({ src, emoji }: { src: string | null; emoji: string }) {
  return src ? <img className="fc-guide__pic" src={src} alt="" /> : <span className="fc-guide__pic fc-guide__pic--emoji" aria-hidden="true">{emoji}</span>;
}

export function CrewHelp({ onClose }: { onClose: () => void }) {
  return createPortal(
    <div className="fc-guide" role="dialog" aria-modal="true" aria-label="How Glitches works">
      <div className="fc-guide__card">
        <header className="fc-guide__head">
          <h2>How Glitches works</h2>
          <button type="button" className="cl-btn cl-btn--small" onClick={onClose}>Close ✕</button>
        </header>
        <ul className="fc-guide__grid">
          <li><Pic src={crewPic('role-crew')} emoji="🔧" /><b>Crew</b><span>Walk to your jobs (they glow) and answer a question: each right answer fills the power bar. Fill it to win!</span></li>
          <li><Pic src={crewPic('role-glitch')} emoji="⚡" /><b>Glitches</b><span>Secret! Stand by a machine and tap Jam: it starts sparking {JAM_DELAY / 1000} seconds later. Pretend to do jobs so nobody guesses.</span></li>
          <li><Pic src={crewPic('sparks')} emoji="💥" /><b>Sparking machines</b><span>They drain the power bar. Answer questions beside one to fix it. {JAMMED_WIN} sparking at once and the Glitches win!</span></li>
          <li><Pic src={crewPic('meeting')} emoji="🚨" /><b>Meetings</b><span>The teacher calls them. Talk it over for 40 seconds, then vote in secret. Most votes becomes a helper drone.</span></li>
          <li><Pic src={crewPic('drone')} emoji="🛸" /><b>Helper drones</b><span>Sent off? You float about and keep helping your side. Find every Glitch and the Crew win!</span></li>
        </ul>
        <h3 className="fc-guide__title">🏭 The machines</h3>
        <ul className="fc-guide__grid">
          {MACHINES.map((m) => <li key={m.id}><Pic src={crewPic(`machine-${m.key}`)} emoji={m.emoji} /><b>{m.name}</b><span>{m.room}: {fixNeed(m)} right answers to fix.</span></li>)}
        </ul>
        <h3 className="fc-guide__title">🎁 Power-ups <small>from shift {UNLOCK.items}</small></h3>
        <p className="fc-guide__note">Crew walk over a crate to pick it up; the next right answer switches it on.</p>
        <ul className="fc-guide__grid">
          {POWERS.map((p) => <li key={p}><Pic src={crewPic(`power-${p}`)} emoji={POWER_WORDS[p].emoji} /><b>{POWER_WORDS[p].name}</b><span>{POWER_WORDS[p].how}</span></li>)}
        </ul>
        <h3 className="fc-guide__title">⚠️ Tricks</h3>
        <ul className="fc-guide__grid">
          <li><Pic src={crewPic('dark')} emoji="🌑" /><b>Lights out <small>shift {UNLOCK.lights}</small></b><span>A Glitch can turn the lights off once a shift. Two right answers at the Control Room switch them back on.</span></li>
          <li><Pic src={crewPic('belt')} emoji="➡️" /><b>Conveyor belts <small>shift {UNLOCK.belts}</small></b><span>They carry you along. Drones float over them.</span></li>
        </ul>
      </div>
    </div>,
    document.body,
  );
}
