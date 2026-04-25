import { describe, it, expect } from 'vitest';

import {
  PROGRAM_TEST_PATTERN,
  escapeXml,
  generateSVG,
  parseTable,
  prepareLines,
  rowWeight,
} from '~/modules/ogp.server';

const SAMPLE_HTML = `<table>
<tbody>
<tr><td>Who(誰が)</td><td>筆者が</td></tr>
<tr><td>When(いつ)</td><td>中学生のとき</td></tr>
<tr><td>Where(どこで)</td><td>学校で</td></tr>
<tr><td>Why(なぜ)</td><td>優等生であろうとして</td></tr>
<tr><td>What(何を)</td><td>忙しめの部活と生徒会役員を</td></tr>
<tr><td>How(どのように)</td><td>掛け持ちし、専ら生徒会ばかりに顔を出していた</td></tr>
<tr><td>Then(どうなった)</td><td>部活の先輩から呼び出されてこれでもかというくらいに叱られた</td></tr>
</tbody>
</table>`;

describe('parseTable', () => {
  it('extracts 7 key/value pairs from a 5W1H+Then table', () => {
    const table = parseTable(SAMPLE_HTML);
    expect(Object.keys(table)).toHaveLength(7);
    expect(table['Who(誰が)']).toBe('筆者が');
    expect(table['Then(どうなった)']).toBe(
      '部活の先輩から呼び出されてこれでもかというくらいに叱られた',
    );
  });

  it('decodes HTML entities and strips inner tags', () => {
    const html = '<table><tr><td>Title</td><td>A &amp; B &lt;c&gt; <b>bold</b></td></tr></table>';
    const table = parseTable(html);
    expect(table.Title).toBe('A & B <c> bold');
  });

  it('returns an empty object when no table rows are present', () => {
    expect(parseTable('<p>no table here</p>')).toEqual({});
  });
});

describe('escapeXml', () => {
  it('escapes &, <, >, ", and \'', () => {
    expect(escapeXml(`<a href="x">It's & that</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;It&apos;s &amp; that&lt;/a&gt;',
    );
  });
});

describe('prepareLines', () => {
  it('returns a single line when input fits', () => {
    expect(prepareLines('短い文', 1)).toEqual(['短い文']);
  });

  it('truncates with an ellipsis when exceeding maxLines * CHARS_PER_LINE', () => {
    const lines = prepareLines('a'.repeat(70), 2);
    expect(lines.length).toBeLessThanOrEqual(2);
    expect(lines[lines.length - 1].endsWith('…')).toBe(true);
  });

  it('normalises whitespace including newlines', () => {
    expect(prepareLines('a\n\n\tb   c', 1)).toEqual(['a b c']);
  });

  it('returns an empty array for empty input', () => {
    expect(prepareLines('', 2)).toEqual([]);
  });
});

describe('rowWeight', () => {
  it('returns 2 for Why and Then keys', () => {
    expect(rowWeight('Why(なぜ)')).toBe(2);
    expect(rowWeight('Then(どうなった)')).toBe(2);
    expect(rowWeight('Then(どうした)')).toBe(2);
  });

  it('returns 1 for the other 5W1H keys', () => {
    expect(rowWeight('Who(誰が)')).toBe(1);
    expect(rowWeight('How(どのように)')).toBe(1);
  });
});

describe('generateSVG', () => {
  const svg = generateSVG(parseTable(SAMPLE_HTML));

  it('emits exactly one vertical separator at x=270', () => {
    const matches = svg.match(/<line[^/]*x1="270"[^/]*x2="270"/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it('emits N-1 horizontal separators for N rows', () => {
    const horizontal = svg.match(/<line[^/]*x1="20"/g) ?? [];
    expect(horizontal).toHaveLength(6);
  });

  it('emits a <text> element for each key with text-anchor=end', () => {
    const keyTexts = svg.match(/text-anchor="end"/g) ?? [];
    expect(keyTexts).toHaveLength(7);
  });

  it('renders within a 1200x630 viewBox', () => {
    expect(svg).toContain('viewBox="0 0 1200 630"');
  });
});

describe('PROGRAM_TEST_PATTERN', () => {
  it('matches titles containing プログラムテスト', () => {
    expect(PROGRAM_TEST_PATTERN.test('プログラムテスト用記事')).toBe(true);
    expect(PROGRAM_TEST_PATTERN.test('これはプログラムテストです')).toBe(true);
  });

  it('does not match unrelated titles', () => {
    expect(PROGRAM_TEST_PATTERN.test('健常者エミュレータ事例集')).toBe(false);
  });
});
