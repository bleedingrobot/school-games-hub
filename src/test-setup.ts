import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { forgetSettings } from './data/settingsMemory';

afterEach(() => {
  cleanup();
  localStorage.clear();
  forgetSettings(); // the game switches are remembered for 5 minutes; each test starts fresh
});
