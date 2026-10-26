/**
 * The Archery Challenge preview (Stages 5 and 6): the whole game, with no sign-in. It never talks to the school's
 * server: the real server function's logic runs in this browser on a pretend database
 * (src/games/archery/trialBackend.ts), kept on this device. The speed round asks times-table questions for a
 * pretend pupil with no maths records. Preview tools (not in the real game): add pretend coins, start again, and
 * "Two players on this screen": two pretend classmates (Ana and Ben) on one shared pretend server, with a switch at
 * the top to swap between them, so a classmate fight can be played from both sides (standIn.ts), and the pretend
 * teacher's Classmate fights switch for their class.
 * Run it: npx vite --config vite.archery-preview.config.ts. One file: see vite.archery-preview.config.ts.
 */
import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { archeryApi } from '../../src/data/archery';
import { ArcheryGame } from '../../src/games/archery/ArcheryGame';
import { emptyTrialData, trialBackend, type TrialData } from '../../src/games/archery/trialBackend';
import { SoundProvider } from '../../src/sound';
import { ANA, BEN, DUO_LABELS, forgetDuoData, makeDuo } from './standIn';
import '../../src/styles.css';
import './preview.css';

const DATA_KEY = 'archery-preview-data-v2';
const PLAYER = 'preview-pupil';

function loadData(): TrialData {
  try {
    const raw = JSON.parse(localStorage.getItem(DATA_KEY) ?? 'null') as TrialData | null;
    if (raw && typeof raw === 'object' && raw.pupils && raw.rounds && raw.fights) return raw;
  } catch {
    // Storage blocked or broken: start fresh.
  }
  return emptyTrialData();
}

function saveData(data: TrialData) {
  try {
    // Old speed rounds aren't needed again: keep the saved copy small.
    const rounds = Object.fromEntries(Object.entries(data.rounds).slice(-3));
    localStorage.setItem(DATA_KEY, JSON.stringify({ ...data, rounds, answers: data.answers.slice(-50), requests: {} }));
  } catch {
    // Not remembered, that's all.
  }
}

function Preview() {
  const [key, setKey] = useState(0);
  const { api, data } = useMemo(() => {
    const trial = trialBackend({ data: loadData() }, PLAYER);
    const send = async (body: Record<string, unknown>) => {
      const r = await trial.send(body);
      saveData(trial.data);
      return r;
    };
    return { api: archeryApi(send, PLAYER), data: trial.data };
  }, [key]);

  const tools = (refresh: () => void) => (
    <details className="arp-tools">
      <summary>Preview tools</summary>
      <button
        type="button"
        className="button button--light arp-small"
        onClick={() => {
          data.pupils[PLAYER] ??= { coins: 0, gear: {}, shields: [], bows: [], spent: 0, best: {}, rounds: [] };
          data.pupils[PLAYER].coins += 500;
          saveData(data);
          refresh();
        }}
      >
        +500 pretend coins
      </button>
      <button
        type="button"
        className="button button--light arp-small"
        onClick={() => {
          try {
            localStorage.removeItem(DATA_KEY);
          } catch {
            // Nothing to remove.
          }
          setKey((k) => k + 1);
        }}
      >
        Start again
      </button>
      <button type="button" className="button button--light arp-small" onClick={() => (location.hash = 'two')}>
        Two players on this screen
      </button>
    </details>
  );

  return <ArcheryGame key={key} api={api} extra={tools} />;
}

/**
 * Two pretend classmates on one screen: both games stay open (so both say "I'm here", hear challenges and keep their
 * turn clocks), and the switch at the top shows one at a time. A dot on the other name says something there wants you.
 */
function Duo() {
  const [key, setKey] = useState(0);
  const duo = useMemo(() => makeDuo(), [key]);
  const [showing, setShowing] = useState(ANA);
  const [nudge, setNudge] = useState<Record<string, string>>({});
  const [duelsOn, setDuelsOn] = useState(() => duo.duelsOn());
  useEffect(() => setDuelsOn(duo.duelsOn()), [duo]);

  // A dot on the hidden pupil's name when it's their turn or they've been challenged.
  useEffect(() => {
    const look = () => {
      const next: Record<string, string> = {};
      for (const id of [ANA, BEN]) {
        if (id === showing) continue;
        const open = Object.values(duo.hub.data.duels ?? {}).find((d) => (d.seat_a === id || d.seat_b === id) && ['asked', 'packing', 'playing'].includes(d.status));
        if (!open) continue;
        const seat = open.seat_a === id ? 0 : 1;
        if (open.status === 'asked' && seat === 1) next[id] = 'has a challenge';
        else if (open.status === 'packing' && !open.packs[seat]) next[id] = 'needs to pack';
        else if (open.status === 'playing' && open.turns.length % 2 === seat) next[id] = "it's their turn";
      }
      setNudge(next);
    };
    look();
    const timer = setInterval(look, 500);
    return () => clearInterval(timer);
  }, [duo, showing]);

  return (
    <div className="arp-duo">
      <div className="arp-duo__bar" role="group" aria-label="Preview: which pretend pupil you are">
        <span className="arp-duo__label">Preview, playing as:</span>
        {[ANA, BEN].map((id) => (
          <button key={id} type="button" className="button button--light arp-small arp-duo__who" aria-pressed={showing === id} onClick={() => setShowing(id)}>
            {DUO_LABELS[id]}{nudge[id] && <span className="arp-duo__dot"> ● <span className="arp-sr">{DUO_LABELS[id]} {nudge[id]}</span></span>}
          </button>
        ))}
        {!duelsOn && <span className="arp-duo__label">(classmate fights off)</span>}
        <details className="arp-duo__more">
          <summary>More</summary>
          <button type="button" className="button button--light arp-small" onClick={() => { duo.addCoins(showing, 500); setKey((k) => k + 1); }}>+500 pretend coins for {DUO_LABELS[showing]}</button>
          <button
            type="button" className="button button--light arp-small" aria-pressed={!duelsOn}
            onClick={() => { duo.setDuels(!duelsOn); setDuelsOn(!duelsOn); }}
          >
            {duelsOn ? 'Teacher: switch classmate fights off' : 'Teacher: switch classmate fights on'}
          </button>
          <button type="button" className="button button--light arp-small" onClick={() => { forgetDuoData(); setKey((k) => k + 1); }}>Start again</button>
          <button type="button" className="button button--light arp-small" onClick={() => (location.hash = '')}>One player</button>
        </details>
      </div>
      {[ANA, BEN].map((id) => (
        <div key={`${key}-${id}`} className="arp-duo__pane" data-showing={showing === id || undefined} aria-hidden={showing !== id || undefined} inert={showing !== id || undefined}>
          <ArcheryGame api={duo.pupils[id].api} duels={duo.pupils[id].link} me={id} />
        </div>
      ))}
    </div>
  );
}

function Root() {
  const [two, setTwo] = useState(() => location.hash === '#two');
  useEffect(() => {
    const changed = () => setTwo(location.hash === '#two');
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  return two ? <Duo /> : <Preview />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SoundProvider>
      <Root />
    </SoundProvider>
  </StrictMode>,
);
