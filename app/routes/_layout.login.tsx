import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { commonMetaFunction } from "~/utils/commonMetafunction";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { H1 } from "~/components/Headings";
import toast, { Toaster } from "react-hot-toast";
import GoogleLoginButton from "~/components/GoogleLoginButton";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const searchParams = url.searchParams
  const refferer = searchParams.get("refferer")
  return { refferer }
}

export default function login() {
  const { refferer } = useLoaderData<typeof loader>();
  const isRedirectedFromEditPost = refferer === "fromEditPost";

  const googleLoginFetcher = useFetcher();
  const handleGoogleLogin = () => {
    googleLoginFetcher.submit(null, {
      method: "post",
      action: "/api/googleLogin",
    });
  }

    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card w-full max-w-sm">
          <Toaster />
          {isRedirectedFromEditPost &&
          <div className="card-body bg-error">
            <p className="text-error-content">編集するにはログインする必要があります</p>
          </div>}
          <div className="card-body">
            <H1>ユーザー認証</H1>
            <GoogleLoginButton onClick={handleGoogleLogin}/>
          </div>
        </div>
      </div>
    );
}

  
export const meta : MetaFunction = () => {
    const commonMeta = commonMetaFunction({
        title: "ユーザー認証",
        description: "ユーザー認証して編集しよう",
        url: "https://healthy-person-emulator.org/login",
        image: null
    });
    return commonMeta;
}