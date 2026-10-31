/**
 * A stand-alone copy of Clan Quest's screens, for trying them without signing in. Nothing is saved.
 * Build: npm run clans:preview. Or run it: npx vite --config vite.clans-preview.config.ts
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClanQuest } from '../../src/games/clans';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClanQuest typedNames />
  </StrictMode>,
);
