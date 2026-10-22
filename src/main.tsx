import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { startQuestionLog } from './data/questionLog';
import './styles.css';

startQuestionLog();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
