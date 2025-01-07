import googleIcon from "~/components/icons/google_icon.svg";

export default function GoogleLoginButton() {
  return (
    <form action="/api/googleLogin" method="post">
      <button 
        type="submit"
        className="flex items-center justify-start bg-base-200 rounded-md p-2 border border-gray-300 gap-x-10 hover:bg-base-300 w-full"
      >
        <img src={googleIcon} alt="GoogleIcon" className="w-10 h-10 mx-4" />
        <span className="md:mx-6">Googleで認証する</span>
        </button>
    </form>
  )
}
