/**
 * The Circuit Racer preview: the whole game with no sign-in. The real `circuit` server handler runs in this page on a
 * pretend database (src/games/circuit/pretend.ts), so it replays every finish and counts the 5 a day exactly as live, and
 * never talks to the school's server. Run it: npx vite --config vite.circuit-preview.config.ts
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { allowTestRoad, ROADS, type RoadProgress } from '../../shared/circuit/game';
import { TEST_ROAD } from '../../shared/circuit/roads/test';
import { CircuitGame } from '../../src/games/circuit/CircuitGame';
import { pretendCircuit } from '../../src/games/circuit/pretend';
import { SoundProvider } from '../../src/sound';
import '../../src/styles.css';

const params = new URLSearchParams(location.search);
// ?runs=4: that many of today's 5 finishes already used. ?open=all: every road open. ?unlimited=1: Unlimited today.
const today = Math.max(0, Math.floor(Number(params.get('runs')) || 0));
const openAll = params.get('open') === 'all';
const roads: Record<string, RoadProgress> = openAll
  ? Object.fromEntries(ROADS.map((r) => [r.id, { best: 9000, medal: 'bronze', clean: false, charged: false, finishes: 1 } as RoadProgress]))
  : {};
// ?maths=off (or choose): the teacher's maths switch. ?mc=1: multiple-choice questions. ?test=1: a test road with a port and two data gates.
const maths = params.get('maths') === 'off' ? 'off' : params.get('maths') === 'choose' ? 'choose' : 'on';
if (params.get('test') === '1') allowTestRoad(TEST_ROAD);
const backend = pretendCircuit({ today, roads, unlimited: params.get('unlimited') === '1', maths, multipleChoice: params.get('mc') === '1' });

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <SoundProvider>
      <CircuitGame
        backend={backend}
        extra={<p className="cr-keys">Preview only: nothing is saved to the school. Add ?runs=4 to start with one race left today, ?open=all to open every road, ?unlimited=1 for Unlimited today, ?maths=off (or choose) for the teacher's maths switch, ?mc=1 for multiple-choice questions, ?test=1 for a test road with data gates. The maths uses a pretend focus (7 times table, fractions, decimals, percentages).</p>}
      />
    </SoundProvider>
  </StrictMode>,
);
