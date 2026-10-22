/**
 * Dragon Maths, the places where other heroes show up: the arena, the Daily News, the Warriors list and the Hall of
 * Heroes. Everything here is words the code wrote and names/avatars from the hub: no student text, no maths scores.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { CLASSES } from '../../../shared/lord/data';
import type { DuelEvent } from '../../../shared/lord/engine';
import type { LordAction } from '../../../shared/lord/server';
import type { Hero, HeroClass } from '../../../shared/lord/types';
import { AvatarImage } from '../../avatar/AvatarImage';
import type { HallRow, LordBackend, NewsItem, WarriorRow } from '../../data/lord';
import type { Reply } from './Places';
import { HeroSprite } from './Sprite';
import { dayLabel, narrateDuel } from './text';
import { Stage } from './Stage';
import type { SceneId } from './art';

function Page({ title, back, children, scene }: { title: string; back: () => void; children: ReactNode; scene: SceneId }) {
  return (
    <section className="lord-place" aria-label={title}>
      <Stage scene={scene} size="short">
        <header className="lord-place__head">
          <h2 className="lord-sign">{title}</h2>
          <button type="button" className="lord-btn" onClick={back}>
            <kbd>Esc</kbd> Back to the village
          </button>
        </header>
      </Stage>
      <div className="lord-panel">{children}</div>
    </section>
  );
}

/** Loads one of the lists when the page opens, and offers to try again if it can't. */
function useList<T>(fetcher: () => Promise<T[] | null>) {
  const [rows, setRows] = useState<T[] | null | 'failed'>(null);
  const load = useCallback(() => {
    setRows(null);
    let current = true;
    fetcher().then((r) => current && setRows(r ?? 'failed'), () => current && setRows('failed'));
    return () => {
      current = false;
    };
  }, [fetcher]);
  useEffect(() => load(), [load]);
  return { rows, retry: load };
}

function Failed({ retry }: { retry: () => void }) {
  return (
    <p className="lord-note" role="status">
      We couldn’t fetch that just now.{' '}
      <button type="button" className="lord-btn" onClick={retry}>Try again</button>
    </p>
  );
}

// ---------------------------------------------------------------- the arena

export interface DuelResult {
  outcome: 'won' | 'lost';
  rounds: number;
  exp: number;
  log: DuelEvent[];
  you: { name: string; heroClass: HeroClass; level: number; maxHp: number };
  opponent: { name: string; heroClass: HeroClass; level: number; maxHp: number; computer: boolean };
}

export function Arena({ hero, act, say, back, busy }: {
  hero: Hero; act: (a: LordAction) => Promise<Reply | null>; say: (n: string) => void; back: () => void; busy: boolean;
}) {
  const [last, setLast] = useState<DuelResult | null>(null);
  const left = hero.arenaLeft;

  async function fight() {
    const reply = await act({ action: 'arena' });
    if (!reply) return;
    const r = reply.result as unknown as DuelResult;
    setLast(r);
    say('');
  }

  return (
    <Page title="The Arena" scene="arena" back={back}>
      <p className="lord-lead">
        Fight a copy of a classmate’s hero, or one of the village’s computer heroes, near your level. The computer plays it for you.
        Winning gives a little experience. <strong>Losing costs you nothing</strong>, and a classmate’s real hero is never hurt.
      </p>
      <p className="lord-soft">Arena fights left today: <strong>{left}</strong> of 3.</p>
      <div className="lord-actions">
        <button type="button" className="lord-btn lord-btn--hot" autoFocus disabled={busy || left <= 0} onClick={() => void fight()}>
          {left > 0 ? 'Step into the arena' : 'No arena fights left today'}
        </button>
      </div>
      {last && (
        <div className="lord-duel" aria-live="polite">
          <div className="lord-duel__heroes">
            <div>
              <HeroSprite heroClass={last.you.heroClass} scale={5} />
              <p><strong>You</strong><br />{CLASSES[last.you.heroClass].name}, level {last.you.level}</p>
            </div>
            <span aria-hidden="true">vs</span>
            <div>
              <HeroSprite heroClass={last.opponent.heroClass} scale={5} />
              <p><strong>{last.opponent.name}</strong><br />{CLASSES[last.opponent.heroClass].name}, level {last.opponent.level}
                {last.opponent.computer && <><br /><span className="lord-badge">computer hero</span></>}</p>
            </div>
          </div>
          <h3>{last.outcome === 'won' ? `You won! +${last.exp} experience.` : 'You lost this one. It costs you nothing.'}</h3>
          <ol className="lord-log" aria-label="What happened in the fight">
            {narrateDuel(last.log, last.opponent.name).map((line, i) => <li key={i}>{line}</li>)}
          </ol>
        </div>
      )}
    </Page>
  );
}

// ---------------------------------------------------------------- the news

