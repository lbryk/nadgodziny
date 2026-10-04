/**
 * In-browser OCR for photos and screenshots of a school calendar. Everything runs locally:
 * the worker, WASM core and the Polish model are self-hosted (see vite.config.ts).
 */

const STATUS_PL: Record<string, string> = {
  'loading tesseract core': 'Ładowanie silnika OCR…',
  'initializing tesseract': 'Uruchamianie silnika OCR…',
  'loading language traineddata': 'Ładowanie modelu języka polskiego…',
  'initializing api': 'Przygotowanie rozpoznawania…',
  'recognizing text': 'Rozpoznawanie tekstu…',
};

/** Upscales small screenshots and stretches the contrast — both help Tesseract a lot. */
export async function preprocessImage(file: Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(3, Math.max(1, 1800 / bitmap.width));
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
    const hist = new Uint32Array(256);
    for (let i = 0; i < px.length; i += 4) {
      const g = Math.round(0.299 * px[i]! + 0.587 * px[i + 1]! + 0.114 * px[i + 2]!);
      px[i] = px[i + 1] = px[i + 2] = g;
      hist[g] = (hist[g] ?? 0) + 1;
    }
    const total = canvas.width * canvas.height;
    let acc = 0;
    let lo = 0;
    let hi = 255;
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
    const range = Math.max(1, hi - lo);
    // dark-on-light is what Tesseract expects: invert dark-theme screenshots
    let mean = 0;
    for (let v = 0; v < 256; v += 1) mean += v * hist[v]!;
    const invert = mean / total < 110;
    for (let i = 0; i < px.length; i += 4) {
      let v = Math.min(255, Math.max(0, ((px[i]! - lo) * 255) / range));
      if (invert) v = 255 - v;
      px[i] = px[i + 1] = px[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
    return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b ?? file), 'image/png'));
  } catch {
    return file;
  }
}

export async function recognizeImage(
  file: Blob,
  onProgress: (progress: number, status: string) => void,
): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const base = `${window.location.origin}/tesseract`;
  const worker = await createWorker('pol', 1, {
    workerPath: `${base}/worker.min.js`,
    corePath: base,
    langPath: `${base}/lang`,
    gzip: true,
    logger: (m: { status: string; progress: number }) => onProgress(m.progress, STATUS_PL[m.status] ?? m.status),
  });
  try {
    const prepared = await preprocessImage(file);
    const { data } = await worker.recognize(prepared);
    return data.text;
  } finally {
    await worker.terminate();
  }
}
