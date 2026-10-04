import { XMLParser } from 'fast-xml-parser';
import { unzipSync, strFromU8 } from 'fflate';

type XmlNode = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: true,
  preserveOrder: true,
  trimValues: false,
  parseTagValue: false,
});

const children = (node: XmlNode, tag: string): XmlNode[] =>
  Array.isArray(node[tag]) ? (node[tag] as XmlNode[]) : [];

/** Text of everything below a node (runs, tabs, line breaks). */
function textOf(nodes: XmlNode[]): string {
  let out = '';
  for (const n of nodes) {
    if ('#text' in n) out += String(n['#text']);
    else if ('w:tab' in n) out += ' ';
    else if ('w:br' in n || 'w:cr' in n) out += '\n';
    else {
      for (const [key, value] of Object.entries(n)) {
        if (Array.isArray(value)) {
          const inner = textOf(value as XmlNode[]);
          out += inner;
          if (key === 'w:p') out += '\n';
        }
      }
    }
  }
  return out;
}

const paragraphText = (p: XmlNode): string => textOf(children(p, 'w:p')).replace(/\n+$/, '');

export interface DocxContent {
  /** Every table as rows of cell texts (lines inside a cell are separated by \n). */
  grids: string[][][];
  /** Paragraphs outside tables — titles such as "Plan lekcji — poniedziałek". */
  paragraphs: string[];
}

/** Reads paragraphs and tables of a .docx straight from its XML — no DOM, works in Node and the browser. */
export function extractDocxGrids(data: Uint8Array): DocxContent {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(data, { filter: (f) => f.name === 'word/document.xml' });
  } catch {
    throw new Error('Nie udało się otworzyć pliku DOCX — czy na pewno jest to dokument Word?');
  }
  const xml = files['word/document.xml'];
  if (!xml) throw new Error('W pliku DOCX nie znaleziono treści dokumentu.');

  const tree = parser.parse(strFromU8(xml)) as XmlNode[];
  const document = tree.find((n) => 'w:document' in n);
  const body = document
    ? children(children(document, 'w:document').find((n) => 'w:body' in n) ?? {}, 'w:body')
    : [];

  const grids: string[][][] = [];
  const paragraphs: string[] = [];
  for (const node of body) {
    if ('w:p' in node) {
      const text = paragraphText(node).trim();
      if (text) paragraphs.push(text);
    } else if ('w:tbl' in node) {
      const rows: string[][] = [];
      for (const tr of children(node, 'w:tbl').filter((n) => 'w:tr' in n)) {
        const cells = children(tr, 'w:tr')
          .filter((n) => 'w:tc' in n)
          .map((tc) =>
            children(tc, 'w:tc')
              .filter((n) => 'w:p' in n)
              .map((p) => paragraphText(p).trim())
              .filter(Boolean)
              .join('\n'),
          );
        if (cells.length) rows.push(cells);
      }
      if (rows.length) grids.push(rows);
    }
  }
  return { grids, paragraphs };
}
