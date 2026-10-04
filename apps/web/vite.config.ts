import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const require = createRequire(import.meta.url);

/**
 * OCR and PDF reading run fully in the browser (files never leave the device). The tesseract.js worker, WASM
 * cores and the Polish language model are self-hosted so the feature works offline and under the
 * strict CSP — they are served in dev and emitted into the production bundle.
 */
function tesseractAssets(): Plugin {
  const pkgDir = (name: string) => path.dirname(require.resolve(`${name}/package.json`));
  const files = () => {
    const core = pkgDir('tesseract.js-core');
    const js = pkgDir('tesseract.js');
    const pol = pkgDir('@tesseract.js-data/pol');
    return {
      'tesseract/worker.min.js': path.join(js, 'dist/worker.min.js'),
      'tesseract/tesseract-core-lstm.wasm.js': path.join(core, 'tesseract-core-lstm.wasm.js'),
      'tesseract/tesseract-core-simd-lstm.wasm.js': path.join(
        core,
        'tesseract-core-simd-lstm.wasm.js',
      ),
      'tesseract/tesseract-core-relaxedsimd-lstm.wasm.js': path.join(
        core,
        'tesseract-core-relaxedsimd-lstm.wasm.js',
      ),
      'tesseract/lang/pol.traineddata.gz': path.join(pol, '4.0.0_best_int/pol.traineddata.gz'),
      // pdf.js worker (reading PDF lesson plans) — served as is, never transformed by the dev server
      'pdfjs/pdf.worker.min.mjs': path.join(
        pkgDir('pdfjs-dist'),
        'legacy/build/pdf.worker.min.mjs',
      ),
    } as Record<string, string>;
  };
  return {
    name: 'tesseract-assets',
    configureServer(server) {
      const map = files();
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0]!.replace(/^\//, '');
        const file = map[url];
        if (!file || !existsSync(file)) return next();
        res.setHeader('Content-Type', /\.m?js$/.test(url) ? 'text/javascript' : 'application/gzip');
        res.end(readFileSync(file));
      });
    },
    generateBundle() {
      for (const [fileName, source] of Object.entries(files())) {
        this.emitFile({ type: 'asset', fileName, source: readFileSync(source) });
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
  // 'ftp' build: relative URLs so the folder can be uploaded anywhere (domain root or a sub-folder)
  base: mode === 'ftp' ? './' : '/',
  plugins: [react(), tailwindcss(), tesseractAssets()],
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: false } },
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
}));
