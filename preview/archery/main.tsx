/**
 * The Archery Challenge preview (Stage 5): the whole game, against bots, with no sign-in. It never talks to the
 * school's server: the real server function's logic runs in this browser on a pretend database
 * (src/games/archery/trialBackend.ts), kept on this device. The speed round asks times-table questions for a
 * pretend pupil with no maths records. Preview tools (not in the real game): add pretend coins, start again.
 * Run it: npx vite --config vite.archery-preview.config.ts. One file: see vite.archery-preview.config.ts.
 */
import { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { archeryApi } from '../../src/data/archery';
import { ArcheryGame } from '../../src/games/archery/ArcheryGame';
import { emptyTrialData, trialBackend, type TrialData } from '../../src/games/archery/trialBackend';
import { SoundProvider } from '../../src/sound';
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
    </details>
  );

  return <ArcheryGame key={key} api={api} extra={tools} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SoundProvider>
      <Preview />
    </SoundProvider>
  </StrictMode>,
);
