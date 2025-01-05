import type { ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { SignIn } from "@clerk/remix";
import { commonMetaFunction } from "~/utils/commonMetafunction";
import { Form } from "@remix-run/react";
import { authenticator } from "~/modules/auth.server";
import { H1 } from "~/components/Headings";

export default function login() {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="card w-full max-w-sm bg-base-100">
          <div className="card-body">
            <H1>ログイン</H1>
            <Form method="post" action="/login" className="space-y-4">
              <div className="form-control w-full">
                <label className="label" htmlFor="email">
                  <span className="label-text">メールアドレス</span>
                </label>
                <input 
                  type="email" 
                  name="email"
                  id="email"
                  required 
                  className="input input-bordered w-full" 
                  placeholder="something@example.com" 
                />
              </div>

              <div className="form-control w-full">
                <label className="label" htmlFor="password">
                  <span className="label-text">パスワード</span>
                </label>
                <input
                  type="password"
                  name="password"
                  id="password"
                  autoComplete="current-password"
                  required
                  className="input input-bordered w-full"
                  placeholder="パスワードを入力"
                />
              </div>

              <button type="submit" className="btn btn-primary w-full mt-6">
                メールアドレスでログイン
              </button>
            </Form>
          </div>
        </div>
      </div>
    );
}

export async function action({ request }: ActionFunctionArgs) {
    return await authenticator.authenticate("email-login", request);
}
  
export const meta : MetaFunction = () => {
    const commonMeta = commonMetaFunction({
        title: "ログイン",
        description: "ログインして編集しよう",
        url: "https://healthy-person-emulator.org/login",
        image: null
    });
    return commonMeta;
}