import { defineConfig } from 'vite';

// Сборка бота-решателя для Node: `npm run solve` собирает tools/solve.ts в build/solve/solve.mjs и запускает его.
// Vite нужен, потому что ядро — TypeScript, а таблицы и уровни подключаются через ?raw (src/data.ts).
export default defineConfig({
  logLevel: 'warn',
  build: {
    ssr: 'tools/solve.ts',
    outDir: 'build/solve',
    emptyOutDir: true,
    target: 'node22',
    rollupOptions: { output: { entryFileNames: 'solve.mjs' } },
  },
});
