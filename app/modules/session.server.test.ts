import { commitSession, getSession, initSessionStorage, resolveSessionSecret } from './session.server';
import { beforeAll, describe, expect, it } from 'vitest';

describe('session.server', () => {
  beforeAll(() => initSessionStorage('test-session-secret'));

  it('セッション秘密鍵が未設定なら既知の値へフォールバックしない', () => {
    expect(() => resolveSessionSecret({})).toThrow(
      'SESSION_SECRET or HPE_SESSION_SECRET is not set',
    );
  });

  it('セッションCookieの有効期限を30日にする', async () => {
    const session = await getSession(null);
    session.set('isValidUser', true);

    await expect(commitSession(session)).resolves.toContain('Max-Age=2592000');
  });
});
