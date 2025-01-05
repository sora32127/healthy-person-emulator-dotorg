import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticator } from "~/modules/auth.server";

export async function action({ request }: ActionFunctionArgs) {
    try {
          const result = await authenticator.authenticate("email-login", request);
          return {
              success: true,
              data: result,
          }
      } catch (error) {
          console.log(error);
          return {
              message: (error as Error).message,
              success: false,
          }
      }
}