/**
 * Is Smash Quest in the hub for pupils? On since stage B.5 (29 Nov 2026 NZ; docs/BONKERS-PLAN.md). Before that only
 * teachers could open `/#/bonkers` (src/games/bonkers/TeacherGate.tsx) while James tested it. Even when on, the card hides
 * until the teacher has the game on for the class (the Games tab switch, on by default).
 */
const BONKERS_ON = true;

export const bonkersOn = (): boolean => BONKERS_ON || import.meta.env.VITE_BONKERS_ON === 'true';
