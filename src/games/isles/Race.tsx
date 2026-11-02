/**
 * A Sky Race against the Gull Riders (docs/ISLES-PLAN.md, section 4). The questions come during the race: the boats
 * sail a stretch, stop, a question pops up, and a right answer is a gust of wind for your boat on the next stretch.
 * After the last stretch comes the prize. Nobody loses anything.
 *
 * The server sends the race one stretch at a time, worked out from the race's seed and the answers it has marked; this
 * screen only shows it. Leaving mid-race and coming back carries on from the same stop. With reduced motion each
 * stretch jumps to its end and the boats don't bob.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { RACE_BASE, RACE_LEGS, RACE_QUESTIONS, WELL_RACED_COINS } from '../../../shared/isles/config';
import type { Island } from '../../../shared/isles/engine';
import { RACE_STOPS, type RaceSoFar, type Speed } from '../../../shared/isles/race';
import { QuestionModal } from '../../maths/QuestionModal';
import { backgroundArt, boatArt, keeperArt, pipArt } from './art';
import type { IslesBackend, PublicRace } from './backend';
import { Art } from './Island';
import { n, plural } from './words';

const LEG_MS = 700;
const STRETCHES = RACE_QUESTIONS + 1;

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

/** The race as far as the server has sent it. */
const pathsOf = (race: PublicRace | null): RaceSoFar | null => race?.result ?? race?.soFar ?? null;

/** Where an open race carries on from: the stop before the stretch still to sail (the start line if nothing's answered). */
function resumeAt(race: PublicRace | null): number {
  if (!race || race.result) return 0;
  const marked = Object.keys(race.answered ?? {}).length;
  return marked === 0 ? 0 : RACE_STOPS[Math.min(marked, RACE_QUESTIONS) - 1];
}

/** Which stretch the boats are on (or have just finished) at this point of the path, from 1. */
const stretchAt = (point: number) => Math.min(STRETCHES, [...RACE_STOPS, RACE_LEGS].findIndex((stop) => point <= stop) + 1);

/** Who's ahead, for a screen reader at each stop. */
function whoLeads(paths: RaceSoFar, point: number): string {
  const gap = (paths.youPath[point] ?? 0) - (paths.themPath[point] ?? 0);
  return Math.abs(gap) < 0.01 ? 'The boats are side by side.' : gap > 0 ? 'Your boat is ahead.' : 'The Gull Riders are ahead.';
}

