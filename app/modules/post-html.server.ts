import sanitizeHtml from 'sanitize-html';

/** Keep article formatting while excluding active content and unsafe URLs. */
export function sanitizePostHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'del', 'img'],
    allowedAttributes: {
      a: ['href', 'title'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
      ol: ['start'],
      th: ['colspan', 'rowspan', 'scope', 'align'],
      td: ['colspan', 'rowspan', 'align'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https'] },
    allowProtocolRelative: false,
    parseStyleAttributes: false,
  });
}
