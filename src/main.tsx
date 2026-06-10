import { RouterProvider } from '@tanstack/react-router';
import { createRoot } from 'react-dom/client';
import { createRouter } from './router';

const router = createRouter();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root element');
const root = createRoot(rootEl);
root.render(<RouterProvider router={router} />);
