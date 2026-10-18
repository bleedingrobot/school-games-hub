/**
 * Is Basic facts training on in the hub? The switch James flips at "go live" (needs the training
 * database migration and the `training` server function deployed first, see docs/TRAINING-PLAN.md).
 * While it is false there is no Training link, no dashboard card and no /training page.
 *
 * To try it on your own computer without changing this file, put VITE_TRAINING_ON=true in .env.local.
 */
const TRAINING_ON = false;

export const trainingOn = (): boolean => TRAINING_ON || import.meta.env.VITE_TRAINING_ON === 'true';
