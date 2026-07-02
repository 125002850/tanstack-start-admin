import { Matches, RouterContextProvider } from '@tanstack/react-router';
import { createRoot } from 'react-dom/client';
import { RouterProgressBar } from './lib/router/progress';
import { createRouter } from './router';

const router = createRouter();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root element');
const root = createRoot(rootEl);
root.render(
  <RouterContextProvider router={router}>
    <RouterProgressBar />
    <Matches />
  </RouterContextProvider>
);
