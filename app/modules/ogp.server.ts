/**
 * OGP image generation — direct SVG output rasterised by resvg-wasm.
 * Ported from container/tasks/create_og_image.py (Pillow-based).
 *
 * The vertical separator is a single <line> element with fixed x — geometry
 * is determined by construction, not by a layout engine, so all rows align.
 */

import { initWasm, Resvg } from '@resvg/resvg-wasm';

let wasmReady: Promise<void> | null = null;

/** Initialise the resvg WASM module (idempotent). Call once before generateOgpPng. */
export function ensureResvgWasm(wasmModule: WebAssembly.Module): Promise<void> {
  if (!wasmReady) wasmReady = initWasm(wasmModule);
  return wasmReady;
}

const IMAGE_W = 1200;
const IMAGE_H = 630;
const KEY_COL_W = 270;
const FONT_SIZE = 30;
const W_MARGIN = 20;
const H_MARGIN = 20;
const CONTENT_COL_W = IMAGE_W - KEY_COL_W;
const AVAILABLE_H = IMAGE_H - 2 * H_MARGIN;
const CHARS_PER_LINE = Math.floor((CONTENT_COL_W - W_MARGIN * 2) / FONT_SIZE) - 1;
const LINE_HEIGHT_RATIO = 1.3;
const BG = '#f5f5f5';
const BORDER = '#000';
const FONT_FAMILY = 'NotoSansJP';

/** Posts whose title matches this pattern are skipped (test posts from QA). */
export const PROGRAM_TEST_PATTERN = /^.*プログラムテスト.*$/;

export function rowWeight(key: string): number {
  return /^(Why|Then)\(/.test(key) ? 2 : 1;
}

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const ENTITY_MAP: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => ENTITY_MAP[name] ?? m);
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '');
}

/**
 * Extract key/value pairs from the first <table> in the post HTML.
 * Mirrors the BeautifulSoup logic in create_og_image.py: pairs of <td> cells
 * (key, value) inside <tr> rows.
 */
export function parseTable(html: string): Record<string, string> {
  const trs = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  const out: Record<string, string> = {};
  for (const [, inner] of trs) {
    const tds = [...inner.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)];
    if (tds.length >= 2) {
      const key = decodeEntities(stripTags(tds[0][1])).trim();
      const val = decodeEntities(stripTags(tds[1][1])).trim();
      if (key) out[key] = val;
    }
  }
  return out;
}

/**
 * Normalise whitespace and split into N-character lines.
 * Adds an ellipsis to the final line when the input would exceed maxLines.
 */
export function prepareLines(text: string, maxLines: number): string[] {
  const normalized = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const chars = [...normalized];
  const max = CHARS_PER_LINE * maxLines;
  let body: string[];
  if (chars.length <= max) {
    body = chars;
  } else {
    body = chars.slice(0, max - 1);
    body.push('…');
  }
  const lines: string[] = [];
  for (let i = 0; i < body.length; i += CHARS_PER_LINE) {
    lines.push(body.slice(i, i + CHARS_PER_LINE).join(''));
  }
  return lines;
}

export function generateSVG(table: Record<string, string>): string {
  const entries = Object.entries(table);
  const totalWeight = entries.reduce((acc, [k]) => acc + rowWeight(k), 0);
  const unitH = totalWeight === 0 ? 0 : AVAILABLE_H / totalWeight;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${IMAGE_W}" height="${IMAGE_H}" viewBox="0 0 ${IMAGE_W} ${IMAGE_H}">`,
  );
  parts.push(`<rect width="${IMAGE_W}" height="${IMAGE_H}" fill="${BG}"/>`);
  parts.push(
    `<line x1="${KEY_COL_W}" y1="${H_MARGIN}" x2="${KEY_COL_W}" y2="${IMAGE_H - H_MARGIN}" stroke="${BORDER}" stroke-width="1"/>`,
  );

  let y = H_MARGIN;
  for (let i = 0; i < entries.length - 1; i++) {
    y += unitH * rowWeight(entries[i][0]);
    parts.push(
      `<line x1="${W_MARGIN}" y1="${y}" x2="${IMAGE_W - W_MARGIN}" y2="${y}" stroke="${BORDER}" stroke-width="1"/>`,
    );
  }

  y = H_MARGIN;
  for (const [key, content] of entries) {
    const weight = rowWeight(key);
    const isDouble = weight === 2;
    const rowH = unitH * weight;
    const rowCenterY = y + rowH / 2;

    const keyX = KEY_COL_W - W_MARGIN;
    parts.push(
      `<text x="${keyX}" y="${rowCenterY}" font-family="${FONT_FAMILY}" font-size="${FONT_SIZE}" fill="#000" text-anchor="end" dominant-baseline="central">${escapeXml(key)}</text>`,
    );

    const contentX = KEY_COL_W + W_MARGIN;
    const lines = prepareLines(content, isDouble ? 2 : 1);
    if (lines.length === 1) {
      parts.push(
        `<text x="${contentX}" y="${rowCenterY}" font-family="${FONT_FAMILY}" font-size="${FONT_SIZE}" fill="#000" dominant-baseline="central">${escapeXml(lines[0])}</text>`,
      );
    } else if (lines.length === 2) {
      const lh = FONT_SIZE * LINE_HEIGHT_RATIO;
      parts.push(
        `<text x="${contentX}" y="${rowCenterY - lh / 2}" font-family="${FONT_FAMILY}" font-size="${FONT_SIZE}" fill="#000" dominant-baseline="central">${escapeXml(lines[0])}</text>`,
        `<text x="${contentX}" y="${rowCenterY + lh / 2}" font-family="${FONT_FAMILY}" font-size="${FONT_SIZE}" fill="#000" dominant-baseline="central">${escapeXml(lines[1])}</text>`,
      );
    }

    y += rowH;
  }

  parts.push('</svg>');
  return parts.join('');
}

/**
 * Render the OGP image as PNG bytes. ensureResvgWasm() must have been awaited
 * before calling this.
 */
export function generateOgpPng(args: {
  table: Record<string, string>;
  fontBytes: Uint8Array;
}): Uint8Array {
  const svg = generateSVG(args.table);
  return new Resvg(svg, {
    fitTo: { mode: 'width', value: IMAGE_W },
    font: {
      fontBuffers: [args.fontBytes],
      loadSystemFonts: false,
      defaultFontFamily: FONT_FAMILY,
    },
  })
    .render()
    .asPng();
}
