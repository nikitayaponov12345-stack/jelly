import { defineConfig } from 'vite';

// Сборка разбора уровней для Node: `npm run analyze` собирает tools/analyze.ts в build/analyze/analyze.mjs и запускает
// его — как tools/solve.config.ts у бота-решателя.
export default defineConfig({
  logLevel: 'warn',
  build: {
    ssr: 'tools/analyze.ts',
    outDir: 'build/analyze',
    emptyOutDir: true,
    target: 'node22',
    rollupOptions: { output: { entryFileNames: 'analyze.mjs' } },
  },
});
