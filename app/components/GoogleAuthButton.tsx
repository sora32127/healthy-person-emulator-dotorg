import { useEffect, useRef, useState } from 'react';
import googleIcon from '~/components/icons/google_icon.svg';
import { useGoogleIdentity } from './GoogleIdentity';

export default function GoogleLoginButton() {
  const { api, nonce, pending, error } = useGoogleIdentity();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [buttonReady, setButtonReady] = useState(false);

  useEffect(() => {
    const element = buttonRef.current;
    const parent = element?.parentElement;
    if (!api || !element || !parent) return;
    let renderedWidth: number | undefined;
    const renderButton = () => {
      // Google's iframe adds 10px of space on either side of the button.
      const width = Math.min(Math.max(parent.clientWidth - 20, 0), 400);
      if (width === renderedWidth) return;
      renderedWidth = width;
      element.replaceChildren();
      try {
        api.renderButton(element, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          locale: 'ja',
          width,
        });
        setButtonReady(true);
      } catch {
        setButtonReady(false);
      }
    };
    renderButton();
    const observer = new ResizeObserver(renderButton);
    observer.observe(parent);
    return () => {
      observer.disconnect();
      element.replaceChildren();
    };
  }, [api, nonce]);

  return (
    <div className="space-y-4" aria-busy={pending}>
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
      {pending ? (
        <p role="status" className="text-center text-sm">ログインしています…</p>
      ) : null}
      <div ref={buttonRef} className={pending ? 'hidden' : 'flex justify-center min-w-0'} />
      <form action="/api/googleLogin" method="post">
        <button
          type="submit"
          disabled={pending}
          className={buttonReady && !error
            ? 'text-sm underline underline-offset-4 text-base-content/70 block mx-auto disabled:opacity-50'
            : 'flex items-center justify-center bg-base-100 rounded-md px-4 py-3 border border-base-300 gap-3 hover:bg-base-200 w-full disabled:opacity-50'}
        >
          {(!buttonReady || error) && <img src={googleIcon} alt="" className="w-5 h-5" />}
          <span>{buttonReady && !error ? 'Googleのログイン画面を開く' : 'Googleでログイン'}</span>
        </button>
      </form>
    </div>
  );
}
