/**
 * Preview only: Quick looks (subitising), step S.1. Progress is saved in this browser only
 * (nothing goes to a database). The dashed box at the bottom of the home screen has test buttons.
 */
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { STAGES, type StageNumber } from '../../shared/subitising/config';
import { subKey } from '../../shared/subitising/keys';
import { dayString } from '../../shared/training/records';
import { SubitisingApp } from '../../src/subitising/SubitisingApp';
import { emptySubState, loadSubState, saveSubState, type SubState } from '../../src/subitising/store';

function Preview() {
  const [state, setStateRaw] = useState<SubState>(loadSubState);
  const [run, setRun] = useState(0);
  const setState = (s: SubState) => {
    saveSubState(s);
    setStateRaw(s);
  };
  /** Pretend the student has finished the stages below `stage`, and is just starting it. */
  const jumpTo = (stage: StageNumber) => setState({ ...state, placed: true, startStage: stage });
  /** Pretend the current stage is nearly done: 7 right answers across all its picture types. */
  const nearly = () => {
    const stage = STAGES[state.startStage - 1];
    const now = Date.now();
    const more = Array.from({ length: 8 }, (_, i) => ({ key: subKey(stage.types[i % stage.types.length], stage.min), correct: i !== 3, at: now + i }));
    setState({ ...state, placed: true, answers: [...state.answers, ...more] });
  };

  const tools = (
    <div className="sb-tools">
      <strong>Test buttons (preview only)</strong>
      <div className="sb-row">
        {STAGES.map((s) => (
          <button key={s.id} type="button" className="sb-btn" onClick={() => jumpTo(s.id)}>
            Start at stage {s.id}
          </button>
        ))}
      </div>
      <div className="sb-row">
        <button type="button" className="sb-btn" onClick={nearly}>
          Finish this stage for me
        </button>
        <button
          type="button"
          className="sb-btn"
          onClick={() => {
            setState(emptySubState());
            setRun(run + 1);
          }}
        >
          Reset everything
        </button>
      </div>
    </div>
  );

  return <SubitisingApp key={run} state={state} onState={setState} today={dayString(new Date())} tools={tools} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Preview />
  </StrictMode>,
);
