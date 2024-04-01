import { ActionFunctionArgs, redirect } from "@remix-run/node";
import { Form, Link } from "@remix-run/react";
import { commitSession, getSession } from "~/modules/session.server";
import { supabase } from "~/modules/supabase.server";
import { getVisitorCookieData } from "~/modules/visitor.server";

export async function action({ request }: ActionFunctionArgs) {
    const form = await request.formData();
    const email = form.get('email')?.toString();
    const password = form.get('password')?.toString();

    if (!email || !password) {
        return {
            status: 400,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                error: 'Email and password are required'
            })
        }
    }

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        console.log(error)
    }

    const { user } = data;

    if ( user ) { 
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
    return (
      <div className="remix__page">
        <main>
          <h1>ログイン</h1>
          <Form method="post">
            <div className="form_item">
              <label htmlFor="email">メールアドレス:</label>
              <input id="email" name="email" type="text" />
            </div>
            <div className="form_item">
              <label htmlFor="password">パスワード:</label>
              <input id="password" name="password" type="password" />
            </div>
            <div>
              <button type="submit">ログイン</button>
              <div>
              <Link to="/signup">
                ユーザー登録はこちら
              </Link>
              </div>
            </div>
          </Form>
        </main>
      </div>
    );
  }