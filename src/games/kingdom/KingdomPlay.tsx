/**
 * Kingdom Keeper (docs/KINGDOM-PLAN.md): rule Riverstone for ten years. Each year the steward reports, three advisers
 * each ask a maths question (a right answer wins their boon), and the ruler buys or sells land, feeds the people and
 * plants. The server keeps the reign and turns every year (shared/kingdom/server.ts); these screens only show it.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { HARD_TIMES, RATINGS, YEARS } from '../../../shared/kingdom/config';
import { averageHungry, citySize, ratingName, type Adviser, type City, type Decisions, type YearReport } from '../../../shared/kingdom/engine';
import { LOOKS, type KingdomRecord, type Look, type PublicReign } from '../../../shared/kingdom/reign';
import { QuestionModal, type MarkedAnswer } from '../../maths/QuestionModal';
import { liveKingdom } from '../../data/kingdom';
import { PEOPLE, rulerThumb, type SceneId } from './art';
import type { AnswerReply, KingdomBackend, LoadReply, ReignReply } from './backend';
import { Decide } from './Decide';
import { factText } from './factText';
import { HowToPlayBody } from './HowToPlay';
import { Courtier, Ruler, Stage } from './Stage';
import './kingdom.css';

type Screen =
  | { kind: 'loading' }
  | { kind: 'problem'; message: string }
  | { kind: 'start' }
  | { kind: 'report' }
  | { kind: 'council' }
  | { kind: 'decide'; step: number }
  | { kind: 'turns'; cards: Card[]; at: number }
  | { kind: 'end' }
  | { kind: 'howto'; back: Screen };

interface Card {
  scene: SceneId;
  title: string;
  lines: string[];
}

const n = (v: number) => v.toLocaleString('en-NZ');
const plural = (count: number, one: string, many: string) => `${n(count)} ${count === 1 ? one : many}`;

/** What each adviser's boon does, said by the adviser and on the year's cards. */
export const BOONS: Record<Adviser, { ask: string; won: string; short: string }> = {
  reeve: { ask: 'Answer me this, and I’ll bring in a bigger harvest: one more bushel from every acre this year.', won: 'Marigold’s farmers brought in one more bushel from every acre.', short: 'a bigger harvest' },
  ratcatcher: { ask: 'Answer me this, and my terrier and I will keep the rats out of the granary this year.', won: 'Nettle and her terrier kept the rats out of the granary.', short: 'no rats' },
  trader: { ask: 'Answer me this, and I’ll get you a better price for land this year: 2 bushels an acre.', won: 'Quince got you a better price for land.', short: 'a better land price' },
  healer: { ask: 'Answer me this, and I’ll keep sickness away from Riverstone this year.', won: 'Rowan’s medicine kept sickness away.', short: 'no sickness' },
  builder: { ask: 'Answer me this, and I’ll build new houses so more families come to live here.', won: 'Bram’s new houses brought more families to Riverstone.', short: 'more newcomers' },
};

const WARNING = 'The people are worried: too many went hungry. If it happens again, they will ask for a new ruler.';

const EMPTY: Decisions = { buy: 0, sell: 0, feed: 0, plant: 0 };

/** The painted cards for what happened as the year turned, from the steward's new report. */
export function yearCards(city: City): Card[] {
  const r: YearReport = city.report;
  const cards: Card[] = [];
  const boonLines = r.boons.map((b) => BOONS[b].won);
  cards.push(
    r.harvested === 0
      ? { scene: 'harvest-poor', title: 'No harvest', lines: ['Nothing was planted, so there was nothing to bring in.'] }
      : {
          scene: r.harvestPerAcre >= 4 ? 'harvest-good' : r.harvestPerAcre <= 2 ? 'harvest-poor' : 'fields',
          title: r.harvestPerAcre >= 4 ? 'A golden harvest!' : r.harvestPerAcre <= 2 ? 'A poor harvest' : 'The harvest is in',
          lines: [`The fields gave ${plural(r.harvestPerAcre, 'bushel', 'bushels')} an acre: ${n(r.harvested)} bushels in all.`, ...boonLines.filter((l) => l.startsWith('Marigold'))],
        },
  );
  if (r.ratsAte > 0) cards.push({ scene: 'rats', title: 'Rats in the granary!', lines: [`Rats got in and ate ${n(r.ratsAte)} bushels.`] });
  else if (r.boons.includes('ratcatcher')) cards.push({ scene: 'granary', title: 'No rats this year', lines: [BOONS.ratcatcher.won] });
  if (r.hungry > 0) {
    cards.push({
      scene: 'leaving',
      title: r.warning ? 'The people are worried' : 'Hungry families leave',
      lines: [`${plural(r.hungry, 'person', 'people')} went hungry and left the city.`, ...(r.warning ? [WARNING] : [])],
    });
  }
  if (r.newcomers > 0) {
    cards.push({ scene: 'newcomers', title: 'Newcomers arrive', lines: [`${plural(r.newcomers, 'person', 'people')} came to live in Riverstone.`, ...boonLines.filter((l) => l.startsWith('Bram'))] });
  }
  if (r.sickness) cards.push({ scene: 'sickness', title: 'Sickness came', lines: [`${plural(r.sickLeft, 'person', 'people')} left the city until the sickness passed.`] });
  else if (r.boons.includes('healer')) cards.push({ scene: 'sickness', title: 'Sickness kept away', lines: [BOONS.healer.won] });
  if (city.status === 'ended') {
    cards.push({
      scene: 'end-hard',
      title: 'The people ask for a new ruler',
      lines: city.people > 0 ? ['Too many people went hungry again, so the city asked for a new ruler. Your reign ends here.'] : ['Everyone has left Riverstone. Your reign ends here.'],
    });
  }
  return cards;
}

