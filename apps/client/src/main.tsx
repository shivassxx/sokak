import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import '@fontsource/baloo-2/600.css';
import '@fontsource/baloo-2/800.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(<App />);
