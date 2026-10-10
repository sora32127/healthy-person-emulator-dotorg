// @vitest-environment node
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { recordPostVote } from '~/modules/db.server';
import { commitSession, getSession, initSessionStorage } from '~/modules/session.server';
import { action } from '~/routes/_layout.archives.$postId';

vi.mock('~/modules/db.server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/modules/db.server')>()),
  recordPostVote: vi.fn(),
}));

type Session = Awaited<ReturnType<typeof getSession>>;

async function createSession() {
  const session = await getSession(null);
  session.set('isValidUser', true);
  return session;
}

async function vote(voteType: string, session: Session) {
  const formData = new FormData();
  formData.set('action', 'votePost');
  formData.set('postId', '42');
  formData.set('voteType', voteType);
  return action({
    request: new Request('https://example.com/archives/42', {
      method: 'POST',
      headers: {
        Cookie: await commitSession(session),
        'CF-Connecting-IP': 'test-voter',
      },
      body: formData,
    }),
    url: new URL('https://example.com/archives/42'),
    pattern: '/archives/:postId',
    params: { postId: '42' },
    context: {},
  });
}

function responseCookie(result: Awaited<ReturnType<typeof action>>) {
  return new Headers(result.init?.headers).get('Set-Cookie');
}

describe('記事の「力になりたい」リアクション', () => {
  beforeAll(() => initSessionStorage('test-session-secret'));

  beforeEach(() => {
    vi.mocked(recordPostVote).mockReset();
    vi.mocked(recordPostVote).mockResolvedValue(undefined);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it('既存のCookieにsupportedPagesがなくても保存し、署名付きCookieへ反映する', async () => {
    const result = await vote('support', await createSession());

    expect(recordPostVote).toHaveBeenCalledExactlyOnceWith(42, 'support', 'test-voter');
    expect(result.data).toEqual({
      success: true,
      message: '「力になりたい」の気持ちを伝えました',
    });
    expect(responseCookie(result)).not.toBeNull();
    const savedSession = await getSession(responseCookie(result));
    expect(savedSession.get('supportedPages')).toEqual([42]);
    expect(savedSession.get('isValidUser')).toBe(true);
  });

  it.each(['likedPages', 'dislikedPages'] as const)(
    '%sに同じ記事があっても独立して伝えられ、既存の履歴を保つ',
    async (existingReaction) => {
      const session = await createSession();
      session.set(existingReaction, [42]);
      session.set('supportedPages', [7]);

      const result = await vote('support', session);

      expect(result.data).toMatchObject({ success: true });
      expect(recordPostVote).toHaveBeenCalledExactlyOnceWith(42, 'support', 'test-voter');
      const savedSession = await getSession(responseCookie(result));
      expect(savedSession.get('supportedPages')).toEqual([7, 42]);
      expect(savedSession.get(existingReaction)).toEqual([42]);
    },
  );

  it.each([
    ['like', 'likedPages'],
    ['dislike', 'dislikedPages'],
  ] as const)('力になりたいを伝えた後も%sを送れる', async (voteType, sessionKey) => {
    const session = await createSession();
    session.set('supportedPages', [42]);

    const result = await vote(voteType, session);

    expect(result.data).toMatchObject({ success: true });
    expect(recordPostVote).toHaveBeenCalledExactlyOnceWith(42, voteType, 'test-voter');
    const savedSession = await getSession(responseCookie(result));
    expect(savedSession.get('supportedPages')).toEqual([42]);
    expect(savedSession.get(sessionKey)).toEqual([42]);
  });

  it('同じ記事への再送は409で拒否し、保存しない', async () => {
    const session = await createSession();
    session.set('supportedPages', [42]);

    const result = await vote('support', session);

    expect(result.init?.status).toBe(409);
    expect(result.data).toEqual({
      success: false,
      message: 'この記事にはすでに「力になりたい」を伝えています',
    });
    expect(recordPostVote).not.toHaveBeenCalled();
    expect(responseCookie(result)).toBeNull();
  });

  it('未対応のリアクションは400で拒否し、保存しない', async () => {
    const result = await vote('invalid', await createSession());

    expect(result.init?.status).toBe(400);
    expect(result.data).toMatchObject({ success: false });
    expect(recordPostVote).not.toHaveBeenCalled();
    expect(responseCookie(result)).toBeNull();
  });

  it('ユーザー検証を通過していなければ401で拒否し、保存しない', async () => {
    const result = await vote('support', await getSession(null));

    expect(result.init?.status).toBe(401);
    expect(result.data).toMatchObject({ requiresUserValidation: true });
    expect(recordPostVote).not.toHaveBeenCalled();
    expect(responseCookie(result)).toBeNull();
  });

  it('保存に失敗した場合は500を返し、投票済みCookieを発行しない', async () => {
    vi.mocked(recordPostVote).mockRejectedValue(new Error('database unavailable'));

    const result = await vote('support', await createSession());

    expect(recordPostVote).toHaveBeenCalledExactlyOnceWith(42, 'support', 'test-voter');
    expect(result.init?.status).toBe(500);
    expect(result.data).toMatchObject({ success: false });
    expect(responseCookie(result)).toBeNull();
  });
});
