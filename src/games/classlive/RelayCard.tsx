/**
 * Toon Flap Relay's parts of the Class Live page (docs/RELAY-PLAN.md): the teacher's setup card (1, 3 or 5 races), the
 * lobby's head, the How to play sheet and the "How it works" page (every perk and trouble).
 */
import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { FX_WORDS, PERK_COST, PERK_UNLOCK, PERKS, RACE_CHOICES, TROUBLE_COST, TROUBLES, type FxKind, type RelayGame } from '../../../shared/classlive/relay';
import { RELAY_HOWTO } from './relayLines';
import { painted } from './paintedArt';
import './corners.css';
import './relay.css';

export const relayPic = (file: string) => painted('relay', file, true);
const CARD_PIC = () => painted('pick', 'relay', true) ?? painted('relay', 'card', true);

/** The teacher's card on the Class Live picker. */
export function RelayPickCard({ busy, hostOk, onOpen, timer, art }: {
  busy: boolean; hostOk: boolean;
  onOpen: (body: Record<string, unknown>) => void;
  timer: (length: number, setLength: (m: number) => void) => ReactNode;
  art: (pic: string | null) => ReactNode;
}) {
  const [races, setRaces] = useState<1 | 3 | 5>(3);
  const [length, setLength] = useState(15);
  const [help, setHelp] = useState(false);
  return (
    <section className="cl-card cl-card--active cl-card--relay" aria-label="Toon Flap Relay">
      {art(CARD_PIC())}
      <h2 className="cl-card__name">🐦 Toon Flap Relay</h2>
      <p className="cl-card__blurb">Teams take turns flying. Everyone else answers questions for perks, and sends trouble to the other teams!</p>
      <button type="button" className="cl-btn cl-btn--small fc-guide-btn fc-guide-btn--card" onClick={() => setHelp(true)}>🐦 How it works</button>
      {help && <RelayHelp onClose={() => setHelp(false)} />}
      <div className="cl-opt">
        <span className="cl-opt__label">How many races?</span>
        <div className="cl-chips" role="group" aria-label="Races">
          {RACE_CHOICES.map((n) => (
            <button key={n} type="button" className={`cl-choice ${races === n ? 'cl-choice--on' : ''}`} aria-pressed={races === n} onClick={() => setRaces(n)}>
              {n === 1 ? '1 race (about 3 min)' : `${n} races (about ${n * 3} min)`}
            </button>
          ))}
        </div>
      </div>
      {timer(length, setLength)}
      <p className="cl-card__note">Teams of 4 or 5 are made for you. Best on iPads or laptops with the big screen on.</p>
      <button type="button" className="cl-btn cl-btn--go" disabled={busy || !hostOk} onClick={() => onOpen({ length, races })}>{busy ? 'Opening…' : 'Open the room'}</button>
    </section>
  );
}

export function RelayLobbyHead({ game }: { game: RelayGame }) {
  const [help, setHelp] = useState(false);
  return (
    <>
      {help && <RelayHelp onClose={() => setHelp(false)} />}
      <h1 className="cl-lobby__title">Toon Flap Relay</h1>
      <div className="cl-lobby__fact">{game.races === 1 ? '1 race' : `${game.races} races`}</div>
      <div className="tr-lobby-birds" aria-hidden="true"><i>🐦</i><i>🏁</i><i>🐦</i></div>
      <p className="cl-lobby__ask">Teams take turns flying. Answer questions to help your flyer, or send trouble to the other teams!</p>
      <button type="button" className="cl-btn fc-guide-btn" onClick={() => setHelp(true)}>🐦 How it works</button>
    </>
  );
}

/** The How to play sheet (HowTo.tsx). */
export function relaySheet(game: RelayGame) {
  const H = RELAY_HOWTO;
  return {
    title: 'How to play Toon Flap Relay', mode: game.races === 1 ? 'One race' : `${game.races} races`, modeSay: null, art: CARD_PIC(),
    steps: [
      { icon: '🎨', text: 'You are in a colour team. Teams race to the nest at the same time.', say: H[0] },
      { icon: '🐦', text: 'Take turns to fly: tap your device to flap. Each flyer has 30 seconds.', say: H[1] },
      { icon: '✨', text: 'Not flying? Answer questions. Each right answer gives you a spark.', say: H[2] },
      { icon: '🛡️', text: 'Spend sparks on perks for your own flyer, like a shield or wider gaps.', say: H[3] },
      { icon: '🌬️', text: 'Or send trouble to another team, like wind or fog. First team to the nest wins!', say: H[4] },
    ],
  };
}

export function FxIcon({ kind, big }: { kind: FxKind; big?: boolean }) {
  const src = relayPic(`fx-${kind}`);
  return src ? <img className={`tr-fx-icon ${big ? 'tr-fx-icon--big' : ''}`} src={src} alt="" /> : <span className={`tr-fx-icon tr-fx-icon--emoji ${big ? 'tr-fx-icon--big' : ''}`} aria-hidden="true">{FX_WORDS[kind].emoji}</span>;
}

/** Every perk and trouble, with when it opens. */
export function RelayHelp({ onClose }: { onClose: () => void }) {
  return createPortal(
    <div className="fc-guide" role="dialog" aria-modal="true" aria-label="How Toon Flap Relay works">
      <div className="fc-guide__card">
        <header className="fc-guide__head">
          <h2>How Toon Flap Relay works</h2>
          <button type="button" className="cl-btn cl-btn--small" onClick={onClose}>Close ✕</button>
        </header>
        <p className="fc-guide__note">Teams of 4 or 5 race the same course at the same time. One flyer from each team is up at once, for 30 seconds of flying, then the next teammate carries on from there. A bump just sends the bird back a little: the turn carries on.</p>
        <h3 className="fc-guide__title">✨ Perks for your flyer <small>{PERK_COST} sparks</small></h3>
        <p className="fc-guide__note">The team in last place pays 1 spark less; the team in front pays 1 more. New perks open race by race.</p>
        <ul className="fc-guide__grid">
          {PERKS.map((p) => <li key={p}><FxIcon kind={p} big /><b>{FX_WORDS[p].name} <small>race {PERK_UNLOCK[p]}</small></b><span>{FX_WORDS[p].how}</span></li>)}
        </ul>
        <h3 className="fc-guide__title">🌪️ Trouble for another team <small>{TROUBLE_COST} sparks</small></h3>
        <p className="fc-guide__note">Trouble lands on a random other team that is free, so nobody can gang up on one team. A team that just had trouble is safe for a while, and nobody gets trouble in their first few seconds of flying.</p>
        <ul className="fc-guide__grid">
          {TROUBLES.map((p) => <li key={p}><FxIcon kind={p} big /><b>{FX_WORDS[p].name}</b><span>{FX_WORDS[p].how}</span></li>)}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
