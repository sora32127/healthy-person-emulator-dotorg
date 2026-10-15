import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { createStore, Provider } from 'jotai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GoogleLoginButton from './GoogleAuthButton';
import { GoogleIdentityProvider, type GoogleIdentityConfig } from './GoogleIdentity';
import { getIsLoginModalOpenAtom } from '~/stores/loginmodal';

type CredentialCallback = (response: { credential: string }) => void | Promise<void>;

const config: GoogleIdentityConfig = {
  clientId: 'test-client.apps.googleusercontent.com',
  nonce: 'test-nonce',
  autoPrompt: true,
  autoSelect: true,
};

function mockGoogle() {
  let callback: CredentialCallback | undefined;
  let initializedNonce: string | undefined;
  const api = {
    initialize: vi.fn((options: { callback: CredentialCallback; nonce: string }) => {
      callback = options.callback;
      initializedNonce = options.nonce;
    }),
    prompt: vi.fn(),
    cancel: vi.fn(),
    renderButton: vi.fn((element: HTMLElement) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Google公式ログイン';
      button.dataset.nonce = initializedNonce;
      element.appendChild(button);
    }),
  };
  vi.stubGlobal('google', { accounts: { id: api } });
  return {
    api,
    credential: (value = 'mock-google-credential') => {
      if (!callback) throw new Error('Google has not initialized');
      return callback({ credential: value });
    },
  };
}

function loginView({
  identityConfig = config,
  isLoginModalOpen = false,
  store = createStore(),
}: {
  identityConfig?: GoogleIdentityConfig | null;
  isLoginModalOpen?: boolean;
  store?: ReturnType<typeof createStore>;
} = {}) {
  return (
    <Provider store={store}>
      <GoogleIdentityProvider config={identityConfig} isLoginModalOpen={isLoginModalOpen}>
        <GoogleLoginButton />
      </GoogleIdentityProvider>
    </Provider>
  );
}

