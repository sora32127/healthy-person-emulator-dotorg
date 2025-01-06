import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { commonMetaFunction } from "~/utils/commonMetafunction";
import { Form, useFetcher, useLoaderData } from "@remix-run/react";
import { H1 } from "~/components/Headings";
import { useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast, { Toaster } from "react-hot-toast";
import GoogleLoginButton from "~/components/GoogleLoginButton";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
type LoginSchema = z.infer<typeof loginSchema>;

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const searchParams = url.searchParams
  const refferer = searchParams.get("refferer")
  return { refferer }
}

export default function login() {
  const { refferer } = useLoaderData<typeof loader>();
  const isRedirectedFromEditPost = refferer === "fromEditPost";
  const isError = refferer === "error";
  const loginFetcher = useFetcher();
  const { register, handleSubmit, formState: { errors }, getValues } = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
  });
  const handleLogin = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const inputValues = getValues();
    const formData = new FormData();
    formData.append("type", "email-login");
    formData.append("email", inputValues.email);
    formData.append("password", inputValues.password);
    loginFetcher.submit(formData, {
      method: "post",
      action: "/api/loginEmail",
    });
  }

  const createUserFetcher = useFetcher();
  const handleCreateUser = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const inputValues = getValues();
    const formData = new FormData();
    formData.append("type", "email-create-user");
    formData.append("email", inputValues.email);
    formData.append("password", inputValues.password);
    createUserFetcher.submit(formData, {
      method: "post",
      action: "/api/signUpEmail",
    });
  }

  useEffect(() => {
    const response = loginFetcher.data as { success: boolean, message: string };
    if (response?.success === false) {
      toast.error(response.message);
    }
    if (response?.success === true) {
      toast.success("ログインしました");
    }
  }, [loginFetcher.data]);

  useEffect(() => {
    const response = createUserFetcher.data as { success: boolean, message: string };
    if (response?.success === false) {
      toast.error(response.message);
    }
    if (response?.success === true) {
      toast.success("新規登録しました");
    }
  }, [createUserFetcher.data]);

  const googleLoginFetcher = useFetcher();
  const handleGoogleLogin = () => {
    googleLoginFetcher.submit(null, {
      method: "post",
      action: "/api/googleLogin",
    });
  }

    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="card w-full max-w-sm bg-base-100">
          <Toaster />
          {isRedirectedFromEditPost &&
          <div className="card-body bg-error">
            <p className="text-error-content">編集するにはログインする必要があります</p>
          </div>}
          {isError &&
          <div className="card-body bg-error">
            <p className="text-error-content">メールアドレスもしくはパスワードが一致しません</p>
          </div>}
          <div className="card-body">
            <H1>ログイン</H1>
            <GoogleLoginButton onClick={handleGoogleLogin}/>
            <p className="text-center text-sm py-6">もしくは</p>
            <Form method="post" action="/login" className="space-y-4">
              <div className="form-control w-full">
                <label className="label" htmlFor="email">
                  <span className="label-text">メールアドレス</span>
                </label>
                <input 
                  type="email" 
                  id="email"
                  required 
                  className="input input-bordered w-full" 
                  placeholder="something@example.com" 
                  {...register("email")}
                />
              </div>

              <div className="form-control w-full">
                <label className="label" htmlFor="password">
                  <span className="label-text">パスワード</span>
                </label>
                <input
                  type="password"
                  id="password"
                  autoComplete="current-password"
                  required
                  className="input input-bordered w-full"
                  placeholder="パスワードを入力"
                  {...register("password")}
                />
              </div>
              <div className="my-4 py-10">
              <button type="button" className="btn btn-primary w-full" onClick={handleLogin}>
                メールアドレスでログイン
                </button>
                {/* TODO: メールアドレスの新規登録は今後非推奨とする*/}
                <button type="button" className="btn btn-primary w-full mt-6" onClick={handleCreateUser}>
                  メールアドレスで新規登録
                </button>
              </div>
            </Form>
          </div>
        </div>
      </div>
    );
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