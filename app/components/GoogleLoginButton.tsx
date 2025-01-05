import googleIcon from "~/components/icons/google_icon.svg";

export default function GoogleLoginButton({ onClick }: { onClick: () => void }) {
  return (
    <button
        type="button"
        onClick={onClick}
        className="flex items-center justify-start bg-base-200 rounded-md p-2 border border-gray-300 gap-x-10 hover:bg-base-300"
    >
      <img src={googleIcon} alt="GoogleIcon" className="w-10 h-10" />
      Googleでログイン/登録
    </button>
  )
}
