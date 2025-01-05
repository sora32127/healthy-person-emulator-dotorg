import { Authenticator } from "remix-auth";
import { FormStrategy } from "remix-auth-form";
import { sessionStorage } from "./session.server";

export type LoginFormData = {
    email: string;
    password: string;
};

export const authenticator = new Authenticator<LoginFormData>();

authenticator.use(
    new FormStrategy(async ({ form }) => {
        const email = form.get("email") as string;
        const password = form.get("password") as string;
        const userId = await loginByEmail(email, password);
        return { email, password, userId };
    }), "email-login"
);

export async function loginByEmail(email: string, password: string): Promise<number> {
    return 1;
}
