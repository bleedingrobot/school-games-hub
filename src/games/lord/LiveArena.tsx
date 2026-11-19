/**
 * Dragon Maths: live arena clashes between classmates (James, 17 Nov 2026). The classmates list in the arena, the
 * challenge that pops up on any village screen, waiting for a yes, and the clash itself on the arena painting. The
 * server plays every round (shared/lord/clashServer.ts); this only shows the clash as it is and sends the pupil's attack
 * with the maths answer that powers it. No chat: just three cheers at the end.
 */
import { useEffect, useState } from 'react';
import { MOVE_INFO, type ClashMove } from '../../../shared/lord/clash';
import type { ClashRow } from '../../../shared/lord/clashServer';
import type { HeroClass, Hero } from '../../../shared/lord/types';
import { AvatarImage } from '../../avatar/AvatarImage';
import { ClassTag, SchoolPlayerList } from '../../components/SchoolPlayerList';
import type { Cheer } from '../../data/lordClash';
import { ClashScreen, type ClashEnding } from './Clash';
import { BigStage } from './Fight';
import type { Ask } from './Places';
import { HeroSprite } from './Sprite';
import type { Clashes } from './useClashes';

export const CHEERS: { id: Cheer; label: string }[] = [
  { id: 'good-fight', label: '👏 Good fight!' },
  { id: 'well-played', label: '⭐ Well played!' },
  { id: 'again', label: '⚔️ Again sometime?' },
];
const cheerWords = (c: string | null | undefined) => CHEERS.find((x) => x.id === c)?.label ?? null;

/** Seconds until a deadline by the server's clock, ticking. */
function useSecondsTo(deadline: string | null, serverNow: () => number): number | null {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!deadline) return;
    const t = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [deadline]);
  if (!deadline) return null;
  return Math.max(0, Math.ceil((Date.parse(deadline) - serverNow()) / 1000));
}

/** The players at school with Dragon Maths open (my class first), to challenge. On the arena painting, beside your hero. */
export function ClassmatesPanel({ clashes, onChallenge, busy }: { clashes: Clashes; onChallenge: (id: string) => void; busy: boolean }) {
  const list = clashes.online;
  return (
    <section className="lord-mates" aria-label="Friends here">
      <h3>Friends here</h3>
      {list === null && <p role="status">Looking…</p>}
      {list && list.length === 0 && <p>Nobody else is in Dragon Maths right now. Try a practice clash!</p>}
      {list && list.length > 0 && (
        <SchoolPlayerList
          people={list}
          label="Players in Dragon Maths now"
          row={(m) => (
            <>
              <AvatarImage avatar={m.avatar} size={32} />
              <span>{m.name}<ClassTag player={m} /></span>
              {m.busy ? <em className="lord-mates__busy">in a clash</em> : (
                <button type="button" className="lord-btn lord-btn--hot" disabled={busy} onClick={() => onChallenge(m.id)}>⚔️ Challenge</button>
              )}
            </>
          )}
        />
      )}
    </section>
  );
}

/** A friend's challenge, over whatever village screen is showing. */
export function ClashAskBanner({ clashes, onYes }: { clashes: Clashes; onYes: (clash: number) => void }) {
  const first = clashes.asks[0];
  const left = useSecondsTo(first?.deadline ?? null, clashes.serverNow);
  if (!first || left === 0) return null;
  return (
    <div className="lord-ask" role="alertdialog" aria-label={`${first.from} challenges you`}>
      <p>⚔️ {first.from} challenges you to an arena clash!<small>Hammer, Sword or Net. {left}s to answer.</small></p>
      <button type="button" className="lord-btn lord-btn--hot lord-btn--big" autoFocus onClick={() => onYes(first.clash)}>Fight!</button>
      <button type="button" className="lord-btn lord-btn--glass" onClick={() => {
        clashes.forget(first.clash);
        void clashes.send({ action: 'clash-answer', clash: first.clash, accept: false });
      }}>Not now</button>
    </div>
  );
}

/** Waiting for the other player to say yes. */
export function ChallengeWait({ clash, hero, clashes }: { clash: ClashRow; hero: Hero; clashes: Clashes }) {
  const left = useSecondsTo(clash.deadline, clashes.serverNow);
  const them = clash.heroes[1];
  return (
    <BigStage scene="arena" label="The Arena" className="lord-encounter lord-arena">
      <div className="lord-big__top"><h2 className="lord-big__heading">The Arena</h2></div>
      <div className="lord-big__title"><p>Waiting for <strong>{clash.name_b}</strong> to say yes… {left ? `${left}s` : ''}</p></div>
      <div className="lord-big__floor">
        <div className="lord-big__fig lord-big__fig--me"><div className="lord-big__body"><HeroSprite heroClass={hero.heroClass} look={hero.look} scale={8} label="" /></div></div>
        <div className="lord-big__fig lord-big__fig--foe lord-arena__them">
          <div className="lord-big__body"><HeroSprite heroClass={them.heroClass as HeroClass} look={them.look ?? undefined} scale={8} label={clash.name_b} /></div>
        </div>
      </div>
      <div className="lord-big__bar">
        <button type="button" className="lord-btn lord-btn--glass lord-btn--big" autoFocus onClick={() => void clashes.send({ action: 'clash-leave', clash: clash.id })}>Call it off</button>
      </div>
    </BigStage>
  );
}

