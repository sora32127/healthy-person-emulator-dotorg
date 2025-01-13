import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticator } from "../modules/auth.google.server";

export async function action({ request }: ActionFunctionArgs) {
    
    return await authenticator.authenticate("google", request);
}