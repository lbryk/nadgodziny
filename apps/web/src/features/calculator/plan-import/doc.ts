import * as CFB from 'cfb';

/**
 * Text of a legacy Word 97–2003 (.doc) file.
 *
 * The document text lives in the "WordDocument" stream, cut into pieces that the piece table in
 * the "0Table"/"1Table" stream describes (MS-DOC 2.4.1). Each piece is either 8-bit CP1252 or
 * UTF-16LE. In Word's text, \x07 ends a table cell (and, doubled, a row), \r ends a paragraph.
 */
export interface DocText {
  text: string;
  /** Table rows (cells separated by \x07 in the source); empty when the file has no table. */
  rows: string[][];
}

/** Control characters Word uses inside its text stream. */
const CELL_MARK = String.fromCharCode(7);
const VT = String.fromCharCode(11); // soft line break

const toBytes = (content: unknown): Uint8Array | undefined =>
  content ? Uint8Array.from(content as ArrayLike<number>) : undefined;

const u16 = (b: Uint8Array, o: number) => b[o]! | (b[o + 1]! << 8);
const u32 = (b: Uint8Array, o: number) =>
  (b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16) | (b[o + 3]! << 24)) >>> 0;

const cellText = (part: string) => part.replace(/\r/g, '\n').replaceAll(VT, '\n').trim();

/**
 * Rebuilds table rows from the pieces between \x07 marks.
 *
 * A cell ends with \x07 and the end-of-row mark is one more \x07 — so an *empty cell* and the end
 * of a row look the same in the text (telling them apart needs the paragraph properties). Timetables
 * are rectangular, so the column count is the N for which every (N+1)-th piece is the empty row mark.
 */
export function splitTableRows(parts: string[]): string[][] {
  let bestN = 0;
  let bestCoverage = 0;
  for (let n = 1; n <= 16; n += 1) {
    let k = 0;
    while ((k + 1) * (n + 1) <= parts.length && parts[(k + 1) * (n + 1) - 1] === '') k += 1;
    if (k >= 2 && k * (n + 1) > bestCoverage) {
      bestCoverage = k * (n + 1);
      bestN = n;
    }
  }

  if (bestN === 0 || bestCoverage < parts.length * 0.6) {
    // irregular table (merged cells …): fall back to "an empty piece ends the row"
    const rows: string[][] = [];
    let current: string[] = [];
    for (const part of parts) {
      if (part === '' && current.length > 0) {
        rows.push(current);
        current = [];
      } else {
        current.push(part);
      }
    }
    if (current.some(Boolean)) rows.push(current);
    return rows;
  }

  const rows: string[][] = [];
  for (let i = 0; i + bestN < parts.length + 1 && i + bestN <= bestCoverage - 1; i += bestN + 1) {
    rows.push(parts.slice(i, i + bestN));
  }
  const tail = parts.slice(bestCoverage).filter(Boolean);
  if (tail.length) rows.push(tail);
  return rows;
}

export function extractDocText(data: Uint8Array): DocText {
  let container: CFB.CFB$Container;
  try {
    container = CFB.read(data, { type: 'array' });
  } catch {
    throw new Error(
      'Nie udało się otworzyć pliku DOC. Zapisz go w programie Word jako DOCX lub PDF.',
    );
  }
  const wordDoc = toBytes(CFB.find(container, 'WordDocument')?.content);
  if (!wordDoc || u16(wordDoc, 0) !== 0xa5ec) {
    throw new Error('To nie wygląda na dokument Word 97–2003. Zapisz plik jako DOCX lub PDF.');
  }

  const flags = u16(wordDoc, 0x0a);
  if (flags & 0x0100)
    throw new Error('Dokument DOC jest zaszyfrowany — zapisz go bez hasła jako DOCX lub PDF.');
  const tableName = flags & 0x0200 ? '1Table' : '0Table';
  const table = toBytes(CFB.find(container, tableName)?.content);
  if (!table) throw new Error('Uszkodzony dokument DOC (brak tablicy fragmentów).');

  // FibBase (32) + csw + fibRgW + cslw + fibRgLw + cbRgFcLcb → FibRgFcLcb97
  const csw = u16(wordDoc, 32);
  const rgLwStart = 32 + 2 + csw * 2 + 2;
  const ccpText = u32(wordDoc, rgLwStart + 3 * 4);
  const cslw = u16(wordDoc, 32 + 2 + csw * 2);
  const fcLcbStart = rgLwStart + cslw * 4 + 2;
  const fcClx = u32(wordDoc, fcLcbStart + 33 * 8);
  const lcbClx = u32(wordDoc, fcLcbStart + 33 * 8 + 4);

  // Clx = (Prc)* Pcdt
  let pos = fcClx;
  const end = fcClx + lcbClx;
  while (pos < end && table[pos] === 0x01) pos += 3 + u16(table, pos + 1);
  if (table[pos] !== 0x02)
    throw new Error('Nieobsługiwany układ dokumentu DOC. Zapisz go jako DOCX lub PDF.');
  const plcLength = u32(table, pos + 1);
  const plc = pos + 5;
  const pieces = (plcLength - 4) / 12;

  const ansi = new TextDecoder('windows-1252');
  const utf16 = new TextDecoder('utf-16le');
  let text = '';
  for (let i = 0; i < pieces; i += 1) {
    const cpStart = u32(table, plc + i * 4);
    const cpEnd = u32(table, plc + (i + 1) * 4);
    const pcd = plc + (pieces + 1) * 4 + i * 8;
    const fcRaw = u32(table, pcd + 2);
    const compressed = (fcRaw & 0x40000000) !== 0;
    const length = Math.max(0, Math.min(cpEnd, ccpText) - cpStart);
    if (length === 0) continue;
    if (compressed) {
      const offset = (fcRaw & 0x3fffffff) >>> 1;
      text += ansi.decode(wordDoc.subarray(offset, offset + length));
    } else {
      const offset = fcRaw & 0x3fffffff;
      text += utf16.decode(wordDoc.subarray(offset, offset + length * 2));
    }
  }

  const rows = text.includes(CELL_MARK) ? splitTableRows(text.split(CELL_MARK).map(cellText)) : [];
  return { text: text.replaceAll(CELL_MARK, ' ').replace(/\r/g, '\n'), rows };
}