/** The steward's report for the year now starting. */
function reportLines(city: City): string[] {
  const r = city.report;
  const out: string[] = [];
  if (r.year === 1) out.push('Welcome, ruler! Here is how Riverstone stands as your reign begins.');
  if (r.hungry > 0) out.push(`${plural(r.hungry, 'person', 'people')} went hungry and left the city.`);
  if (r.warning) out.push(WARNING);
  if (r.newcomers > 0) out.push(`${plural(r.newcomers, 'person', 'people')} came to live here.`);
  if (r.sickness) out.push(`Sickness came: ${plural(r.sickLeft, 'person', 'people')} left until it passed.`);
  out.push(`Riverstone has ${plural(city.people, 'person', 'people')} and owns ${n(city.land)} acres of land.`);
  out.push(`The harvest was ${plural(r.harvestPerAcre, 'bushel', 'bushels')} an acre, ${n(r.harvested)} bushels in all.`);
  if (r.ratsAte > 0) out.push(`Rats ate ${n(r.ratsAte)} bushels.`);
  out.push(`There are ${n(city.grain)} bushels of grain in the granary.`);
  out.push(`Land is selling for ${n(city.price)} bushels an acre.`);
  return out;
}

function Status({ city }: { city: City }) {
  return (
    <ul className="kk-status" aria-label="Riverstone now">
      <li>Year <strong>{city.year}</strong> of {YEARS}</li>
      <li>People <strong>{n(city.people)}</strong></li>
      <li>Grain <strong>{n(city.grain)}</strong></li>
      <li>Land <strong>{n(city.land)}</strong> acres</li>
      <li>Land price <strong>{city.price}</strong></li>
    </ul>
  );
}

