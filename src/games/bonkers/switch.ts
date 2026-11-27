/**
 * Is Bonkers Quest in the hub for pupils? Off until stage B.5 (docs/BONKERS-PLAN.md): James is testing the gameplay first
 * (27 Nov 2026), so only teachers can open `/#/bonkers` (src/games/bonkers/TeacherGate.tsx). `VITE_BONKERS_ON=true` in
 * .env.local shows the card on your own computer. Even when on, the card hides until the teacher has the game on for the class.
 */
const BONKERS_ON = false;

export const bonkersOn = (): boolean => BONKERS_ON || import.meta.env.VITE_BONKERS_ON === 'true';
