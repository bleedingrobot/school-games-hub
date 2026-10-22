import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { forgetSettings } from './data/settingsMemory';
import { forgetTrainingLock } from './data/trainingLockMemory';

afterEach(() => {
  cleanup();
  localStorage.clear();
  forgetSettings(); // the game switches are remembered for 5 minutes; each test starts fresh
  forgetTrainingLock(); // so is Training before games, for a minute
});
