import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const apiPort = process.env.API_PORT || '8787';
export default defineConfig({ plugins: [react()], server: { proxy: { '/api/v1': `http://127.0.0.1:${apiPort}` } }, build: { cssCodeSplit: true, sourcemap: false } });
