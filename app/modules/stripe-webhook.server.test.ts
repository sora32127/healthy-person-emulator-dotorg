import { describe, expect, it } from 'vitest';
import { getPaidSupportMessage } from './stripe.server';

function supportEvent(overrides: Record<string, unknown> = {}) {
  return {
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_support',
        mode: 'payment',
        payment_status: 'paid',
        currency: 'jpy',
        amount_total: 51,
        metadata: {
          kind: 'support',
          supporterName: 'テスト',
          supportMessage: '応援しています',
        },
        ...overrides,
      },
    },
  };
}

describe('Stripe support webhook', () => {
  it.each(['checkout.session.completed', 'checkout.session.async_payment_succeeded'])(
    '%s の支払い済みサポートだけを保存対象にする',
    (type) => {
      const event = supportEvent();
      event.type = type;

      expect(getPaidSupportMessage(event)).toEqual({
        stripeSessionId: 'cs_test_support',
        amountYen: 51,
        name: 'テスト',
        message: '応援しています',
      });
    },
  );

  it.each([
    ['未払い', { payment_status: 'unpaid' }],
    ['別通貨', { currency: 'usd' }],
    ['別モード', { mode: 'subscription' }],
    ['Stripe下限未満', { amount_total: 49 }],
    ['別用途', { metadata: { kind: 'other', supporterName: 'テスト' } }],
  ])('%sのCheckout Sessionを無視する', (_name, overrides) => {
    expect(getPaidSupportMessage(supportEvent(overrides))).toBeNull();
  });
});
