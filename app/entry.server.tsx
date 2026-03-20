import type { AppLoadContext, EntryContext } from 'react-router';
import { ServerRouter } from 'react-router';
import { isbot } from 'isbot';
import { renderToReadableStream } from 'react-dom/server';
import { initializeApp } from './load-context';

export const streamTimeout = 5000;

function getThemeFromRequest(request: Request): string {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/(?:^|; )theme=([^;]*)/);
  return match?.[1] === 'dark' ? 'dark' : 'light';
}

const THEME_SCRIPT = `<script>(function(){var t=document.documentElement.getAttribute("data-theme")||"light";var el=document.documentElement;if(t!=="light"){var o=new MutationObserver(function(ms){ms.forEach(function(m){if(m.attributeName==="data-theme"&&el.getAttribute("data-theme")!==t){el.setAttribute("data-theme",t);o.disconnect()}})});o.observe(el,{attributes:true,attributeFilter:["data-theme"]})}})()</script>`;

function createThemeTransform(theme: string): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let headProcessed = false;
  let buffer = '';

  return new TransformStream({
    transform(chunk, controller) {
      if (headProcessed) {
        controller.enqueue(chunk);
        return;
      }

      buffer += decoder.decode(chunk, { stream: true });
      const headEndIdx = buffer.indexOf('</head>');

      if (headEndIdx !== -1) {
        headProcessed = true;
        if (theme === 'dark') {
          buffer = buffer.replace('data-theme="light"', `data-theme="${theme}"`);
        }
        buffer = buffer.replace('</head>', THEME_SCRIPT + '</head>');
        controller.enqueue(encoder.encode(buffer));
        buffer = '';
      }
    },
    flush(controller) {
      if (buffer) {
        controller.enqueue(encoder.encode(buffer));
      }
    },
  });
}

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext,
  loadContext: AppLoadContext,
) {
  // Initialize all server modules (env resolved from globalThis or loadContext)
  initializeApp((loadContext as any).cloudflare?.env);
  const body = await renderToReadableStream(
    <ServerRouter context={remixContext} url={request.url} />,
    {
      signal: AbortSignal.timeout(streamTimeout),
      onError(error: unknown) {
        console.error(error);
        responseStatusCode = 500;
      },
    },
  );

  if (isbot(request.headers.get('user-agent') || '')) {
    await body.allReady;
  }

  responseHeaders.set('Content-Type', 'text/html');

  const theme = getThemeFromRequest(request);
  const transformedBody = body.pipeThrough(createThemeTransform(theme));

  return new Response(transformedBody, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
