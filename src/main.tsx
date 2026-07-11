import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';
import './styles/global.css';

const rootElement = document.querySelector('#root');
if (rootElement === null) {
  throw new Error('Unable to find the Root & Ritual application mount point.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
