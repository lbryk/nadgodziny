import {
  blocksFromGrid,
  blocksFromText,
  blocksFromWords,
  detectWeekdayInText,
  mergeBlocks,
  type DayBlock,
  type PositionedWord,
} from '@nadgodziny/core';
import { recognizeWords, type OcrProgress } from '../../../lib/ocr';
import { assetUrl } from '../../../lib/paths';
import { extractDocText } from './doc';
import { extractDocxGrids } from './docx';

export type PlanSourceKind = 'image' | 'pdf' | 'docx' | 'doc' | 'text';

export interface PlanExtraction {
  kind: PlanSourceKind;
  sourceName: string;
  blocks: DayBlock[];
}

export function sourceKindOf(file: { name: string; type: string }): PlanSourceKind | null {
  const name = file.name.toLowerCase();
  if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp|gif|tiff?)$/.test(name))
    return 'image';
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (name.endsWith('.docx')) return 'docx';
  if (name.endsWith('.doc')) return 'doc';
  if (file.type.startsWith('text/') || /\.(txt|csv|tsv|md)$/.test(name)) return 'text';
  return null;
}

async function fromImage(blob: Blob, onProgress: OcrProgress): Promise<DayBlock[]> {
  const { words } = await recognizeWords(blob, onProgress);
  return blocksFromWords(words);
}

async function fromPdf(file: File, onProgress: OcrProgress): Promise<DayBlock[]> {
  // the legacy build carries polyfills, so it also runs on the older browsers found on school PCs
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = assetUrl('pdfjs/pdf.worker.min.mjs');

  onProgress(0.05, 'Czytanie pliku PDF…');
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const pdf = await task.promise;
  const blocks: DayBlock[] = [];
  const pages = Math.min(pdf.numPages, 12);

  for (let i = 1; i <= pages; i += 1) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const words: PositionedWord[] = [];
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const [, , , , x, y] = item.transform as number[];
      const h = item.height || 10;
      words.push({
        text: item.str.trim(),
        x0: x!,
        x1: x! + item.width,
        y0: viewport.height - y! - h,
        y1: viewport.height - y!,
      });
    }

    if (words.length >= 5) {
      blocks.push(...blocksFromWords(words));
    } else {
      // no text layer: a scanned plan — render the page and read it like a photo
      const scale = 2.2;
      const canvas = document.createElement('canvas');
      const vp = page.getViewport({ scale });
      canvas.width = Math.round(vp.width);
      canvas.height = Math.round(vp.height);
      await page.render({ canvas, viewport: vp }).promise;
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (blob) {
        blocks.push(
          ...(await fromImage(blob, (p, s) =>
            onProgress((i - 1 + p) / pages, `Strona ${i}/${pages}: ${s}`),
          )),
        );
      }
    }
    onProgress(i / pages, `Strona ${i}/${pages}`);
  }
  await task.destroy();
  return mergeBlocks(blocks);
}

function withTitleDay(blocks: DayBlock[], paragraphs: string[]): DayBlock[] {
  const hint = detectWeekdayInText(paragraphs.join(' '));
  return blocks.map((b) => (b.weekday === null && hint !== null ? { ...b, weekday: hint } : b));
}

async function fromDocx(file: File): Promise<DayBlock[]> {
  const { grids, paragraphs } = extractDocxGrids(new Uint8Array(await file.arrayBuffer()));
  if (grids.length === 0) return blocksFromText(paragraphs.join('\n'));
  return withTitleDay(mergeBlocks(grids.flatMap(blocksFromGrid)), paragraphs);
}

async function fromDoc(file: File): Promise<DayBlock[]> {
  const { rows, text } = extractDocText(new Uint8Array(await file.arrayBuffer()));
  if (rows.length === 0) return blocksFromText(text);
  return withTitleDay(mergeBlocks(blocksFromGrid(rows)), text.split(/\r?\n/));
}

/** Reads a photo / screenshot, PDF or Word file and proposes lessons per weekday. */
export async function extractPlan(file: File, onProgress: OcrProgress): Promise<PlanExtraction> {
  const kind = sourceKindOf(file);
  if (!kind)
    throw new Error('Obsługiwane są: zdjęcia (PNG, JPG), PDF, Word (DOCX, DOC) i pliki tekstowe.');
  if (file.size > 25 * 1024 * 1024) throw new Error('Plik jest za duży (maks. 25 MB).');

  let blocks: DayBlock[];
  switch (kind) {
    case 'image':
      blocks = await fromImage(file, onProgress);
      break;
    case 'pdf':
      blocks = await fromPdf(file, onProgress);
      break;
    case 'docx':
      onProgress(0.3, 'Czytanie dokumentu Word…');
      blocks = await fromDocx(file);
      break;
    case 'doc':
      onProgress(0.3, 'Czytanie dokumentu Word 97–2003…');
      blocks = await fromDoc(file);
      break;
    default:
      blocks = blocksFromText(await file.text());
  }
  onProgress(1, 'Gotowe');
  return { kind, sourceName: file.name, blocks };
}
