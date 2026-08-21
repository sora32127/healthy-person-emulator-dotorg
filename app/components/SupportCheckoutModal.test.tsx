import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SupportCheckoutModal } from './SupportCheckoutModal';

vi.mock('@stripe/stripe-js', () => ({ loadStripe: vi.fn() }));
vi.mock('react-hot-toast', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

describe('SupportCheckoutModal', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('未認証なら決済画面を空表示にせずTurnstileへ引き継ぐ', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: false, message: 'ユーザー認証が必要です' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    const onRequireTurnstile = vi.fn();

    render(
      <SupportCheckoutModal
        isOpen
        onClose={vi.fn()}
        amountYen={500}
        supporterName="テスト"
        supportMessage=""
        onRequireTurnstile={onRequireTurnstile}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '決済に進む', hidden: true }));

    await waitFor(() => expect(onRequireTurnstile).toHaveBeenCalledOnce());
    expect(screen.getByRole('button', { name: '決済に進む', hidden: true })).toBeEnabled();
  });
});