export function Race({ backend, open, keeper, onDone, onProblem }: {
  backend: IslesBackend;
  /** A race already open (carried on from the same stop, with the same questions), or null to start one. */
  open: PublicRace | null;
  keeper: string | null;
  onDone: (island: Island | null) => void;
  onProblem: (message: string) => void;
}) {
  const [race, setRace] = useState<PublicRace | null>(open);
  const [point, setPoint] = useState(() => resumeAt(open));
  const [sailing, setSailing] = useState(false);
  /** Pip's line after a question, for the stretch it blows on. */
  const [said, setSaid] = useState<string | null>(null);
  const [island, setIsland] = useState<Island | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const started = useRef(false);
  const finishing = useRef(false);
  /** The race from the server's reply to an answer, used once the box closes. */
  const reply = useRef<PublicRace | null>(null);

  useEffect(() => {
    if (race || started.current) return;
    started.current = true;
    backend.send({ action: 'raceStart', opponent: 'gull-riders' }).then(
      (r) => {
        const got = r.race as PublicRace;
        setRace(got);
        setPoint(resumeAt(got));
      },
      (e: Error) => onProblem(e.message),
    );
  }, [backend, race, onProblem]);

  const paths = pathsOf(race);
  const end = paths ? paths.youPath.length - 1 : 0;
  const result = race?.result ?? null;
  const next = race?.questions.find((q) => !(String(q.slot) in (race.answered ?? {})));
  const atStop = !!race && sailing && point >= end;
  const asking = atStop && !!next && !result;
  const over = !!result && point >= RACE_LEGS;

  // The boats sail one leg at a time to the end of what the server has sent (or jump there, with reduced motion).
  useEffect(() => {
    if (!sailing || point >= end) return;
    if (reducedMotion()) {
      setPoint(end);
      return;
    }
    const t = window.setTimeout(() => setPoint((p) => p + 1), LEG_MS);
    return () => window.clearTimeout(t);
  }, [sailing, point, end]);

  // Every question answered and the boats at the last stop: the server works the race out and sends the last stretch.
  useEffect(() => {
    if (!race || !atStop || next || result || finishing.current) return;
    finishing.current = true;
    backend.send({ action: 'raceFinish', race: race.id }).then(
      (r) => {
        const done = r.race as PublicRace;
        if (!done.result) return onProblem('That race could not be finished.');
        setIsland((r.island as Island) ?? null);
        setRace(done);
      },
      (e: Error) => onProblem(e.message),
    );
  }, [race, atStop, next, result, backend, onProblem]);


  const bg = backgroundArt('race');
  const at = (path: number[] | undefined) => `${Math.round((path?.[Math.min(point, path.length - 1)] ?? 0) * 78)}%`;
  const stretch = stretchAt(Math.max(1, point + (sailing && point < end ? 1 : 0)));
  const gust = !!paths && sailing && point > 0 && paths.gustLegs.includes(point - 1) && !asking;
  const title = over
    ? (result.won ? 'You won the Sky Race!' : 'Well raced!')
    : sailing ? `Sky Race: stretch ${stretch} of ${STRETCHES}` : 'Sky Race: you and the Gull Riders';
  const pipLine = !race
    ? 'The Gull Riders are getting ready…'
    : !sailing
      ? point === 0
        ? `${race.starter ? 'Your first race! ' : ''}The race stops for questions on the way. Each right answer is a gust of wind for your boat.`
        : 'Welcome back! Your race carries on from where you stopped.'
      : said ?? (stretch === 1 ? 'Off you go! The first question comes at the first stop.' : 'Sail on to the next stop!');
  const prize = race?.prize ?? { coins: 0, goods: 0 };

  // Focus follows each new heading: the start, each stretch, the result.
  useEffect(() => {
    heading.current?.focus();
  }, [title]);

  return (
    <section className={`si-race${sailing && !over ? ' si-race--sailing' : ''}`} aria-labelledby="si-race-title">
      <h2 id="si-race-title" ref={heading} tabIndex={-1}>{title}</h2>
      {!over && (
        <div className="si-pipsays si-race__bar">
          <Art src={pipArt(said?.startsWith('Whoosh') ? 'cheer' : 'think')} className="si-pip" fallback={<span className="si-pip si-pip--drawn" aria-hidden="true" />} />
          <p>{pipLine}</p>
          {race && !sailing && (
            <button type="button" className="button button--primary si-race__go" onClick={() => setSailing(true)}>
              {point === 0 ? 'Set sail!' : 'Sail on!'}
            </button>
          )}
        </div>
      )}
      <div className="si-course" style={{ '--si-bg': bg.wide ? `url(${bg.wide})` : 'none', '--si-bg-small': bg.small ? `url(${bg.small})` : 'none' } as CSSProperties}>
        <div className="si-lane">
          <div className="si-boat" style={{ left: at(paths?.youPath) }} aria-label="Your boat" role="img">
            <Art src={boatArt('red')} fallback={<span className="si-boat__drawn si-boat__drawn--red" />} />
            {keeper && keeperArt(keeper, true) && <img className="si-boat__keeper" src={keeperArt(keeper, true)} alt="" />}
            {gust && <span className="si-gust" aria-hidden="true">whoosh!</span>}
          </div>
        </div>
        <div className="si-lane">
          <div className="si-boat" style={{ left: at(paths?.themPath) }} aria-label="The Gull Riders' boat" role="img">
            <Art src={boatArt('blue')} fallback={<span className="si-boat__drawn si-boat__drawn--blue" />} />
          </div>
        </div>
        <div className="si-finish" aria-hidden="true" />
      </div>
      <p className="sr-only" aria-live="polite">{paths && sailing && point >= end ? whoLeads(paths, point) : ''}</p>
      {over && (
        <div className="si-panel si-raceresult">
          <div className="si-pipsays si-race__bar">
            <Art src={pipArt(result.won ? 'cheer' : 'wave')} className="si-pip" fallback={<span className="si-pip si-pip--drawn" aria-hidden="true" />} />
            <p>
              {result.won
                ? `You win ${plural(prize.coins, 'coin')}${prize.goods ? ` and ${n(prize.goods)} goods` : ''}!`
                : `The Gull Riders were faster this time. You still get ${plural(WELL_RACED_COINS, 'coin')} for racing well.`}
            </p>
            <button type="button" className="button button--primary si-race__go" onClick={() => onDone(island)}>Back to my island</button>
          </div>
          <Working who="Your boat" speed={result.you} home={false} />
          <Working who="The Gull Riders" speed={result.them} home />
        </div>
      )}
      {race && next && asking && (
        <QuestionModal
          question={{ ...next, id: race.id * 10 + next.slot }}
          title={`Race question ${next.slot + 1} of ${race.questions.length}`}
          note="A right answer is a gust of wind for your boat on the next stretch."
          spot="isles-race"
          onSubmit={async (value, ms) => {
            // A failure throws, and the box lets the pupil try again (an answer sent twice is marked once).
            const r = await backend.send({ action: 'raceAnswer', race: race.id, slot: next.slot, value, ms });
            reply.current = (r.race as PublicRace) ?? null;
            return { correct: r.right === true, fact: next.spoken, boxBefore: 0, boxAfter: 0, answer: r.answer as number, reward: r.right ? 'A gust for your boat!' : undefined };
          }}
          onDone={(marked) => {
            const got = reply.current;
            reply.current = null;
            const last = next.slot === race.questions.length - 1;
            setSaid(marked.correct
              ? `Whoosh! A gust fills your sails${last ? ' for the last stretch' : ''}!`
              : `No gust this time, keep sailing!${last ? ' Here comes the finish.' : ''}`);
            setRace((r) => got ?? (r && { ...r, answered: { ...r.answered, [String(next.slot)]: { value: 0, right: marked.correct } } }));
          }}
        />
      )}
    </section>
  );
}
