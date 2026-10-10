import { describe, expect, it } from 'vitest';
import { sanitizePostHtml } from '~/modules/post-html.server';

describe('sanitizePostHtml', () => {
  it('preserves article tables, Markdown formatting and safe links/images', () => {
    const html =
      '<h3>状況</h3><table><tbody><tr><td>誰が</td><td>筆者</td></tr></tbody></table>' +
      '<p><strong>強調</strong><del>訂正</del><code>&lt;code&gt;</code></p>' +
      '<a href="https://example.test/article" title="資料">資料</a>' +
      '<a href="/archives/1">記事</a><a href="mailto:reader@example.test">メール</a>' +
      '<img src="https://example.test/image.png" alt="図" />';

    expect(sanitizePostHtml(html)).toBe(html);
  });

  it('removes executable elements, event attributes and page-level styling', () => {
    const html =
      '<script>unexpected()</script><style>body{display:none}</style>' +
      '<iframe src="https://example.test"></iframe><object data="/file"></object>' +
      '<p id="content" style="position:fixed" onclick="unexpected()">本文</p>' +
      '<img src="/image.png" onerror="unexpected()">';

    expect(sanitizePostHtml(html)).toBe('<p>本文</p><img src="/image.png" />');
  });

  it.each([
    'javascript:unexpected()',
    'jav&#x61;script:unexpected()',
    'data:text/html,example',
    '//example.test',
  ])('removes a disallowed link URL (%s)', (href) => {
    expect(sanitizePostHtml(`<a href="${href}">link</a>`)).toBe('<a>link</a>');
  });

  it('removes foreign-content attributes and remains safe after repeated sanitization', () => {
    const html =
      '<svg onload="unexpected()"><a xlink:href="javascript:unexpected()">text</a></svg>' +
      '<img src="data:image/svg+xml,example" onload="unexpected()">';
    const clean = sanitizePostHtml(html);

    expect(clean).not.toMatch(/svg|onload|xlink|javascript:|data:/i);
    expect(sanitizePostHtml(clean)).toBe(clean);
  });
});
