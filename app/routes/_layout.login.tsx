import type { ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { SignIn } from "@clerk/remix";
import { commonMetaFunction } from "~/utils/commonMetafunction";
import { Form, useFetcher } from "@remix-run/react";
import { authenticator, createUserByEmail } from "~/modules/auth.server";
import { H1 } from "~/components/Headings";
import { useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast, { Toaster } from "react-hot-toast";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
type LoginSchema = z.infer<typeof loginSchema>;

export default function login() {
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
      action: "/login",
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
      action: "/login",
    });
  }

  useEffect(() => {
    if (loginFetcher.data?.success === false) {
      toast.error(loginFetcher.data.message);
    }
  }, [loginFetcher.data]);

  useEffect(() => {
    if (createUserFetcher.data?.success === false) {
      toast.error(createUserFetcher.data.message);
    }
  }, [createUserFetcher.data]);
  
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="card w-full max-w-sm bg-base-100">
          <Toaster />
          <div className="card-body">
            <H1>ログイン</H1>
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

              <button type="button" className="btn btn-primary w-full mt-6" onClick={handleLogin}>
                メールアドレスでログイン
              </button>
              <button type="button" className="btn btn-primary w-full mt-6" onClick={handleCreateUser}>
                メールアドレスで新規登録
              </button>
            </Form>
          </div>
        </div>
      </div>
    );
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const type = formData.get("type");
  if (type === "email-login") {
    try {
        const result = await authenticator.authenticate("email-login", request);
        return {
            success: true,
            data: result,
        }
    } catch (error) {
        console.log(error);
        return {
            message: (error as Error).message,
            success: false,
        }
    }
  }
  if (type === "email-create-user") {
    try {
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