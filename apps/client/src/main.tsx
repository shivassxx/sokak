import { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
// Only the Latin subsets: Turkish needs latin-ext (ğ, ş, ı); devanagari is never used.
import '@fontsource/baloo-2/latin-600.css';
import '@fontsource/baloo-2/latin-ext-600.css';
import '@fontsource/baloo-2/latin-800.css';
import '@fontsource/baloo-2/latin-ext-800.css';
import './styles.css';

// staff panel: its own lazy chunk, never part of the lobby download
const AdminPanel = lazy(() => import('./ui/admin/AdminPanel').then((m) => ({ default: m.AdminPanel })));
const isAdmin = /^\/admin\/?$/.test(location.pathname);

createRoot(document.getElementById('root')!).render(
  isAdmin ? (
    <Suspense fallback={<div className="loading">Yükleniyor…</div>}>
      <AdminPanel />
    </Suspense>
  ) : (
    <App />
  ),
);
