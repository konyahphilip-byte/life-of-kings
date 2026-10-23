import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
// Default worker parallelism reproduced five-second failures on the shared host.
// Keep isolation and test deadlines; bound worker resource contention instead.
export default defineConfig({plugins:[react()],test:{environment:'jsdom',maxWorkers:1,exclude:[...configDefaults.exclude,'work/**']}});
