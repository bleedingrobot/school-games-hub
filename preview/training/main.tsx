/**
 * Preview only: Basic Facts Training, stage T.1. Records are saved in this browser only
 * (nothing goes to a database). The dashed box at the bottom of the home screen has test buttons.
 */
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { dayString, emptyState, type TrainingState } from '../../shared/training/records';
import { sampleState } from '../../shared/training/sample';
import { TrainingApp } from '../../src/training/TrainingApp';
import { loadState, readJson, saveState, writeJson } from '../../src/training/store';

const OFFSET_KEY = 'training-t1-day-offset';

function dayWithOffset(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return dayString(d);
}

function Preview() {
  const [state, setStateRaw] = useState<TrainingState>(loadState);
  const [offset, setOffset] = useState<number>(() => readJson(OFFSET_KEY, 0));
  const [run, setRun] = useState(0);
  const today = dayWithOffset(offset);

  const setState = (s: TrainingState) => {
    saveState(s);
    setStateRaw(s);
  };
  const changeDay = (n: number) => {
    writeJson(OFFSET_KEY, n);
    setOffset(n);
  };

  const tools = (
    <div className="tr-tools">
      <strong>Test buttons (preview only)</strong>
      <span>
        Today is {today}
        {offset ? ` (pretending: +${offset} day${offset === 1 ? '' : 's'})` : ''}
      </span>
      <div className="tr-row">
        <button type="button" className="tr-btn" onClick={() => changeDay(offset + 1)}>
          Pretend it’s tomorrow
        </button>
        <button type="button" className="tr-btn" onClick={() => setState(sampleState(today, (n) => dayWithOffset(offset - n)))}>
          Fill the map with sample records
        </button>
        <button
          type="button"
          className="tr-btn"
          onClick={() => {
            changeDay(0);
            setState(emptyState());
            setRun(run + 1);
          }}
        >
          Reset everything
        </button>
      </div>
    </div>
  );

  return <TrainingApp key={run} state={state} onState={setState} today={today} tools={tools} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Preview />
  </StrictMode>,
);
