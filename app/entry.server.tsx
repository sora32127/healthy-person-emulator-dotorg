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

const THEME_SCRIPT = `<script>(function(){var t=document.documentElement.getAttribute("data-theme")||"light";var el=document.documentElement;if(t!=="light"){window.__themeObserver=new MutationObserver(function(ms){ms.forEach(function(m){if(m.attributeName==="data-theme"&&el.getAttribute("data-theme")!==t){el.setAttribute("data-theme",t)}})});window.__themeObserver.observe(el,{attributes:true,attributeFilter:["data-theme"]})}})()</script>`;

function injectTheme(html: string, theme: string): string {
  if (theme === 'dark') {
    html = html.replace('data-theme="light"', 'data-theme="dark"');
  }
  html = html.replace('</head>', THEME_SCRIPT + '</head>');
  return html;
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
  if (theme === 'light') {
    return new Response(body, {
      headers: responseHeaders,
      status: responseStatusCode,
    });
  }

  // ダークテーマの場合のみ HTML を変換する
  await body.allReady;
  const html = await new Response(body).text();
  return new Response(injectTheme(html, theme), {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
