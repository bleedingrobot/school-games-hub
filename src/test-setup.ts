import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup, configure } from '@testing-library/react';
import { forgetSettings } from './data/settingsMemory';
import { forgetTrainingLock } from './data/trainingLockMemory';
import { resetSkips, setSkipMode } from './maths/questionLog';
import { clearShortCache } from './teacher/shortCache';

// findBy and waitFor give up after 1 second by default. On a busy machine a screen that loads its code on first use
// (a lazy page) can take longer than that, which was the most common false failure in the PR checks. 5 seconds.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  cleanup();
  localStorage.clear();
  forgetSettings(); // the game switches are remembered for 5 minutes; each test starts fresh
  forgetTrainingLock(); // so is Training before games, for a minute
  setSkipMode('on'); // the class's skip switch (a test may change it)
  resetSkips();
  clearShortCache(); // Today shares a class report between its parts for a few seconds
});
