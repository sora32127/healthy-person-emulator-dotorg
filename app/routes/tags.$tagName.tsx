import { redirect } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";

export function loader({ request }: LoaderFunctionArgs) {
    const url = new URL(request.url);
    const tagName = url.pathname.split("/")[2];
    return redirect(`/search2?tags=${tagName}`);
}