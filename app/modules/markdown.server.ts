import { NodeHtmlMarkdown } from 'node-html-markdown';

const converter = new NodeHtmlMarkdown();

export function htmlToMarkdown(html: string): string {
  return converter.translate(html);
}

export function wantsMarkdown(request: Request): boolean {
  const accept = request.headers.get('accept') ?? '';
  return /\btext\/markdown\b/i.test(accept);
}

export function markdownResponse(body: string, cacheMaxAgeSec = 300): Response {
  return new Response(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': `public, max-age=${cacheMaxAgeSec}`,
      Vary: 'Accept',
    },
  });
}
