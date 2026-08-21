import { createSupportCheckoutSession, verifyWebhookSignature } from './stripe.server';
import { beforeAll, afterAll, afterEach, describe, expect, it, vi } from 'vitest';

// DMail robots driven by the test: set a fake WEBHOOK secret and confirm
// that verification accepts a correctly-signed payload and rejects tampering.

async function hmacHex(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const bytes = new Uint8Array(
    await crypto.subtle.sign({ name: 'HMAC', hash: 'SHA-256' }, key, encoder.encode(payload)),
  );
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

describe('stripe.server webhook signature', () => {
  const WEBHOOK_SECRET = 'whsec_test_secret';

  beforeAll(() => {
    (globalThis as any).__cloudflareEnv = { STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET };
  });
  afterAll(() => {
    delete (globalThis as any).__cloudflareEnv;
  });

  it('正しい署名を受理する', async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({
      id: 'evt_test_123',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_test_456', metadata: { commentId: '42' } } },
    });
    const hex = await hmacHex(WEBHOOK_SECRET, `${timestamp}.${payload}`);
    const header = `t=${timestamp},v1=${hex}`;

    const valid = await verifyWebhookSignature(payload, header);
    expect(valid).toBe(true);
  });

  it('署名が改ざんされた場合は拒否する', async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({ id: 'evt_test' });
    const valid = await verifyWebhookSignature(
      payload,
      `t=${timestamp},v1=00000000000000000000000000000000`,
    );
    expect(valid).toBe(false);
  });

  it('秘密鍵が一致しない場合は拒否する', async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({ id: 'evt_test' });
    const hex = await hmacHex('whsec_wrong_secret', `${timestamp}.${payload}`);
    const valid = await verifyWebhookSignature(payload, `t=${timestamp},v1=${hex}`);
    expect(valid).toBe(false);
  });

  it('古すぎるタイムスタンプは replay として拒否する', async () => {
    const timestamp = Math.floor(Date.now() / 1000) - 3600; // 1時間前
    const payload = JSON.stringify({ id: 'evt_test' });
    const hex = await hmacHex(WEBHOOK_SECRET, `${timestamp}.${payload}`);
    const valid = await verifyWebhookSignature(payload, `t=${timestamp},v1=${hex}`);
    expect(valid).toBe(false);
  });

  it('ヘッダーが無い場合は拒否する', async () => {
    const valid = await verifyWebhookSignature('{}', null);
    expect(valid).toBe(false);
  });
});

describe('stripe.server checkout session', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete (globalThis as any).__cloudflareEnv;
  });

  it('現行APIのEmbedded Checkout設定でセッションを作成する', async () => {
    (globalThis as any).__cloudflareEnv = {
      STRIPE_SECRET_KEY: 'sk_test_secret',
      STRIPE_PUBLISHABLE_KEY: 'pk_test_public',
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'cs_test_123',
          object: 'checkout.session',
          url: null,
          client_secret: 'cs_test_123_secret_456',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const session = await createSupportCheckoutSession({
      origin: 'https://preview.healthy-person-emulator.org',
      amountYen: 100,
      supporterName: 'テスト',
      supportMessage: '応援しています',
    });

    const requestBody = String(fetchMock.mock.calls[0]?.[1]?.body);
    expect(requestBody).toContain('ui_mode=embedded_page');
    expect(requestBody).toContain('redirect_on_completion=if_required');
    expect(requestBody).toContain('integration_identifier=hpe_support_qmvzrxka');
    expect(session.clientSecret).toBe('cs_test_123_secret_456');
  });
});
