import { routes } from "@remix-run/dev/server-build";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { generateSitemap } from "@nasa-gcn/remix-seo";

export function loader({ request }: LoaderFunctionArgs) {
  return generateSitemap(request, routes, {
    siteUrl: "https://healthy-person-emulator.org",
    headers: {
        "Cache-Control": `public, max-age=${60 * 60}`,
    }
  });
}
