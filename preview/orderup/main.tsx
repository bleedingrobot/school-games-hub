/**
 * The Order Up! preview: the whole activity with no sign-in. The rules are the shared ones, run by the trial backend in this
 * page's memory (a reload starts again, with every level's worked example).
 * Run it: npx vite --config vite.orderup-preview.config.ts
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { OrderUpGame } from '../../src/games/orderup/OrderUpGame';
import { trialBackend } from '../../src/games/orderup/backend';
import type { HelpSetting } from '../../shared/orderup/server';
import '../../src/styles.css';

const asked = new URLSearchParams(location.search).get('help');
const help: HelpSetting = asked === 'always' || asked === 'hints' ? asked : 'fade';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: 16 }}>
      <OrderUpGame backend={trialBackend({ help })} />
    </main>
  </StrictMode>,
);
