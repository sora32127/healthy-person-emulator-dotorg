import { data, type ActionFunctionArgs } from "@remix-run/node";
import { authenticator } from "../modules/auth.email.server";
import { getVisitorCookieData } from "~/modules/visitor.server";

export async function action({ request }: ActionFunctionArgs) {
    const visitorCookieData = await getVisitorCookieData(request);
    const visitorUrl = visitorCookieData?.redirectUrl;
    try {
        return await authenticator.authenticate("email-login", request, {
            successRedirect: visitorUrl ?? "/",
            failureRedirect: "/login?error=true",
            throwOnError: true,
        });
    } catch (e) {
        // https://tech.codeconnect.co.jp/posts/remix-auth-custom-error-response/
        if (e instanceof Response) {
            return e
        }
        if (e instanceof Error) {
            return data({ message: e.message }, { status: 401 })
        }
        return data({ message: '認証に失敗しました' }, { status: 401 })
    }
}

