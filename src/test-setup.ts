import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { forgetSettings } from './data/settingsMemory';
import { forgetTrainingLock } from './data/trainingLockMemory';
import { resetSkips, setSkipMode } from './maths/questionLog';

afterEach(() => {
  cleanup();
  localStorage.clear();
  forgetSettings(); // the game switches are remembered for 5 minutes; each test starts fresh
  forgetTrainingLock(); // so is Training before games, for a minute
  setSkipMode('on'); // the class's skip switch (a test may change it)
  resetSkips();
});