export function NewsPage({ backend, today, deeds, back }: { backend: LordBackend; today: string; deeds: string[]; back: () => void }) {
  const fetcher = useCallback(() => backend.fetchNews(), [backend]);
  const { rows, retry } = useList<NewsItem>(fetcher);
  const days = new Map<string, NewsItem[]>();
  if (Array.isArray(rows)) for (const r of rows) days.set(r.day, [...(days.get(r.day) ?? []), r]);
  return (
    <Page title="The Daily News" scene="news" back={back}>
      <p className="lord-soft">Everything here is written by the village scribe from what really happened. Nobody can write into it.</p>
      {rows === null && <p className="lord-soft" role="status">Fetching the news…</p>}
      {rows === 'failed' && <Failed retry={retry} />}
      {[...days.entries()].map(([day, items]) => (
        <div key={day}>
          <h3>{dayLabel(day, today)}</h3>
          <ul className="lord-news">
            {items.map((n, i) => <li key={i} className={`lord-news__${n.kind}`}>{n.line}</li>)}
          </ul>
        </div>
      ))}
      {Array.isArray(rows) && rows.length === 0 && <p className="lord-soft">No news yet today.</p>}
      <h3>Your deeds this visit</h3>
      {deeds.length === 0 ? <p className="lord-soft">Nothing yet. Go and do something newsworthy!</p> : <ul className="lord-news">{deeds.map((n, i) => <li key={i}>{n}</li>)}</ul>}
    </Page>
  );
}

// ---------------------------------------------------------------- the Warriors list

export function Warriors({ backend, back }: { backend: LordBackend; back: () => void }) {
  const fetcher = useCallback(() => backend.fetchWarriors(), [backend]);
  const { rows, retry } = useList<WarriorRow>(fetcher);
  return (
    <Page title="The Warriors list" scene="arena" back={back}>
      <p className="lord-soft">
        This season’s best heroes: first whoever beat the Red Dragon most this season, then the highest level. Only levels and stars are shown, never maths.
      </p>
      {rows === null && <p className="lord-soft" role="status">Fetching the list…</p>}
      {rows === 'failed' && <Failed retry={retry} />}
      {Array.isArray(rows) && rows.length === 0 && <p className="lord-soft">Nobody has set out yet this season. It could be you!</p>}
      {Array.isArray(rows) && rows.length > 0 && (
        <ol className="lord-board" aria-label="Warriors this season">
          {rows.map((r, i) => (
            <li key={`${r.place}-${r.display_name}`} className={r.is_me ? 'is-me' : undefined} value={r.place}>
              {i > 0 && r.place > rows[i - 1].place + 1 && r.place > 10 && <span className="lord-board__gap" aria-hidden="true">⋯</span>}
              <span className="lord-board__place" aria-label={`Place ${r.place}`}>{r.place}</span>
              <AvatarImage avatar={r.avatar} size={36} />
              <span className="lord-board__name">{r.display_name}{r.is_me && <span className="lord-soft"> (you)</span>}</span>
              <span>Level {r.level}</span>
              <span aria-label={`${r.stars} dragon stars`}>{r.stars > 0 ? '★'.repeat(Math.min(r.stars, 5)) + (r.stars > 5 ? `+${r.stars - 5}` : '') : ''}</span>
            </li>
          ))}
        </ol>
      )}
    </Page>
  );
}

// ---------------------------------------------------------------- the Hall of Heroes

export function HallOfHeroes({ backend, back }: { backend: LordBackend; back: () => void }) {
  const fetcher = useCallback(() => backend.fetchHall(), [backend]);
  const { rows, retry } = useList<HallRow>(fetcher);
  const seasons = new Map<number, HallRow[]>();
  if (Array.isArray(rows)) for (const r of rows) seasons.set(r.season, [...(seasons.get(r.season) ?? []), r]);
  return (
    <Page title="The Hall of Heroes" scene="hall" back={back}>
      <p className="lord-soft">Everyone who has beaten the Red Dragon, season by season. Heroes start again every season, but the Hall remembers.</p>
      {rows === null && <p className="lord-soft" role="status">Opening the Hall…</p>}
      {rows === 'failed' && <Failed retry={retry} />}
      {Array.isArray(rows) && rows.length === 0 && <p className="lord-lead">The Hall is empty. Will you be the first to beat the Red Dragon?</p>}
      {[...seasons.entries()].map(([season, list]) => (
        <div key={season}>
          <h3>Season {season}</h3>
          <ul className="lord-board">
            {list.map((r) => (
              <li key={`${season}-${r.display_name}`} className={r.is_me ? 'is-me' : undefined}>
                <AvatarImage avatar={r.avatar} size={36} />
                <span className="lord-board__name">{r.display_name}{r.is_me && <span className="lord-soft"> (you)</span>}</span>
                <span>{r.kills === 1 ? 'beat the dragon' : `beat the dragon ${r.kills} times`}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Page>
  );
}

