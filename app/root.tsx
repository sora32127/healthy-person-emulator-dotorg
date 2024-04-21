import {
  Links,
  Meta,
  NavLink,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useRouteError,
} from "@remix-run/react";

import type { LinksFunction } from "@remix-run/node";
import stylesheet from "~/tailwind.css?url";
import { SpeedInsights } from "@vercel/speed-insights/remix"
import { PageTransitionProgressBar } from "./components/PageTransitionProgressBar";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesheet },
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@100..900&family=Ubuntu:ital,wght@0,300;0,400;0,500;0,700;1,300;1,400;1,500;1,700&display=swap',
  },
];


export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta property="og:site_name" content="健常者エミュレータ事例集"></meta>
        <Meta />
        <Links />
      </head>
      <body>
        <PageTransitionProgressBar />
        {children}
        <ScrollRestoration />
        <Scripts />
        <SpeedInsights />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <div className="container mx-auto px-4 text-center">
        <h1 className="text-4xl font-bold mt-32 mb-8">お探しのページは見つかりませんでした</h1>
        <NavLink to="/" className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
          トップページに戻る
        </NavLink>
      </div>
    );
  } else {
    console.error(error);
    return (
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold text-center mt-32 mb-8">不明なエラーが発生しました</h1>
        <pre className="bg-red-100 p-4 mb-8 overflow-auto">{error instanceof Error ? error.stack : JSON.stringify(error, null, 2)}</pre>
        <div className="text-center">
          <NavLink to="/" className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            トップページに戻る
          </NavLink>
        </div>
      </div>
    );
  }
}