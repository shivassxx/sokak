import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// dev only: the admin panel calls /api/admin on its own origin (cookie session), Vite forwards it
const serverPort = process.env.SOKAK_SERVER_PORT ?? '2567';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true, proxy: { '/api/admin': { target: `http://127.0.0.1:${serverPort}`, xfwd: true } } },
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
});
