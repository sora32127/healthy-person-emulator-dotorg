import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useSetAtom } from 'jotai';
import { setIsLoginModalOpenAtom } from '~/stores/loginmodal';

type CredentialResponse = { credential: string };

type GoogleAccountsId = {
  initialize: (options: {
    client_id: string;
    nonce: string;
    auto_select: boolean;
    callback: (response: CredentialResponse) => void;
  }) => void;
  prompt: () => void;
  cancel: () => void;
  renderButton: (element: HTMLElement, options: {
    type: 'standard';
    theme: 'outline';
    size: 'large';
    text: 'signin_with';
    locale: 'ja';
    width: number;
  }) => void;
};

export type GoogleIdentityConfig = {
  clientId: string;
  nonce: string;
  autoPrompt: boolean;
  expiresAt?: number;
};

type GoogleIdentityState = {
  api: GoogleAccountsId | null;
  nonce: string | null;
  pending: boolean;
  error: string | null;
};

const GoogleIdentityContext = createContext<GoogleIdentityState>({
  api: null,
  nonce: null,
  pending: false,
  error: null,
});

function getGoogleAccountsId(): GoogleAccountsId | undefined {
  return (window as Window & { google?: { accounts?: { id?: GoogleAccountsId } } }).google?.accounts?.id;
}

let scriptPromise: Promise<GoogleAccountsId> | undefined;

function loadGoogleIdentity(): Promise<GoogleAccountsId> {
  const existing = getGoogleAccountsId();
  if (existing) return Promise.resolve(existing);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      const api = getGoogleAccountsId();
      if (api) resolve(api);
      else reject(new Error('Google sign-in unavailable'));
    };
    script.onerror = () => {
      script.remove();
      scriptPromise = undefined;
      reject(new Error('Google sign-in unavailable'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export function GoogleIdentityProvider({
  config,
  isLoginModalOpen,
  children,
}: {
  config: GoogleIdentityConfig | null;
  isLoginModalOpen: boolean;
  children: ReactNode;
}) {
  const [currentConfig, setCurrentConfig] = useState(config);
  const modalOpen = useRef(isLoginModalOpen);
  modalOpen.current = isLoginModalOpen;
  const prompted = useRef(false);
  const [identity, setIdentity] = useState<{ api: GoogleAccountsId; nonce: string } | null>(null);
  const api = identity?.api ?? null;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const setIsLoginModalOpen = useSetAtom(setIsLoginModalOpenAtom);

  useEffect(() => {
    setCurrentConfig(config);
  }, [config?.clientId, config?.nonce, config?.autoPrompt, config?.expiresAt]);

  useEffect(() => {
    if (!currentConfig?.expiresAt) return;
    let active = true;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      if (submitting.current) {
        timer = setTimeout(refresh, 30_000);
        return;
      }
      try {
        const response = await fetch('/api/googleOneTap', {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Google sign-in unavailable');
        const body = await response.json() as { config?: GoogleIdentityConfig | null };
        const next = body.config;
        if (next !== null && (!next || typeof next.clientId !== 'string' ||
          typeof next.nonce !== 'string' || typeof next.autoPrompt !== 'boolean' ||
          typeof next.expiresAt !== 'number' || next.expiresAt <= Date.now() + 60_000)) {
          throw new Error('Invalid Google sign-in configuration');
        }
        if (active) setCurrentConfig(next);
      } catch {
        if (active) timer = setTimeout(refresh, 30_000);
      }
    };
    timer = setTimeout(refresh, Math.max(0, currentConfig.expiresAt - Date.now() - 60_000));
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [currentConfig?.nonce, currentConfig?.expiresAt]);

  useEffect(() => {
    if (!currentConfig) return;
    let active = true;
    let initializedApi: GoogleAccountsId | undefined;

    void loadGoogleIdentity().then((googleId) => {
      if (!active) return;
      initializedApi = googleId;
      googleId.initialize({
        client_id: currentConfig.clientId,
        nonce: currentConfig.nonce,
        auto_select: true,
        callback: async ({ credential }) => {
          if (!active || submitting.current) return;
          submitting.current = true;
          setPending(true);
          setError(null);
          try {
            const response = await fetch('/api/googleOneTap', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ credential }),
            });
            if (!response.ok) throw new Error('Google sign-in failed');
            const result = await response.json() as { ok?: boolean };
            if (result.ok !== true) throw new Error('Google sign-in failed');
            const destination = new URL(window.location.href);
            destination.searchParams.set('loginSuccess', 'true');
            window.location.replace(destination.href);
          } catch {
            if (!active) return;
            setError('Googleでログインできませんでした。下のボタンからお試しください。');
            setIsLoginModalOpen(true);
            setPending(false);
            submitting.current = false;
          }
        },
      });
      setIdentity({ api: googleId, nonce: currentConfig.nonce });
      if (currentConfig.autoPrompt && !modalOpen.current && !prompted.current) {
        prompted.current = true;
        googleId.prompt();
      }
    }).catch(() => {
      // The regular OAuth button remains available if the library is blocked.
    });

    return () => {
      active = false;
      initializedApi?.cancel();
    };
  }, [currentConfig?.clientId, currentConfig?.nonce, currentConfig?.autoPrompt, setIsLoginModalOpen]);

  useEffect(() => {
    if (isLoginModalOpen) api?.cancel();
  }, [api, isLoginModalOpen]);

  return (
    <GoogleIdentityContext.Provider value={{ api: config && currentConfig ? api : null, nonce: identity?.nonce ?? null, pending, error }}>
      {children}
    </GoogleIdentityContext.Provider>
  );
}

export function useGoogleIdentity() {
  return useContext(GoogleIdentityContext);
}
