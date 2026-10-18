import { defineConfig } from 'tsup';
export default defineConfig({
  entry: ['src/server.ts', 'src/auth.ts'], format: ['esm'], target: 'node18',
  clean: true, sourcemap: true, external: ['ai-codeguard'],
});
