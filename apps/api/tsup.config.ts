import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    server: 'src/server.ts',
    worker: 'src/worker.ts',
    'commands/migrate': 'src/commands/migrate.ts',
    'commands/seed': 'src/commands/seed.ts',
  },
  format: ['esm'],
  target: 'node22',
  sourcemap: true,
  clean: true,
  splitting: false,
});
