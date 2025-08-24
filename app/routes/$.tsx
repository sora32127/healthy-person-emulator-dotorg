import type { LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
    const url = new URL(request.url);
    
    // Chrome DevTools関連のパスは404を返す
    if (url.pathname.includes('.well-known') || 
        url.pathname.includes('devtools') ||
        url.pathname.includes('favicon.ico')) {
        throw new Response("Not Found", { status: 404 });
    }
    
    // その他の未定義パスも404
    throw new Response("Not Found", { status: 404 });
}