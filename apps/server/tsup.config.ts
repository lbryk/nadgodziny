import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  clean: true,
  sourcemap: true,
  // The domain package ships TypeScript sources, so it is bundled into the server build.
  noExternal: [/^@nadgodziny\//],
});
