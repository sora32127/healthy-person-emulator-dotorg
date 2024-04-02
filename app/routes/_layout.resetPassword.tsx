import { ActionFunctionArgs, json, } from "@remix-run/node";
import { Form, NavLink, useActionData } from "@remix-run/react";
import { supabase } from "~/modules/supabase.server";
import { useState } from "react";
import { H1 } from "~/components/Headings";
import { getSession } from "~/modules/session.server";

export async function action({ request }: ActionFunctionArgs) {
    const form = await request.formData();
    const password = form.get('password')?.toString();
    if (!password) {
        return json({ status: 400, message: 'パスワードは必須です' });
    }

    const session = await getSession(request.headers.get("Cookie"));
    const refreshToken = await session.get("refreshToken");
    await supabase.auth.refreshSession({ refresh_token: refreshToken });
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
        return json({ status: 500, message: "パスワードの更新に失敗しました" });
    }

    return json({ status: 200, message: "パスワードを更新しました。ログインしてください。" });
}

export default function ResetPassword() {
    const actionData = useActionData<typeof action>();
    const [password, setPassword] = useState('');

    return (
        <div className="flex justify-center items-center h-screen">
            <div className="w-full max-w-md">
                <Form
                    method="post"
                    className="bg-white rounded px-8 pt-6 pb-8 mb-4"
                    >
                    <H1>新しいパスワードを設定</H1>
                    <div className="mb-4">
                        <label htmlFor="password" className="block text-gray-700 text-sm font-bold mb-2">
                            新しいパスワード:
                        </label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        />
                    </div>
                    {actionData?.status === 200 && (
                        <p className="text-green-500 text-xs italic mb-4">{actionData.message}</p>
                    )}
                    {actionData?.status === 400 && (
                        <p className="text-red-500 text-xs italic mb-4">{actionData.message}</p>
                    )}
                    {actionData?.status === 500 && (
                        <p className="text-red-500 text-xs italic mb-4">{actionData.message}</p>
                    )}
                    <div className="flex justify-center">
                        <button
                            type="submit"
                            disabled={!password}
                            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
                        >
                            パスワードを更新
                        </button>
                    </div>
                </Form>
                <NavLink to="/login" className="block text-center text-blue-500 hover:text-blue-700 mt-4">
                    ログイン画面に戻る
                </NavLink>
            </div>
        </div>
    );
}
