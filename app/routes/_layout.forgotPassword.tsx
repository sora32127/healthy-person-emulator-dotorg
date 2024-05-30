import { ActionFunctionArgs, json, } from "@remix-run/node";
import { Form, Link, MetaFunction, useActionData } from "@remix-run/react";
import { supabase } from "~/modules/supabase.server";
import { useState } from "react";
import { H1 } from "~/components/Headings";

export async function action({ request }: ActionFunctionArgs) {
    const form = await request.formData();
    const email = form.get('email')?.toString();

    if (!email) {
        return json({ status: 400, message: 'メールアドレスは必須です'});
    }

    const url = new URL(request.url);
    const origin = url.origin;

    const { data, error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/api/auth/callback`});


    if (error) {
        return json({ status: 500, message: "パスワードリセットリクエストの送信に失敗しました" });
    }

    if (data){
        return json({ status: 200, message: "パスワードリセットリクエストを受け付けました。メールボックスを確認してください。" })
    }

    return json({ status: 500, message: "パスワードリセットリクエストの送信に失敗しました" });
}

export default function ForgotPassword() {
    const actionData = useActionData<typeof action>();
    const [email, setEmail] = useState('');

    return (
        <div className="flex justify-center items-center h-screen">
            <div className="w-full max-w-md">
                <Form method="post" className="rounded px-8 pt-6 pb-8 mb-4">
                    <H1>パスワードをリセットする</H1>
                    <div className="mb-4">
                        <label htmlFor="email" className="block text-sm font-bold mb-2">
                            メールアドレス:
                        </label>
                        <input
                            id="email"
                            name="email"
                            type="text"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="shadow appearance-none border rounded w-full py-2 px-3 leading-tight focus:outline-none focus:shadow-outline"
                            autoComplete="email"
                        />
                    </div>
                    {actionData?.status === 200 && (
                        <p className="text-success text-xs italic mb-4">{actionData.message}</p>
                    )}
                    {actionData?.status === 400 && (
                        <p className="text-error text-xs italic mb-4">{actionData.message}</p>
                    )}
                    {actionData?.status === 500 && (
                        <p className="text-error text-xs italic mb-4">{actionData.message}</p>
                    )}
                    <div className="flex justify-between items-center">
                        <button
                            type="submit"
                            disabled={!email}
                            className="bg-primary text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
                        >
                            リセットリクエストを送信
                        </button>
                        <Link
                            to="/login"
                            className="inline-block align-baseline font-bold text-sm text-info underline underline-offset-4"
                        >
                            ログインはこちら
                        </Link>
                    </div>
                </Form>
            </div>
        </div>
    );
}


export const meta: MetaFunction = () => {
    const title = "パスワードリセットを忘れた";
    return [{title}]
};