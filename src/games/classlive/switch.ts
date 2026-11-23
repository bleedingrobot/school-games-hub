/**
 * Class Live's code switch (docs/CLASSLIVE-PLAN.md): while false, no teacher or pupil sees it. The server, tables and join
 * pop-up are live behind it; the test page is the preview (`npx vite --config vite.classlive-preview.config.ts`).
 */
export const CLASSLIVE_ON = true;
export const classliveOn = () => CLASSLIVE_ON;
