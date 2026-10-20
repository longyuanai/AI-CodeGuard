import { defineConfig } from 'tsup';
export default defineConfig({
  entry: ['src/index.ts'], format: ['esm'], target: 'node24',
  clean: true, sourcemap: true, external: ['ai-codeguard'],
});
