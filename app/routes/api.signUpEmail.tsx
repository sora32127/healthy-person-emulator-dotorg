import type { ActionFunctionArgs } from "@remix-run/node";
import { createUserByEmail } from "~/modules/auth.server";

export async function action({ request }: ActionFunctionArgs) {
    try {
      const formData = await request.formData();
      const email = formData.get("email") as string;
      const password = formData.get("password") as string;
      const result = await createUserByEmail(email, password);
      return {
        success: result.success,
        data: result.data,
      }
    } catch (error) {
      console.log(error);
      return {
        message: (error as Error).message,
        success: false,
      }
    }
}