export function KingdomPlay({ backend = liveKingdom }: { backend?: KingdomBackend; level?: unknown }) {
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' });
  const [reign, setReign] = useState<PublicReign | null>(null);
  const [record, setRecord] = useState<KingdomRecord | null>(null);
  const [pointsLeft, setPointsLeft] = useState(0);
  const [look, setLook] = useState<Look>(LOOKS[0]);
  const [d, setD] = useState<Decisions>(EMPTY);
  const [skipped, setSkipped] = useState<number[]>([]);
  const [asking, setAsking] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);

  const load = useCallback(async () => {
    setScreen({ kind: 'loading' });
    try {
      const r = (await backend.send({ action: 'load' })) as unknown as LoadReply;
      setRecord(r.record);
      setPointsLeft(r.pointReignsLeft);
      setReign(r.reign);
      if (r.reign) {
        setLook(r.reign.look);
        setD(EMPTY);
        setSkipped([]);
        setScreen({ kind: 'report' });
      } else setScreen({ kind: 'start' });
    } catch (e) {
      setScreen({ kind: 'problem', message: (e as Error).message });
    }
  }, [backend]);

  useEffect(() => {
    void load();
  }, [load]);

  // Each new screen (or step) starts with its heading, so a screen reader hears where they are.
  const where = screen.kind === 'decide' ? `decide-${screen.step}` : screen.kind === 'turns' ? `turns-${screen.at}` : screen.kind;
  useEffect(() => {
    heading.current?.focus();
  }, [where]);

  async function begin() {
    setBusy(true);
    setProblem(null);
    try {
      const r = (await backend.send({ action: 'start', look })) as unknown as ReignReply;
      setReign(r.reign);
      setD(EMPTY);
      setSkipped([]);
      setScreen({ kind: 'report' });
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function endYear() {
    if (!reign) return;
    setBusy(true);
    setProblem(null);
    try {
      const r = (await backend.send({ action: 'decide', reign: reign.id, year: reign.city.year, decisions: d })) as unknown as ReignReply;
      setReign(r.reign);
      setD(EMPTY);
      setSkipped([]);
      if (r.already) setScreen({ kind: 'report' });
      else setScreen({ kind: 'turns', cards: yearCards(r.reign.city), at: 0 });
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code === 'gone') void load();
      else setProblem(err.message);
    } finally {
      setBusy(false);
    }
  }

  const council = reign?.council && reign.council.year === reign.city.year ? reign.council : null;
  const nextSlot = council ? council.questions.findIndex((q) => !council.answered[String(q.slot)] && !skipped.includes(q.slot)) : -1;
  const boons: Adviser[] = council ? council.advisers.filter((_, slot) => council.answered[String(slot)]?.right) : [];

  async function answer(slot: number, value: number, ms: number): Promise<MarkedAnswer> {
    if (!reign || !council) throw new Error('That question has gone.');
    const r = (await backend.send({ action: 'answer', reign: reign.id, year: reign.city.year, slot, value, ms: Math.round(ms) })) as unknown as AnswerReply;
    setReign((old) =>
      old?.council ? { ...old, council: { ...old.council, answered: { ...old.council.answered, [String(slot)]: { right: r.right, answer: r.answer } } } } : old,
    );
    const q = council.questions[slot];
    return {
      correct: r.right,
      fact: factText(q, r.answer),
      boxBefore: 0,
      boxAfter: 0,
      answer: r.answer,
      ...(r.right ? { reward: `Boon won: ${BOONS[council.advisers[slot]].short}!` } : {}),
    };
  }

  const title = (
    <div className="kk-top">
      <h1>Kingdom Keeper</h1>
      {backend.trial && <span className="kk-trial">Trial: saved on this browser only, no points</span>}
    </div>
  );
  const footer = (
    <div className="kk-foot">
      {screen.kind !== 'howto' && screen.kind !== 'loading' && (
        <button type="button" className="kk-btn kk-btn--quiet" onClick={() => setScreen({ kind: 'howto', back: screen })}>How to play</button>
      )}
      {reign && reign.city.status === 'playing' && (screen.kind === 'report' || screen.kind === 'council') && (
        <button type="button" className="kk-btn kk-btn--quiet" onClick={() => setScreen({ kind: 'start' })}>Start a new reign</button>
      )}
      <p className="kk-credits">Based on the rules of Hamurabi (1968–73, public domain). Pictures made for this game (see CREDITS).</p>
    </div>
  );

  let body: React.ReactNode = null;

  if (screen.kind === 'loading') body = <p className="kk-panel" role="status">Opening the gates of Riverstone…</p>;

  if (screen.kind === 'problem') {
    body = (
      <section className="kk-panel" aria-labelledby="kk-problem">
        <h2 id="kk-problem" ref={heading} tabIndex={-1}>Riverstone is closed for now</h2>
        <p>{screen.message}</p>
        <button type="button" className="kk-btn kk-btn--hot" onClick={() => void load()}>Try again</button>
      </section>
    );
  }

  if (screen.kind === 'howto') {
    body = (
      <section className="kk-panel" aria-labelledby="kk-howto">
        <h2 id="kk-howto" ref={heading} tabIndex={-1}>How to play</h2>
        <HowToPlayBody />
        <button type="button" className="kk-btn kk-btn--hot" onClick={() => setScreen(screen.back)}>Back</button>
      </section>
    );
  }

  if (screen.kind === 'start') {
    const open = reign && reign.city.status === 'playing';
    body = (
      <section className="kk-screen" aria-labelledby="kk-start">
        <Stage scene="title" size="tall">
          <h2 id="kk-start" className="kk-sign" ref={heading} tabIndex={-1}>Riverstone needs a ruler</h2>
        </Stage>
        <div className="kk-panel">
          <p className="kk-lead">
            Rule the river city of Riverstone for {YEARS} years. Each year your council asks you a question or two, and you decide how much land to buy or sell, how much grain to feed your people and how many acres to plant.
            Keep everyone fed and the city growing!
          </p>
          {record && (record.reigns > 0 || record.best > 0) && (
            <p className="kk-soft">
              Reigns finished: {record.reigns}. Legendary reigns: {record.legendary}. Biggest city: {plural(record.best, 'person', 'people')}.
            </p>
          )}
          {!backend.trial && <p className="kk-soft">{pointsLeft > 0 ? `Reigns that give points today: ${pointsLeft}.` : 'You’ve had today’s points. You can still play!'}</p>}
          <h3>Choose your ruler</h3>
          <div className="kk-looks" role="group" aria-label="Rulers">
            {LOOKS.map((l, i) => {
              const src = rulerThumb(l);
              const label = `Ruler ${i + 1}`;
              return (
                <button key={l} type="button" className="kk-look" aria-pressed={look === l} aria-label={label} onClick={() => setLook(l)}>
                  {src ? <img src={src} alt="" decoding="async" /> : <span>{label}</span>}
                </button>
              );
            })}
          </div>
          {open && <p className="kk-warn">Starting a new reign ends the one you are playing now (year {reign.city.year}).</p>}
          {problem && <p className="kk-warn" role="alert">{problem}</p>}
          <div className="kk-actions">
            <button type="button" className="kk-btn kk-btn--hot kk-btn--big" onClick={() => void begin()} disabled={busy}>
              {busy ? 'Opening the gates…' : 'Begin your reign'}
            </button>
            {open && <button type="button" className="kk-btn" onClick={() => setScreen({ kind: 'report' })}>Carry on your reign</button>}
          </div>
        </div>
      </section>
    );
  }

  if (reign && screen.kind === 'report') {
    const city = reign.city;
    const toCouncil = nextSlot >= 0;
    body = (
      <section className="kk-screen" aria-labelledby="kk-report">
        <Stage scene={`city-${citySize(city.people)}` as SceneId} size="tall">
          <h2 id="kk-report" className="kk-sign" ref={heading} tabIndex={-1}>Year {city.year}: the steward’s report</h2>
          <Ruler look={reign.look} />
          <Courtier who="steward" />
        </Stage>
        <Status city={city} />
        <div className="kk-panel">
          <p className="kk-soft">{PEOPLE.steward.title} opens the big ledger:</p>
          <ul className="kk-report">
            {reportLines(city).map((line) => <li key={line}>{line}</li>)}
          </ul>
          <div className="kk-actions">
            {toCouncil ? (
              <button type="button" className="kk-btn kk-btn--hot kk-btn--big" onClick={() => setScreen({ kind: 'council' })}>Meet your council</button>
            ) : (
              <button type="button" className="kk-btn kk-btn--hot kk-btn--big" onClick={() => setScreen({ kind: 'decide', step: 0 })}>Make this year’s plans</button>
            )}
          </div>
        </div>
      </section>
    );
  }

  if (reign && screen.kind === 'council') {
    const adviser = council && nextSlot >= 0 ? council.advisers[nextSlot] : null;
    body = (
      <section className="kk-screen" aria-labelledby="kk-council">
        <Stage scene="council" size="tall">
          <h2 id="kk-council" className="kk-sign" ref={heading} tabIndex={-1}>
            {adviser ? PEOPLE[adviser].title : 'The council has spoken'}
          </h2>
          <Ruler look={reign.look} />
          {adviser && <Courtier key={adviser} who={adviser} />}
        </Stage>
        <Status city={reign.city} />
        <div className="kk-panel">
          {council && (
            <ul className="kk-council" aria-label="This year's council">
              {council.advisers.map((a, slot) => {
                const done = council.answered[String(slot)];
                const state = done ? (done.right ? 'won' : 'missed') : skipped.includes(slot) ? 'skipped' : slot === nextSlot ? 'now' : 'waiting';
                return (
                  <li key={a} className={`kk-council__item kk-council__item--${state}`}>
                    <strong>{PEOPLE[a].name}</strong>: {BOONS[a].short}
                    <span className="kk-council__state">{{ won: ' (boon won!)', missed: ' (no boon this year)', skipped: ' (skipped)', now: ' (asking now)', waiting: '' }[state]}</span>
                  </li>
                );
              })}
            </ul>
          )}
          {adviser ? (
            <>
              <p className="kk-lead">“{BOONS[adviser].ask}”</p>
              <div className="kk-actions">
                <button type="button" className="kk-btn kk-btn--hot kk-btn--big" onClick={() => setAsking(nextSlot)}>Hear the question</button>
                <button type="button" className="kk-btn" onClick={() => setSkipped((s) => [...s, nextSlot])}>Not this year</button>
              </div>
            </>
          ) : (
            <>
              <p className="kk-lead">{boons.length ? `Your boons this year: ${boons.map((b) => BOONS[b].short).join(', ')}.` : 'No boons this year. Your city carries on just the same.'}</p>
              <div className="kk-actions">
                <button type="button" className="kk-btn kk-btn--hot kk-btn--big" onClick={() => setScreen({ kind: 'decide', step: 0 })}>Make this year’s plans</button>
              </div>
            </>
          )}
        </div>
        {asking !== null && council && (
          <QuestionModal
            question={{ ...council.questions[asking], id: council.questions[asking].slot }}
            title={`${PEOPLE[council.advisers[asking]].title} asks`}
            note={`A right answer wins ${BOONS[council.advisers[asking]].short}.`}
            spot="Council"
            onSubmit={(value, ms) => answer(asking, value, ms)}
            onDone={() => setAsking(null)}
            onClose={() => {
              setSkipped((s) => [...s, asking]);
              setAsking(null);
            }}
            closeLabel="Not this year"
          />
        )}
      </section>
    );
  }

  if (reign && screen.kind === 'decide') {
    body = (
      <>
        <Status city={reign.city} />
        <Decide
          city={reign.city}
          d={d}
          setD={setD}
          boons={boons}
          step={screen.step}
          setStep={(step) => {
            setProblem(null);
            setScreen({ kind: 'decide', step });
          }}
          look={reign.look}
          onDone={() => void endYear()}
          busy={busy}
          problem={problem}
          heading={heading}
        />
      </>
    );
  }

  if (reign && screen.kind === 'turns') {
    const card = screen.cards[screen.at];
    const last = screen.at === screen.cards.length - 1;
    const over = reign.city.status !== 'playing';
    body = (
      <section className="kk-screen" aria-labelledby="kk-turn">
        <Stage scene={card.scene} size="tall">
          <h2 id="kk-turn" className="kk-sign" ref={heading} tabIndex={-1}>{card.title}</h2>
        </Stage>
        <div className="kk-panel kk-card">
          <p className="kk-soft">The end of year {over && reign.city.status === 'done' ? YEARS : reign.city.report.year - 1}{screen.cards.length > 1 ? ` (${screen.at + 1} of ${screen.cards.length})` : ''}</p>
          {card.lines.map((line) => <p key={line} className="kk-lead">{line}</p>)}
          <div className="kk-actions">
            <button
              type="button"
              className="kk-btn kk-btn--hot kk-btn--big"
              onClick={() => (last ? setScreen(over ? { kind: 'end' } : { kind: 'report' }) : setScreen({ ...screen, at: screen.at + 1 }))}
            >
              {last ? (over ? 'See how your reign is remembered' : `On to year ${reign.city.year}`) : 'Next'}
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (reign && screen.kind === 'end') {
    const city = reign.city;
    const rating = reign.rating ?? 'hard';
    body = (
      <section className="kk-screen" aria-labelledby="kk-end">
        <Stage scene={`end-${rating}` as SceneId} size="tall">
          <h2 id="kk-end" className="kk-sign" ref={heading} tabIndex={-1}>{ratingName(rating)}</h2>
        </Stage>
        <div className="kk-panel">
          <p className="kk-lead">
            {{
              legendary: 'A legendary reign! Riverstone will tell stories about you for a hundred years.',
              good: 'A good reign. The people of Riverstone are glad you were their ruler.',
              fair: 'A fair reign, with some hard years. The city is still standing.',
              hard: city.status === 'ended' ? 'Your reign ended early. Every ruler learns something: try again!' : 'Hard times. Many people went hungry. Try again and feed everyone!',
            }[rating]}
          </p>
          <dl className="kk-summary">
            <div><dt>Years ruled</dt><dd>{city.hungryPct.length}</dd></div>
            <div><dt>People at the end</dt><dd>{n(city.people)}</dd></div>
            <div><dt>Land</dt><dd>{n(city.land)} acres</dd></div>
            <div><dt>Went hungry each year, on average</dt><dd>{Math.round(averageHungry(city))}%</dd></div>
            <div><dt>Grain in the granary</dt><dd>{n(city.grain)}</dd></div>
            {!backend.trial && <div><dt>Points</dt><dd>{reign.points ?? 0}</dd></div>}
          </dl>
          <details className="kk-fold">
            <summary>How reigns are remembered</summary>
            <ul>
              {RATINGS.map((r) => (
                <li key={r.id}><strong>{r.name}</strong>: on average no more than {r.hungryAtMost}% went hungry each year, and at least {r.peopleAtLeast} people at the end.</li>
              ))}
              <li><strong>{HARD_TIMES.name}</strong>: anything else, or a reign that ended early.</li>
            </ul>
          </details>
          <div className="kk-actions">
            <button
              type="button"
              className="kk-btn kk-btn--hot kk-btn--big"
              onClick={() => {
                setReign(null);
                void load();
              }}
            >
              Rule again
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="kk">
      {title}
      {body}
      {footer}
    </div>
  );
}
