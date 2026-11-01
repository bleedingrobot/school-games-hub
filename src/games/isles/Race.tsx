/**
 * A Sky Race against the Gull Riders (docs/ISLES-PLAN.md, section 4): three questions (each right answer is a gust for
 * your boat), then the race plays out leg by leg from the server's result, then the prize. Nobody loses anything. The
 * server works out who won from the race's seed and the answers it marked; this screen only shows it. With reduced
 * motion the boats go straight to the finish.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { RACE_BASE, RACE_LEGS } from '../../../shared/isles/config';
import type { Island } from '../../../shared/isles/engine';
import type { RaceResult, Speed } from '../../../shared/isles/race';
import { QuestionModal } from '../../maths/QuestionModal';
import { backgroundArt, boatArt, keeperArt, pipArt } from './art';
import type { IslesBackend, PublicRace } from './backend';
import { Art } from './Island';
import { n, plural } from './words';

const LEG_MS = 700;

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function Working({ who, speed, home }: { who: string; speed: Speed; home: boolean }) {
  const parts = [
    `${RACE_BASE} to start`,
    `${n(speed.boats)} from sky-boats`,
    speed.sails ? `${n(speed.sails)} from Swift Sails` : '',
    `${n(speed.happiness)} from happiness`,
    speed.wind ? `${n(speed.wind)} from ${home ? 'the home wind' : 'gusts'}` : '',
    // The starter race's Gull Riders take it easy (their luck is below nothing): that part isn't shown.
    speed.luck >= 0.5 ? `${n(speed.luck)} luck` : '',
  ].filter(Boolean);
  return (
    <p className="si-working"><strong>{who}: speed {n(speed.total)}</strong> = {parts.join(' + ')}</p>
  );
}

export function Race({ backend, open, keeper, onDone, onProblem }: {
  backend: IslesBackend;
  /** A race already open (carried on with the same questions), or null to start one. */
  open: PublicRace | null;
  keeper: string | null;
  onDone: (island: Island | null) => void;
  onProblem: (message: string) => void;
}) {
  const [race, setRace] = useState<PublicRace | null>(open);
  const [answered, setAnswered] = useState<Record<string, boolean>>(() => Object.fromEntries(Object.entries(open?.answered ?? {}).map(([k, v]) => [k, v.right])));
  const [leg, setLeg] = useState(0);
  const [finished, setFinished] = useState<{ result: RaceResult; prize: { coins: number; goods: number }; island: Island | null } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (race || started.current) return;
    started.current = true;
    backend.send({ action: 'raceStart', opponent: 'gull-riders' }).then(
      (r) => {
        const got = r.race as PublicRace;
        setRace(got);
        setAnswered(Object.fromEntries(Object.entries(got.answered ?? {}).map(([k, v]) => [k, v.right])));
      },
      (e: Error) => onProblem(e.message),
    );
  }, [backend, race, onProblem]);

  const next = race?.questions.find((q) => !(String(q.slot) in answered));
  const ready = race && !next && !finished;

  // Every question answered: the server works the race out.
  useEffect(() => {
    if (!ready || !race) return;
    let current = true;
    backend.send({ action: 'raceFinish', race: race.id }).then(
      (r) => {
        if (!current) return;
        const done = r.race as PublicRace;
        if (!done.result) return onProblem('That race could not be finished.');
        setFinished({ result: done.result, prize: done.prize ?? { coins: 0, goods: 0 }, island: (r.island as Island) ?? null });
        setLeg(reducedMotion() ? RACE_LEGS : 0);
      },
      (e: Error) => current && onProblem(e.message),
    );
    return () => {
      current = false;
    };
  }, [ready, race, backend, onProblem]);

  // The boats sail one leg at a time.
  useEffect(() => {
    if (!finished || leg >= RACE_LEGS) return;
    const t = window.setTimeout(() => setLeg((l) => l + 1), LEG_MS);
    return () => window.clearTimeout(t);
  }, [finished, leg]);

  const over = finished && leg >= RACE_LEGS;
  useEffect(() => {
    heading.current?.focus();
  }, [over]);

  const bg = backgroundArt('race');
  const at = (path: number[] | undefined) => `${Math.round((path?.[Math.min(leg, RACE_LEGS)] ?? 0) * 78)}%`;
  const right = Object.values(answered).filter(Boolean).length;

  return (
    <section className="si-race" aria-labelledby="si-race-title">
      <h2 id="si-race-title" ref={heading} tabIndex={-1}>
        {over ? (finished.result.won ? 'You won the Sky Race!' : 'Well raced!') : 'Sky Race: you and the Gull Riders'}
      </h2>
      {!finished && (
        <div className="si-pipsays">
          <Art src={pipArt('think')} className="si-pip" fallback={<span className="si-pip si-pip--drawn" aria-hidden="true" />} />
          <p>
            {race?.starter ? 'Your first race! ' : ''}Each right answer is a gust of wind for your boat. Nobody loses anything in a Sky Race.
            {race && <> Gusts so far: <strong>{right}</strong>.</>}
          </p>
        </div>
      )}
      <div className="si-course" style={{ '--si-bg': bg.wide ? `url(${bg.wide})` : 'none', '--si-bg-small': bg.small ? `url(${bg.small})` : 'none' } as CSSProperties}>
        <div className="si-lane">
          <div className="si-boat" style={{ left: at(finished?.result.youPath) }} aria-label="Your boat" role="img">
            <Art src={boatArt('red')} fallback={<span className="si-boat__drawn si-boat__drawn--red" />} />
            {keeper && keeperArt(keeper, true) && <img className="si-boat__keeper" src={keeperArt(keeper, true)} alt="" />}
            {finished && finished.result.gustLegs.includes(leg) && leg < RACE_LEGS && <span className="si-gust" aria-hidden="true">whoosh!</span>}
          </div>
        </div>
        <div className="si-lane">
          <div className="si-boat" style={{ left: at(finished?.result.themPath) }} aria-label="The Gull Riders' boat" role="img">
            <Art src={boatArt('blue')} fallback={<span className="si-boat__drawn si-boat__drawn--blue" />} />
          </div>
        </div>
        <div className="si-finish" aria-hidden="true" />
      </div>
      {over && (
        <div className="si-panel si-raceresult">
          <div className="si-pipsays">
            <Art src={pipArt(finished.result.won ? 'cheer' : 'wave')} className="si-pip" fallback={<span className="si-pip si-pip--drawn" aria-hidden="true" />} />
            <p>
              {finished.result.won
                ? `You win ${plural(finished.prize.coins, 'coin')}${finished.prize.goods ? ` and ${n(finished.prize.goods)} goods` : ''}!`
                : `The Gull Riders were faster this time. You still get ${plural(finished.prize.coins, 'coin')} for racing well.`}
            </p>
          </div>
          <Working who="Your boat" speed={finished.result.you} home={false} />
          <Working who="The Gull Riders" speed={finished.result.them} home />
          <button type="button" className="button button--primary" onClick={() => onDone(finished.island)}>Back to my island</button>
        </div>
      )}
      {race && next && (
        <QuestionModal
          question={{ ...next, id: race.id * 10 + next.slot }}
          title={`Race question ${next.slot + 1} of ${race.questions.length}`}
          note="A right answer is a gust of wind for your boat."
          spot="isles-race"
          onSubmit={async (value, ms) => {
            try {
              const r = await backend.send({ action: 'raceAnswer', race: race.id, slot: next.slot, value, ms });
              return { correct: r.right === true, fact: next.spoken, boxBefore: 0, boxAfter: 0, answer: r.answer as number, reward: r.right ? 'A gust for your boat!' : undefined };
            } catch {
              // Already answered (another tab) or couldn't be marked: no gust, and the race goes on.
              return { correct: false, fact: next.spoken, boxBefore: 0, boxAfter: 0 };
            }
          }}
          onDone={(marked) => setAnswered((a) => ({ ...a, [String(next.slot)]: marked.correct }))}
        />
      )}
      {!race && <p className="si-note">The Gull Riders are getting ready…</p>}
    </section>
  );
}
