import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
// Only the Latin subsets: Turkish needs latin-ext (ğ, ş, ı); devanagari is never used.
import '@fontsource/baloo-2/latin-600.css';
import '@fontsource/baloo-2/latin-ext-600.css';
import '@fontsource/baloo-2/latin-800.css';
import '@fontsource/baloo-2/latin-ext-800.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(<App />);
