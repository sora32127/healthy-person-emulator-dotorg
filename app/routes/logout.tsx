import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticator } from "~/modules/auth.google.server";

export async function loader({ request }: LoaderFunctionArgs) {
  return authenticator.logout(request, {
    redirectTo: '/',
  });
}
