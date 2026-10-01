import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const apiPort = process.env.API_PORT || '8787';
export default defineConfig({ plugins: [react()], server: { proxy: { '/api/v1': `http://127.0.0.1:${apiPort}` } }, build: { cssCodeSplit: true, sourcemap: false, rolldownOptions: { output: { codeSplitting: { groups: [{ name: 'three-core', test: /node_modules[\\/]three[\\/]/, maxSize: 340000, priority: 20 }, { name: 'fiber-runtime', test: /node_modules[\\/]@react-three[\\/]fiber[\\/]/, maxSize: 340000, priority: 15 }] } } } } });
