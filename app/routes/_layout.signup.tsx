import { ActionFunctionArgs, MetaFunction, json, redirect } from "@remix-run/node";
import { H1 } from "~/components/Headings";
import { supabase } from "~/modules/supabase.server";
import { useActionData, Form } from "@remix-run/react";
import { useState } from "react";
import { prisma } from "~/modules/db.server";

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const email = form.get("email")?.toString();
  const password = form.get("password")?.toString();

  if (!email || !password ) {
    return json({ status: 500, message: "Email, password and username are required" });
  }

  const url = new URL(request.url);
  const origin = url.origin;
  const emailRedirectTo = `${origin}/userVerified`;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo,
  }});

  if (error) {
    return json({ status: 500, message: error.message });
  }

  const userId = data.user?.id;

  if (!userId ){
    return json({ status: 500, message: "ユーザー登録に失敗しました" });
  }

  try {
    await prisma.userProfiles.create({
    data: {
      userId: userId,
      userEmail: email,
    },
  });
  } catch (error) {
    throw new Error(`Failed to create user profile: ${error}`);
  } 

  return redirect("/email");
}

export default function Component() {
  const actionData = useActionData<typeof action>();
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const isDisabled = !email || !password || passwordError !== "";

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPassword = e.target.value;
    setPassword(newPassword);

    if (newPassword.length < 8) {
      setPasswordError("パスワードは8文字以上で設定してください。");
    } else if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setPasswordError("パスワードには英文字と数字を含める必要があります。");
    } else {
      setPasswordError("");
    }
  };

  return (
    <div>
      <Form
        method="post"
        className="max-w-md mx-auto"
        onSubmit={() => setIsRegistering(true)}
      >
        <H1>ユーザー新規登録</H1>
        <div className="mb-4">
          <label htmlFor="email" className="block mb-2 font-bold text-base-content">
            メールアドレス:
          </label>
          <input
            type="email"
            id="email"
            name="email"
            className={`w-full px-3 py-2 text-base-content border rounded-md focus:outline-none ${
              email ? "focus:border-blue-500" : "border-error"
            }`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {!email && (
            <p className="text-error text-sm mt-1">メールアドレスを入力してください。</p>
          )}
        </div>
        <div className="mb-6">
          <label
            htmlFor="password"
            className="block mb-2 font-bold text-base-content"
          >
            パスワード:
          </label>
          <input
            type="password"
            id="password"
            name="password"
            className={`w-full px-3 py-2 text-base-content border rounded-md focus:outline-none ${
              password ? "focus:border-blue-500" : "border-error"
            }`}
            value={password}
            onChange={handlePasswordChange}
            required
          />
          {passwordError && (
            <p className="text-error text-sm mt-1">{passwordError}</p>
          )}
        </div>
        <div className="text-center">
          <button
            type="submit"
            className={`px-4 py-2 font-bold text-white rounded-md focus:outline-none ${
              isDisabled ? "bg-gray-400 cursor-not-allowed" : "bg-primary"
            }`}
            disabled={isDisabled || isRegistering}
          >
            ユーザー新規登録
          </button>
        </div>
      </Form>
      {isRegistering && (
        <div className="fixed top-0 left-0 w-full h-full flex items-center justify-center bg-base-200 bg-opacity-50">
          <div className="bg-base-300 p-8 rounded-md">
            {actionData?.status === 200 ? (
              <div>
                <p className="text-green-500 mb-4">{actionData.message}</p>
                <button
                  className="px-4 py-2 font-bold text-white bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none"
                  onClick={() => window.location.href = "/login"}
                >
                  ログインページへ
                </button>
              </div>
            ) : actionData?.status === 500 ? (
              <div>
                <p className="text-error mb-4">{actionData.message}</p>
                <button
                  className="px-4 py-2 font-bold text-white bg-gray-500 rounded-md hover:bg-gray-600 focus:outline-none"
                  onClick={() => setIsRegistering(false)}
                >
                  戻る
                </button>
              </div>
            ) : (
              <div className="flex items-center mb-4">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                <span>ユーザー登録を実行しています...</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export const meta : MetaFunction = () => {
  return [
      { title: 'サインアップ'}
  ]
}