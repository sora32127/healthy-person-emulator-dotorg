import { Link } from "lucide-react";
import googleIcon from "~/components/icons/google_icon.svg";

export default function GoogleLoginButton() {
  return (
    <Link
        to="/api/googleLogin"
        className="flex items-center justify-start bg-base-200 rounded-md p-2 border border-gray-300 gap-x-10 hover:bg-base-300"
    >
      <img src={googleIcon} alt="GoogleIcon" className="w-10 h-10" />
      Googleで認証する
    </Link>
  )
}
