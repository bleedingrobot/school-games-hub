/**
 * The class sky (docs/ISLES-COSY-PLAN.md, section 11): classmates' islands with their name, Sky Keeper, size and
 * decorations, who can be raced now (and why not), and the class news board (good news only). A visit shows one
 * classmate's island, look only, and is where a free gift can be left. Never a classmate's coins or maths: the server
 * doesn't send them.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { GIFT_COINS, GIFTS, LIGHTHOUSE, WELL_RACED_COINS, type GiftId } from '../../../shared/isles/config';
import { PROBLEM_TEXT } from '../../../shared/isles/server';
import { newIsland, type Island } from '../../../shared/isles/engine';
import { giftArt, keeperArt } from './art';
import type { ClassmateCard, ClassSkyView, IslesBackend, Visit } from './backend';
import { Art, IslandPicture } from './Island';
import { daysAgo, GIFT_EMOJI, giftName, newsLine, plural } from './words';

/** The heading moves focus to itself when the screen opens, as every Sky Isles screen does. */
function useFocusedHeading() {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return heading;
}

function Portrait({ keeper, name }: { keeper: string | null; name: string }) {
  return (
    <span className="si-mate__keeper">
      <Art src={keeper ? keeperArt(keeper, true) : undefined} fallback={<span className="si-keeper__drawn" aria-hidden="true">{name.slice(0, 1)}</span>} />
    </span>
  );
}

/** "12 building spots, 3 decorations, Sky Lighthouse lit". */
function sizeWords(c: Pick<ClassmateCard, 'spots' | 'decorations' | 'lighthouse'>): string {
  const parts = [plural(c.spots, 'building spot'), plural(c.decorations, 'decoration')];
  if (c.lighthouse >= LIGHTHOUSE.length) parts.push('Sky Lighthouse lit');
  else if (c.lighthouse > 0) parts.push(`Lighthouse stage ${c.lighthouse}`);
  return parts.join(', ');
}

/** Reasons about the pupil's own island (not the classmate's): said once at the top of the class sky, not on every card. */
const OWN_REASONS: string[] = [PROBLEM_TEXT['no-turns'], PROBLEM_TEXT['no-races-left'], PROBLEM_TEXT['raced-this-turn'], 'Sky Races are switched off for your class.'];

/** A Race button, greyed out with the reason when the island can't be raced now (`saidAbove`: the reason's element). */
function RaceButton({ card, onRace, saidAbove }: { card: ClassmateCard; onRace: (c: ClassmateCard) => void; saidAbove?: string }) {
  const why = useId();
  const own = card.raceWhy !== null && OWN_REASONS.includes(card.raceWhy) && saidAbove;
  return (
    <div className="si-choice">
      <button
        type="button"
        className="button button--primary"
        disabled={card.raceWhy !== null}
        aria-describedby={card.raceWhy ? (own ? saidAbove : why) : undefined}
        onClick={() => onRace(card)}
        aria-label={`Race ${card.name}'s island`}
      >
        Race
      </button>
      {card.raceWhy && !own && <span id={why} className="si-choice__why">{card.raceWhy}</span>}
    </div>
  );
}

