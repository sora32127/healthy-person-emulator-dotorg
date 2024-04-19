import { ActionFunctionArgs, MetaFunction, json, redirect } from "@remix-run/node";
import { Form, Link, useActionData } from "@remix-run/react";
import { commitSession, getSession } from "~/modules/session.server";
import { supabase } from "~/modules/supabase.server";
import { getVisitorCookieData } from "~/modules/visitor.server";
import { useState } from "react";
import { H1 } from "~/components/Headings";

export async function action({ request }: ActionFunctionArgs) {
    const form = await request.formData();
    const email = form.get('email')?.toString();
    const password = form.get('password')?.toString();

    if (!email || !password) {
        return json({ status: 400, message: 'メールアドレスもしくはパスワードは必須です'});
    }

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        return json({ status: 500, message: "メールアドレス、もしくはパスワードが違います" });
    }

    const { user } = data;

    if (user) {
        const session = await getSession(request.headers.get('Cookie'));
        session.set('userId', user.id);
        const { redirectUrl } = await getVisitorCookieData(request);

        return redirect(redirectUrl || "/", {
            headers: {
                'Set-Cookie': await commitSession(session),
            }
        });
    }
}

export default function Login() {
    const actionData = useActionData<typeof action>();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    return (
        <div className="flex justify-center items-center h-screen">
            <div className="w-full max-w-md">
                <Form method="post" className="rounded px-8 pt-6 pb-8 mb-4">
                    <H1>ログイン</H1>
                    <p>記事の編集にはログインが必要です</p>
                    <div className="my-4">
                        <label htmlFor="email" className="block text-base-content text-sm font-bold mb-2">
                            メールアドレス:
                        </label>
                        <input
                            id="email"
                            name="email"
                            type="text"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="shadow appearance-none border rounded w-full py-2 px-3 leading-tight focus:outline-none focus:shadow-outline"
                        />
                    </div>
                    <div className="mb-6">
                        <label htmlFor="password" className="block text-base-content text-sm font-bold mb-2">
                            パスワード:
                        </label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="shadow appearance-none border rounded w-full py-2 px-3 leading-tight focus:outline-none focus:shadow-outline"
                        />
                    </div>
                    {actionData?.status === 400 && (
                        <p className="text-error-content text-xs italic mb-4">{actionData.message}</p>
                    )}
                    {actionData?.status === 500 && (
                        <p className="text-error-content text-xs italic mb-4">{actionData.message}</p>
                    )}
                    <div className="flex justify-between items-start">
                        <button
                        type="submit"
                        disabled={!email || !password}
                        className="bg-primary font-bold py-2 px-2 rounded focus:outline-none focus:shadow-outline disabled:opacity-50 text-white"
                        >
                        ログイン
                        </button>
                        <div className="flex flex-col items-end">
                            <Link
                                to="/signup"
                                className="inline-block align-baseline font-bold text-sm text-info underline underline-offset-4 my-2"
                            >
                                ユーザー登録はこちら
                            </Link>
                            <Link
                                to="/forgotPassword"
                                className="inline-block align-baseline font-bold text-sm text-info underline underline-offset-4"
                            >
                                パスワードを忘れた方はこちら
                            </Link>
                        </div>
                    </div>
                </Form>
            </div>
        </div>
    );
}


export const meta : MetaFunction = () => {
    return [
        { title: 'ログイン'}
    ]
}