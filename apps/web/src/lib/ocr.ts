import type { PositionedWord } from '@nadgodziny/core';
import { assetUrl } from './paths';

/**
 * In-browser OCR for photos and screenshots (school calendar, lesson plan). Everything runs
 * locally: the worker, WASM core and the Polish model are self-hosted (see vite.config.ts).
 */

const STATUS_PL: Record<string, string> = {
  'loading tesseract core': 'Ładowanie silnika OCR…',
  'initializing tesseract': 'Uruchamianie silnika OCR…',
  'loading language traineddata': 'Ładowanie modelu języka polskiego…',
  'initializing api': 'Przygotowanie rozpoznawania…',
  'recognizing text': 'Rozpoznawanie tekstu…',
};

/** Otsu's method: the grey level that best separates ink from paper. */
function otsu(hist: Uint32Array, total: number): number {
  let sum = 0;
  for (let t = 0; t < 256; t += 1) sum += t * hist[t]!;
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 128;
  for (let t = 0; t < 256; t += 1) {
    wB += hist[t]!;
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t]!;
    const diff = sumB / wB - (sum - sumB) / wF;
    const between = wB * wF * diff * diff;
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
}

/** Whitens long horizontal/vertical strokes — the borders of a timetable grid confuse Tesseract. */
function eraseGridLines(px: Uint8ClampedArray, width: number, height: number, ink: number): void {
  const minLen = Math.max(40, Math.round(width * 0.03));
  const dark = (x: number, y: number) => px[(y * width + x) * 4]! < ink;
  const clear = (x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < width && yy < height) {
          const i = (yy * width + xx) * 4;
          px[i] = px[i + 1] = px[i + 2] = 255;
        }
      }
    }
  };
  const runs: [number, number, number, number][] = [];
  for (let y = 0; y < height; y += 1) {
    let start = -1;
    for (let x = 0; x <= width; x += 1) {
      const on = x < width && dark(x, y);
      if (on && start < 0) start = x;
      if (!on && start >= 0) {
        if (x - start >= minLen) runs.push([start, y, x - 1, y]);
        start = -1;
      }
    }
  }
  for (let x = 0; x < width; x += 1) {
    let start = -1;
    for (let y = 0; y <= height; y += 1) {
      const on = y < height && dark(x, y);
      if (on && start < 0) start = y;
      if (!on && start >= 0) {
        if (y - start >= minLen) runs.push([x, start, x, y - 1]);
        start = -1;
      }
    }
  }
  for (const [x0, y0, x1, y1] of runs) {
    for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) clear(x, y);
  }
}

/**
 * Prepares a photo / screenshot for Tesseract: upscales small images, converts to grey, evens out
 * contrast, flips dark-theme screenshots and erases table borders. Large pictures keep their size.
 */
export async function preprocessImage(file: Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = bitmap.width >= 1100 ? 1 : Math.min(3, 1500 / bitmap.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return file;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = img.data;
    const total = canvas.width * canvas.height;
    let hist = new Uint32Array(256);
    let mean = 0;
    for (let i = 0; i < px.length; i += 4) {
      const g = Math.round(0.299 * px[i]! + 0.587 * px[i + 1]! + 0.114 * px[i + 2]!);
      px[i] = px[i + 1] = px[i + 2] = g;
      hist[g] = (hist[g] ?? 0) + 1;
      mean += g;
    }
    mean /= total;

    // dark-on-light is what Tesseract expects: invert dark-theme screenshots
    if (mean < 110) {
      const flipped = new Uint32Array(256);
      for (let i = 0; i < px.length; i += 4) {
        const v = 255 - px[i]!;
        px[i] = px[i + 1] = px[i + 2] = v;
        flipped[v] = (flipped[v] ?? 0) + 1;
      }
      hist = flipped;
    }

    // stretch the contrast only when the picture is flat (a photo in poor light)
    let lo = 0;
    let hi = 255;
    let acc = 0;
    for (let v = 0; v < 256; v += 1) {
      acc += hist[v]!;
      if (acc > total * 0.01) {
        lo = v;
        break;
      }
    }
    acc = 0;
    for (let v = 255; v >= 0; v -= 1) {
      acc += hist[v]!;
      if (acc > total * 0.01) {
        hi = v;
        break;
      }
    }
    if (hi - lo < 160 && hi > lo) {
      for (let i = 0; i < px.length; i += 4) {
        const v = Math.min(255, Math.max(0, ((px[i]! - lo) * 255) / (hi - lo)));
        px[i] = px[i + 1] = px[i + 2] = v;
      }
    }

    eraseGridLines(px, canvas.width, canvas.height, Math.min(otsu(hist, total), 140));
    ctx.putImageData(img, 0, 0);
    return await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b ?? file), 'image/png'),
    );
  } catch {
    return file;
  }
}

export interface OcrResult {
  text: string;
  words: PositionedWord[];
}

export type OcrProgress = (progress: number, status: string) => void;

/** Recognises text and returns the words with their positions (needed to split a weekly grid). */
export async function recognizeWords(file: Blob, onProgress: OcrProgress): Promise<OcrResult> {
  const { createWorker } = await import('tesseract.js');
  const base = assetUrl('tesseract').replace(/\/$/, '');
  const worker = await createWorker('pol', 1, {
    workerPath: `${base}/worker.min.js`,
    corePath: base,
    langPath: `${base}/lang`,
    gzip: true,
    logger: (m: { status: string; progress: number }) =>
      onProgress(m.progress, STATUS_PL[m.status] ?? m.status),
  });
  try {
    const prepared = await preprocessImage(file);
    const { data } = await worker.recognize(prepared, {}, { text: true, blocks: true });
    const words: PositionedWord[] = [];
    for (const block of data.blocks ?? []) {
      for (const paragraph of block.paragraphs) {
        for (const line of paragraph.lines) {
          for (const w of line.words) {
            if (w.text.trim()) words.push({ text: w.text.trim(), ...w.bbox });
          }
        }
      }
    }
    return { text: data.text, words };
  } finally {
    await worker.terminate();
  }
}

export async function recognizeImage(file: Blob, onProgress: OcrProgress): Promise<string> {
  return (await recognizeWords(file, onProgress)).text;
}