describe('GoogleIdentityProvider', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.history.replaceState({}, '', '/');
  });

  it('設定がない利用者には外部スクリプトを読み込まず従来のログインを残す', () => {
    const appendScript = vi.spyOn(document.head, 'appendChild');

    render(loginView({ identityConfig: null }));

    expect(appendScript).not.toHaveBeenCalled();
    const fallback = screen.getByRole('button', { name: 'Googleでログイン' });
    expect(fallback.closest('form')).toHaveAttribute('action', '/api/googleLogin');
    expect(fallback.closest('form')).toHaveAttribute('method', 'post');
    expect(fallback).toBeEnabled();
  });

  it('自動表示が無効なら公式ボタンだけを初期化する', async () => {
    const google = mockGoogle();

    render(loginView({ identityConfig: { ...config, autoPrompt: false } }));

    await screen.findByRole('button', { name: 'Google公式ログイン' });
    expect(google.api.initialize).toHaveBeenCalledWith(expect.objectContaining({
      client_id: config.clientId,
      nonce: config.nonce,
      auto_select: true,
      callback: expect.any(Function),
    }));
    expect(google.api.prompt).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Googleのログイン画面を開く' })).toBeEnabled();
  });

  it('ログアウト後もアカウント候補を表示し、操作なしの自動選択だけを無効にする', async () => {
    const google = mockGoogle();

    render(loginView({ identityConfig: { ...config, autoSelect: false } }));

    await waitFor(() => expect(google.api.prompt).toHaveBeenCalledOnce());
    expect(google.api.initialize).toHaveBeenCalledWith(expect.objectContaining({
      auto_select: false,
    }));
  });

  it('親幅の変化に合わせて公式ボタンを描画し、同じ幅では描画せず監視を解除する', async () => {
    const google = mockGoogle();
    let availableWidth = 500;
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => availableWidth);
    let onResize!: ResizeObserverCallback;
    const observer = { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() };
    vi.stubGlobal('ResizeObserver', vi.fn(function (callback: ResizeObserverCallback) {
      onResize = callback;
      return observer;
    }));
    const view = render(loginView());
    const previousButton = await screen.findByRole('button', { name: 'Google公式ログイン' });
    const buttonContainer = previousButton.parentElement!;

    expect(observer.observe).toHaveBeenCalledWith(buttonContainer.parentElement);
    expect(google.api.renderButton).toHaveBeenLastCalledWith(buttonContainer, expect.objectContaining({ width: 400 }));

    availableWidth = 280;
    act(() => { onResize([], observer as unknown as ResizeObserver); });

    expect(google.api.renderButton).toHaveBeenCalledTimes(2);
    expect(google.api.renderButton).toHaveBeenLastCalledWith(buttonContainer, expect.objectContaining({ width: 260 }));
    expect(previousButton).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Google公式ログイン' })).toHaveLength(1);

    act(() => { onResize([], observer as unknown as ResizeObserver); });
    expect(google.api.renderButton).toHaveBeenCalledTimes(2);

    availableWidth = 500;
    act(() => { onResize([], observer as unknown as ResizeObserver); });
    expect(google.api.renderButton).toHaveBeenCalledTimes(3);
    expect(google.api.renderButton).toHaveBeenLastCalledWith(buttonContainer, expect.objectContaining({ width: 400 }));

    view.unmount();
    expect(observer.disconnect).toHaveBeenCalledOnce();
    expect(buttonContainer).toBeEmptyDOMElement();
  });

  it('自動表示が有効ならOne Tapを表示し、ログイン画面を開くと閉じる', async () => {
    const google = mockGoogle();
    const store = createStore();
    const view = render(loginView({ store }));

    await waitFor(() => expect(google.api.prompt).toHaveBeenCalledOnce());
    expect(google.api.cancel).not.toHaveBeenCalled();

    view.rerender(loginView({ store, isLoginModalOpen: true }));

    await waitFor(() => expect(google.api.cancel).toHaveBeenCalledOnce());
    expect(google.api.initialize).toHaveBeenCalledOnce();
  });

  it('Googleの読み込みが失敗してもOAuthログインを使える', async () => {
    let googleScript: HTMLScriptElement | undefined;
    const appendChild = document.head.appendChild.bind(document.head);
    vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
      if (node instanceof HTMLScriptElement && node.src === 'https://accounts.google.com/gsi/client') {
        googleScript = node;
        return node;
      }
      return appendChild(node);
    });

    render(loginView());
    expect(googleScript).toBeDefined();
    await act(async () => {
      googleScript?.dispatchEvent(new Event('error'));
    });

    expect(screen.getByRole('button', { name: 'Googleでログイン' })).toBeEnabled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('Googleの読み込み中にログイン画面を開いた場合もOne Tapを自動表示しない', async () => {
    let googleScript: HTMLScriptElement | undefined;
    const appendChild = document.head.appendChild.bind(document.head);
    vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
      if (node instanceof HTMLScriptElement && node.src === 'https://accounts.google.com/gsi/client') {
        googleScript = node;
        return node;
      }
      return appendChild(node);
    });
    const store = createStore();
    const view = render(loginView({ store }));
    expect(googleScript).toBeDefined();

    view.rerender(loginView({ store, isLoginModalOpen: true }));
    const google = mockGoogle();
    await act(async () => {
      googleScript?.dispatchEvent(new Event('load'));
    });

    expect(google.api.initialize).toHaveBeenCalledOnce();
    expect(google.api.prompt).not.toHaveBeenCalled();
    expect(google.api.cancel).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Google公式ログイン' })).toBeInTheDocument();
  });

  it('nonceの期限1分前に設定を更新し、新しい設定のボタンを再描画して自動表示は繰り返さない', async () => {
    vi.useFakeTimers();
    const now = new Date('2026-10-15T00:00:00Z').getTime();
    vi.setSystemTime(now);
    const google = mockGoogle();
    const refreshedConfig = { ...config, nonce: 'refreshed-nonce', expiresAt: now + 1_200_000 };
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ config: refreshedConfig }), {
      headers: { 'Content-Type': 'application/json' },
    }));
    await act(async () => {
      render(loginView({ identityConfig: { ...config, expiresAt: now + 120_000 } }));
    });
    expect(google.api.initialize).toHaveBeenCalledOnce();
    expect(google.api.prompt).toHaveBeenCalledOnce();
    const previousButton = screen.getByRole('button', { name: 'Google公式ログイン' });
    expect(previousButton).toHaveAttribute('data-nonce', config.nonce);

    await act(async () => { await vi.advanceTimersByTimeAsync(59_999); });
    expect(fetch).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });

    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith('/api/googleOneTap', expect.objectContaining({
      credentials: 'same-origin',
      cache: 'no-store',
      signal: expect.any(AbortSignal),
    }));
    expect(google.api.initialize).toHaveBeenLastCalledWith(expect.objectContaining({
      nonce: refreshedConfig.nonce,
    }));
    expect(google.api.initialize).toHaveBeenCalledTimes(2);
    expect(google.api.renderButton).toHaveBeenCalledTimes(2);
    expect(google.api.prompt).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Google公式ログイン' })).not.toBe(previousButton);
    expect(screen.getByRole('button', { name: 'Google公式ログイン' })).toHaveAttribute('data-nonce', refreshedConfig.nonce);
  });

  it('設定の更新が失敗したときは30秒後に再試行し、OAuthログインを利用可能に保つ', async () => {
    vi.useFakeTimers();
    const now = new Date('2026-10-15T00:00:00Z').getTime();
    vi.setSystemTime(now);
    const google = mockGoogle();
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        config: { ...config, nonce: 'retry-nonce', expiresAt: now + 1_200_000 },
      }), { headers: { 'Content-Type': 'application/json' } }));
    await act(async () => {
      render(loginView({ identityConfig: { ...config, expiresAt: now + 120_000 } }));
    });

    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(fetch).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Googleのログイン画面を開く' })).toBeEnabled();
    await act(async () => { await vi.advanceTimersByTimeAsync(29_999); });
    expect(fetch).toHaveBeenCalledOnce();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(google.api.initialize).toHaveBeenLastCalledWith(expect.objectContaining({ nonce: 'retry-nonce' }));
    expect(google.api.prompt).toHaveBeenCalledOnce();
  });

  it('認証情報は同一オリジンのAPIに送信し、処理中の重複コールバックを無視する', async () => {
    const google = mockGoogle();
    let finishRequest!: (response: Response) => void;
    vi.mocked(fetch).mockImplementation(() => new Promise((resolve) => { finishRequest = resolve; }));
    render(loginView());
    await screen.findByRole('button', { name: 'Google公式ログイン' });

    let firstCallback: void | Promise<void>;
    act(() => { firstCallback = google.credential('first-credential'); });
    await act(async () => { await google.credential('duplicate-credential'); });

    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith('/api/googleOneTap', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: 'first-credential' }),
    });
    expect(screen.getByRole('status')).toHaveTextContent('ログインしています');
    expect(screen.getByRole('button', { name: 'Googleのログイン画面を開く' })).toBeDisabled();

    await act(async () => {
      finishRequest(new Response(null, { status: 401 }));
      await firstCallback;
    });
    expect(screen.getByRole('button', { name: 'Googleでログイン' })).toBeEnabled();
  });

  it.each([
    ['認証エラー', () => Promise.resolve(new Response(null, { status: 401 }))],
    ['通信エラー', () => Promise.reject(new Error('offline'))],
    ['無効な成功レスポンス', () => Promise.resolve(Response.json({ ok: false }))],
  ])('%sならログイン画面を開いてOAuthへの案内を表示し、再試行できる', async (_name, request) => {
    const google = mockGoogle();
    const store = createStore();
    vi.mocked(fetch).mockImplementation(request);
    render(loginView({ store }));
    await screen.findByRole('button', { name: 'Google公式ログイン' });

    await act(async () => { await google.credential(); });

    expect(store.get(getIsLoginModalOpenAtom)).toBe(true);
    expect(screen.getByRole('alert')).toHaveTextContent('下のボタンからお試しください');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Google公式ログイン' })).toBeInTheDocument();
    const fallback = screen.getByRole('button', { name: 'Googleでログイン' });
    expect(fallback).toBeEnabled();
    expect(fallback.closest('form')).toHaveAttribute('action', '/api/googleLogin');

    await act(async () => { await google.credential('retry-credential'); });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('成功時は表示中のパス・クエリ・ハッシュを保ちloginSuccessだけを更新する', async () => {
    const google = mockGoogle();
    window.history.replaceState({}, '', '/archives/123?tag=sample&loginSuccess=false#comments');
    const replaceLocation = vi.spyOn(window.location, 'replace').mockImplementation(() => {});
    vi.mocked(fetch).mockResolvedValue(Response.json({ ok: true }));
    render(loginView());
    await screen.findByRole('button', { name: 'Google公式ログイン' });

    await act(async () => { await google.credential(); });

    expect(replaceLocation).toHaveBeenCalledOnce();
    const destination = new URL(replaceLocation.mock.calls[0][0]);
    expect(destination.origin).toBe(window.location.origin);
    expect(destination.pathname).toBe('/archives/123');
    expect(destination.searchParams.get('tag')).toBe('sample');
    expect(destination.searchParams.getAll('loginSuccess')).toEqual(['true']);
    expect(destination.hash).toBe('#comments');
  });

  it('アンマウント後に届いたGoogleのコールバックを送信しない', async () => {
    const google = mockGoogle();
    const view = render(loginView());
    await screen.findByRole('button', { name: 'Google公式ログイン' });

    view.unmount();
    await act(async () => { await google.credential(); });

    expect(google.api.cancel).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
  });
});
