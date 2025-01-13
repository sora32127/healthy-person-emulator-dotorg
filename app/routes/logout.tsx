import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticator } from "~/modules/auth.google.server";
import { destroyVisitorCookie } from "~/modules/visitor.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const headers = await destroyVisitorCookie(request);
  return authenticator.logout(request, {
    redirectTo: '/',
    headers: headers,
  });
}
