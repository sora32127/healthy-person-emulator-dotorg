import { redirect } from "@remix-run/cloudflare";

export async function loader() {
   throw redirect('/signupVerified');
}