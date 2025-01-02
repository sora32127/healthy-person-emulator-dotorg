import {
  Links,
  Meta,
  NavLink,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useNavigate,
  useRouteError,
} from "@remix-run/react";

import type { LinksFunction, LoaderFunction } from "@remix-run/node";
import stylesheet from "~/tailwind.css?url";
import { rootAuthLoader } from "@clerk/remix/ssr.server";
import { ClerkApp } from "@clerk/remix";
import { jaJP } from "@clerk/localizations"
import { PageTransitionProgressBar } from "./components/PageTransitionProgressBar";
import { useCallback, useEffect } from "react";
import { FaSpinner } from "react-icons/fa";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesheet },
  { 
    rel: "preload",
    href: "/fonts/NotoSansJP-Medium.ttf",
    as: "font",
    type: "font/ttf",
    crossOrigin: "anonymous"
  }
];

export const loader: LoaderFunction = (args) => rootAuthLoader(args);

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className="font-noto-sans">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta property="og:site_name" content="健常者エミュレータ事例集"/>
        <Meta />
        <Links />
      </head>
      <body>
        <script src="/nofrash.js"/>
        <PageTransitionProgressBar />
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function App() {
  return <Outlet />;
}

export default ClerkApp(App, {
  localization: jaJP,
});

export function ErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();

  if (isRouteErrorResponse(error) && error.status === 404) {
    const handleTimeOut = useCallback(() => {
      setTimeout(() => {
        navigate("/");
      }, 3000);
    }, [navigate]);

    useEffect(() => {
      handleTimeOut();
    }, [handleTimeOut]);

    return (
      <div className="container mx-auto px-4 text-center">
        <h1 className="text-4xl font-bold mt-32 mb-8">お探しのページは見つかりませんでした</h1>
        <div>
          <div className="flex items-center justify-center">
            <FaSpinner className="animate-spin text-green-300 mr-2" />
            <p>トップページにリダイレクトしています</p>
          </div>
          <p>自動的に切り替わらない場合、<NavLink to="/" className="text-info underline underline-offset-4">こちら</NavLink>をクリックしてください</p>
        </div>
      </div>
    );
  }

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