import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { startAwayLog } from './data/pageAway';
import { startQuestionLog } from './data/questionLog';
import { startFreshLoad } from './freshLoad';
import './styles.css';

startFreshLoad();
startQuestionLog();
startAwayLog();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