export function ClassSky({ backend, today, onVisit, onRace, onHall, onBack }: {
  backend: IslesBackend;
  today: number;
  onVisit: (id: string) => void;
  onRace: (c: ClassmateCard) => void;
  onHall: () => void;
  onBack: () => void;
}) {
  const [sky, setSky] = useState<ClassSkyView | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const heading = useFocusedHeading();
  const ownWhy = useId();
  const own = sky?.classmates.find((c) => c.raceWhy !== null && OWN_REASONS.includes(c.raceWhy))?.raceWhy ?? null;

  useEffect(() => {
    backend.send({ action: 'sky' }).then(
      (r) => setSky(r as unknown as ClassSkyView),
      (e: Error) => setProblem(e.message),
    );
  }, [backend]);

  return (
    <section className="si-sky" aria-labelledby="si-sky-title">
      <div className="si-top">
        <h2 id="si-sky-title" ref={heading} tabIndex={-1}>Class sky</h2>
        <div className="si-row">
          <button type="button" className="button button--light" onClick={onHall}>🏆 Hall of the Skies</button>
          <button type="button" className="button button--light" onClick={onBack}>Back to my island</button>
        </div>
      </div>
      {problem && <p className="si-problem" role="alert">{problem}</p>}
      {!sky && !problem && <p>Looking across the sky…</p>}
      {sky && (
        <div className="si-sky__main">
          <section className="si-panel si-news" aria-labelledby="si-news-title">
            <h3 id="si-news-title">Sky news</h3>
            {sky.news.length ? (
              <ul className="si-news__list">
                {sky.news.map((item, i) => (
                  <li key={i}><span>{newsLine(item)}</span> <em className="si-note">{daysAgo(item.day, today)}</em></li>
                ))}
              </ul>
            ) : (
              <p className="si-note">No news yet. Grow your island, win a race or put up a decoration to make the news!</p>
            )}
          </section>
          <section className="si-panel" aria-labelledby="si-mates-title">
            <h3 id="si-mates-title">Your class's islands</h3>
            {own && <p id={ownWhy} className="si-step__why">Sky Races: {own}</p>}
            {sky.classmates.length ? (
              <ul className="si-mates">
                {sky.classmates.map((c) => (
                  <li key={c.id} className="si-mate">
                    <Portrait keeper={c.keeper} name={c.name} />
                    <div className="si-mate__words">
                      <strong>{c.name}</strong>
                      {c.islandName && <span className="si-mate__isle">{c.islandName}</span>}
                      <span className="si-note">{sizeWords(c)}</span>
                    </div>
                    <div className="si-mate__buttons">
                      <button type="button" className="button button--light" onClick={() => onVisit(c.id)} aria-label={`Visit ${c.name}'s island`}>Visit</button>
                      <RaceButton card={c} onRace={onRace} saidAbove={ownWhy} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Nobody else in your class has an island yet. When they do, their islands float by here.</p>
            )}
            <p className="si-note">
              {sky.giftsSentToday ? "You've left a gift today. You can leave another tomorrow." : `Visit an island to leave a free gift: it gives them ${plural(GIFT_COINS, 'coin')}.`}
            </p>
          </section>
        </div>
      )}
    </section>
  );
}

/** A classmate's island to look at: the island picture needs a whole island, so what isn't sent is left at nothing. */
const lookIsland = (visit: Visit): Island => ({ ...newIsland(), ...visit.look, coins: 0, crystals: 0, turnsLeft: 0, driftLeft: 0 });

export function VisitIsland({ backend, who, onRace, onBack }: {
  backend: IslesBackend;
  who: string;
  onRace: (c: ClassmateCard) => void;
  onBack: () => void;
}) {
  const [visit, setVisit] = useState<Visit | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [sent, setSent] = useState<GiftId | null>(null);
  const [busy, setBusy] = useState(false);
  const heading = useFocusedHeading();
  const giftWhy = useId();

  useEffect(() => {
    backend.send({ action: 'visit', who }).then(
      (r) => setVisit(r.visit as Visit),
      (e: Error) => setProblem(e.message),
    );
  }, [backend, who]);

  const give = async (gift: GiftId) => {
    setBusy(true);
    setProblem(null);
    try {
      const r = await backend.send({ action: 'gift', to: who, gift });
      setVisit(r.visit as Visit);
      setSent(gift);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'That gift could not be left.');
    } finally {
      setBusy(false);
    }
  };

  const title = visit ? `${visit.name}'s island` : 'Visiting…';
  return (
    <section className="si-visit" aria-labelledby="si-visit-title">
      <div className="si-top">
        <h2 id="si-visit-title" ref={heading} tabIndex={-1}>{title}</h2>
        <button type="button" className="button button--light" onClick={onBack}>Back to the class sky</button>
      </div>
      {!visit && !problem && <p>Sailing over…</p>}
      {visit && (
        <div className="si-main">
          <div className="si-left">
            {visit.islandName && <p className="si-isle-name">🏝️ {visit.islandName}</p>}
            <IslandPicture island={lookIsland(visit)} keeper={visit.keeper} />
            <p className="si-note">
              {sizeWords(visit)}, {plural(visit.look.islanders, 'islander')}. Just looking: everything on {visit.name}'s island stays just as it is.
            </p>
          </div>
          <div className="si-right">
            <section className="si-panel" aria-labelledby="si-gift-title">
              <h3 id="si-gift-title">Leave a gift</h3>
              {sent ? (
                <p className="si-wind" role="status">
                  You left {visit.name} {giftName(sent)}! It gives them {plural(GIFT_COINS, 'coin')}, and it cost you nothing.
                </p>
              ) : (
                <>
                  <p>A gift gives {visit.name} {plural(GIFT_COINS, 'coin')}. It's free to give, one gift a day.</p>
                  <div className="si-gifts" role="group" aria-label="Choose a gift" aria-describedby={visit.giftWhy ? giftWhy : undefined}>
                    {GIFTS.map((g) => (
                      <button key={g.id} type="button" className="button button--light si-gift" disabled={visit.giftWhy !== null || busy} onClick={() => void give(g.id)}>
                        <span className="si-gift__pic" aria-hidden="true"><Art src={giftArt(g.id)} fallback={<>{GIFT_EMOJI[g.id]}</>} /></span>
                        <span>Leave {g.name}</span>
                      </button>
                    ))}
                  </div>
                  {visit.giftWhy && <p id={giftWhy} className="si-choice__why">{visit.giftWhy}</p>}
                </>
              )}
            </section>
            <section className="si-panel" aria-labelledby="si-visit-race-title">
              <h3 id="si-visit-race-title">Sky Race</h3>
              <p>Race your boat against {visit.name}'s island. {visit.name}'s island gets {plural(WELL_RACED_COINS, 'coin')} for racing well, whoever wins.</p>
              <RaceButton card={visit} onRace={onRace} />
            </section>
          </div>
        </div>
      )}
      {problem && <p className="si-problem" role="alert">{problem}</p>}
    </section>
  );
}
