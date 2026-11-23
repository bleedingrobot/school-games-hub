import { lazy } from 'react';
import { saveCircuitEnabled, saveCircuitMaths } from '../../data/circuit';
import type { GameDefinition } from '../types';
import { CIRCUIT_ABOUT, CIRCUIT_MATHS_ABOUT, useCircuitCells, useCircuitClassSwitch, useCircuitMaths } from './teacher';

// Loaded only when someone opens the game, so the dashboard stays quick (three.js loads later still, when a race opens).
const CircuitStudentPanel = lazy(() => import('../../pages/TeacherCircuit').then((m) => ({ default: m.CircuitStudentPanel })));
const CircuitPlay = lazy(() => import('./CircuitPlay').then((m) => ({ default: m.CircuitPlay })));

/** A glowing road running to a port, with a spark on it. */
function CircuitIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#060b1f" />
      <path d="M14 58 L26 18 H38 L50 58 Z" fill="#0b3b2c" stroke="#22d3ee" strokeWidth="2" />
      <path d="M32 56 V22" stroke="#d8b24a" strokeWidth="2" strokeDasharray="4 4" />
      <rect x="22" y="8" width="20" height="10" rx="2" fill="none" stroke="#4ade80" strokeWidth="2.5" />
      <circle cx="32" cy="46" r="4.5" fill="#67e8f9" />
      <circle cx="32" cy="46" r="8" fill="#67e8f9" opacity="0.3" />
    </svg>
  );
}

/**
 * Circuit Racer (docs/CIRCUIT-PLAN.md; id circuit): race a spark along neon circuit-board roads. The `circuit` server
 * function hands out each go and replays every finish. On the dashboard only while `circuitOn()` (./switch.ts) is true
 * and the teacher has the game on for the pupil's class (on for every class by default).
 */
export const circuitRacer: GameDefinition = {
  id: 'circuit',
  name: 'Circuit Racer',
  tagline: 'Race a spark along glowing circuit-board roads',
  colours: ['#0e7490', '#4c1d95'],
  Icon: CircuitIcon,
  Play: CircuitPlay,
  ranked: false,
  noBots: true,
  group: 'complex-maths',
  teacherSwitch: true,
  teacher: {
    switch: { useValue: useCircuitClassSwitch, save: saveCircuitEnabled, about: CIRCUIT_ABOUT },
    maths: { useValue: useCircuitMaths, save: (mode, classId) => saveCircuitMaths(mode, classId), about: CIRCUIT_MATHS_ABOUT },
    progressColumns: { note: 'roads finished', useCells: useCircuitCells },
    StudentPanel: CircuitStudentPanel,
  },
};