function endingOf(c: ClashRow, seat: 0 | 1, them: string): ClashEnding | null {
  const other = seat === 0 ? 1 : 0;
  switch (c.ending) {
    case 'left':
      return c.leaver === seat ? { title: 'You gave up', line: `${them} wins this one. No gold this time.` } : { title: 'Victory!', line: `${them} gave up. No gold this time.`, won: true };
    case 'timeouts':
      if (c.leaver === seat) return { title: 'Time ran out', line: 'You missed two rounds, so the clash ended. No gold this time.' };
      if (c.leaver === other) return { title: 'Victory!', line: `${them} stopped playing. No gold this time.`, won: true };
      return { title: 'Clash over', line: 'Nobody picked for two rounds.' };
    case 'switched-off':
      return { title: 'Clash stopped', line: 'Your teacher has switched arena clashes with friends off for now.' };
    case 'idle':
      return { title: 'Clash over', line: 'Nobody played for a while.' };
    default:
      return null;
  }
}

/** The clash itself, live. */
export function LiveClash({ clash: c, me, hero, ask, clashes, onBack }: { clash: ClashRow; me: string; hero: Hero; ask: Ask; clashes: Clashes; onBack: () => void }) {
  const seat: 0 | 1 = c.seat_a === me ? 0 : 1;
  const other: 0 | 1 = seat === 0 ? 1 : 0;
  const themName = seat === 0 ? c.name_b : c.name_a;
  const themHero = c.heroes[other];
  const otherId = seat === 0 ? c.seat_b : c.seat_a;
  const round = c.rounds.length;
  const [sentFor, setSentFor] = useState<number | null>(null);
  const [tries, setTries] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const left = useSecondsTo(c.status === 'playing' ? c.deadline : null, clashes.serverNow);
  const ended = c.status !== 'playing';

  async function onPick(move: ClashMove) {
    setProblem(null);
    const asked = await ask('arena', { title: `Power up your ${MOVE_INFO[move].name}!`, note: 'A right answer is a full hit. A wrong one is only a graze.' });
    setSentFor(round);
    const r = await clashes.send({ action: 'clash-pick', clash: c.id, round, move, proof: asked?.proof ?? null });
    if (!r.ok && r.code !== 'round' && r.code !== 'over') {
      setSentFor(null);
      setTries((n) => n + 1);
      setProblem(r.message);
    }
  }

  async function again() {
    setSending(true);
    const r = await clashes.send({ action: 'clash-challenge', other: otherId });
    setSending(false);
    if (r.ok) clashes.forget(c.id);
    else setProblem(r.message);
  }

  const myCheer = c.cheers[seat];
  const finishedNoGold = c.ending === 'finished' && c.gold[seat] === 0;
  return (
    <ClashScreen
      key={c.id}
      me={{ name: 'You', heroClass: hero.heroClass, look: hero.look }}
      them={{ name: themName, heroClass: themHero.heroClass as HeroClass, look: themHero.look ?? undefined }}
      seat={seat}
      picks={c.rounds}
      waiting={!ended && sentFor === round}
      onPick={(m) => void onPick(m)}
      prize={c.gold[seat]}
      note={finishedNoGold ? 'No gold this time: you’ve had your gold clashes for today.' : undefined}
      ending={ended ? endingOf(c, seat, themName) : null}
      secondsLeft={left}
      tries={tries}
      problem={problem}
      theirCheer={cheerWords(c.cheers[other])}
      onLeave={() => void clashes.send({ action: 'clash-leave', clash: c.id })}
      buttons={<>
        {myCheer ? <p className="lord-clash__said">You said: {cheerWords(myCheer)}</p> : (
          <div className="lord-clash__cheers" role="group" aria-label="Cheer">
            {CHEERS.map((x) => <button key={x.id} type="button" className="lord-btn lord-btn--glass lord-end__go" onClick={() => void clashes.cheer(x.id)}>{x.label}</button>)}
          </div>
        )}
        <button type="button" className="lord-btn lord-btn--hot lord-btn--big lord-end__go" disabled={sending} onClick={() => void again()}>Challenge {themName} again</button>
        <button type="button" className="lord-btn lord-btn--glass lord-btn--big lord-end__go" autoFocus onClick={() => { clashes.forget(c.id); onBack(); }}>Back to the arena</button>
      </>}
    />
  );
}
