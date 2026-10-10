import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActionFunctionArgs } from 'react-router';
import { action } from '~/routes/_layout.archives.$postId';
import { recordPostVote, recordCommentVote } from '~/modules/db.server';
import { recordLibraryReaction } from '~/modules/library.server';
import { commitSession, isUserValid } from '~/modules/session.server';

const session = vi.hoisted(() => ({ get: vi.fn((): number[] => []), set: vi.fn() }));
vi.mock('~/modules/db.server', () => ({
  ArchiveDataEntry: {},
  getUserId: vi.fn(),
  addOrRemoveBookmark: vi.fn(),
  judgeIsBookmarked: vi.fn(),
  recordPostVote: vi.fn(),
  recordCommentVote: vi.fn(),
  createPostComment: vi.fn(),
}));
vi.mock('~/modules/library.server', () => ({ recordLibraryReaction: vi.fn() }));
vi.mock('~/modules/session.server', () => ({
  getSession: vi.fn(async () => session),
  commitSession: vi.fn(async () => 'fixture-session'),
  isUserValid: vi.fn(async () => true),
  getUserActivityData: vi.fn(),
}));
vi.mock('~/modules/security.server', () => ({
  getHashedUserIPAddress: vi.fn(async () => 'fixture-ip-hash'),
  getTurnStileSiteKey: vi.fn(),
  validateRequest: vi.fn(),
}));

function vote(target: 'post' | 'comment', voteType: 'like' | 'dislike' | 'support') {
  const request = new Request('https://example.test/archives/42', {
    method: 'POST',
    headers: { Origin: 'https://example.test' },
    body: new URLSearchParams({
      action: target === 'post' ? 'votePost' : 'voteComment',
      postId: '42',
      voteType,
      ...(target === 'comment' ? { commentId: '7' } : {}),
    }),
  });
  return { request, result: action({ request } as ActionFunctionArgs) };
}

beforeEach(() => {
  vi.clearAllMocks();
  session.get.mockReturnValue([]);
  vi.mocked(recordPostVote).mockResolvedValue(undefined);
  vi.mocked(recordCommentVote).mockResolvedValue(undefined);
  vi.mocked(recordLibraryReaction).mockResolvedValue(undefined);
  vi.mocked(commitSession).mockResolvedValue('fixture-session');
  vi.mocked(isUserValid).mockResolvedValue(true);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('既存の評価操作と自動履歴', () => {
  it('main の「力になりたい」の成功とセッション保存を維持する', async () => {
    const response = await vote('post', 'support').result;
    expect(response.data).toMatchObject({ success: true });
    expect(recordPostVote).toHaveBeenCalledWith(42, 'support', 'fixture-ip-hash');
    expect(session.set).toHaveBeenCalledWith('supportedPages', [42]);
    expect(new Headers(response.init?.headers).get('Set-Cookie')).toBe('fixture-session');
    expect(recordLibraryReaction).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('main の「力になりたい」の重複防止を維持する', async () => {
    session.get.mockReturnValue([42]);
    const response = await vote('post', 'support').result;
    expect(response.init?.status).toBe(409);
    expect(recordPostVote).not.toHaveBeenCalled();
    expect(commitSession).not.toHaveBeenCalled();
    expect(recordLibraryReaction).not.toHaveBeenCalled();
  });

  it.each([
    ['post', 'like'],
    ['post', 'dislike'],
    ['comment', 'like'],
    ['comment', 'dislike'],
  ] as const)('%s の %s が成功した後だけ履歴に渡す', async (target, voteType) => {
    const { request, result } = vote(target, voteType);
    const response = await result;
    expect(response.data).toMatchObject({ success: true });
    expect(recordLibraryReaction).toHaveBeenCalledWith(request, {
      postId: 42,
      voteType,
      ...(target === 'comment' ? { commentId: 7 } : {}),
    });
    const original = vi.mocked(target === 'post' ? recordPostVote : recordCommentVote);
    expect(original.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(recordLibraryReaction).mock.invocationCallOrder[0],
    );
    expect(vi.mocked(commitSession).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(recordLibraryReaction).mock.invocationCallOrder[0],
    );
    expect(new Headers(response.init?.headers).get('Set-Cookie')).toBe('fixture-session');
  });

  it.each(['post', 'comment'] as const)('%s の履歴が失敗しても評価の成功を維持する', async (target) => {
    vi.mocked(recordLibraryReaction).mockRejectedValue(new Error('private fixture diagnostic'));
    const response = await vote(target, 'like').result;
    expect(response.data).toMatchObject({ success: true });
    expect(new Headers(response.init?.headers).get('Set-Cookie')).toBe('fixture-session');
    expect(console.error).toHaveBeenCalledWith('Reaction history could not be recorded');
    expect(console.error).not.toHaveBeenCalledWith(expect.any(Error));
  });

  it.each(['post', 'comment'] as const)('%s の評価が失敗したら履歴を作らない', async (target) => {
    vi.mocked(target === 'post' ? recordPostVote : recordCommentVote).mockRejectedValue(
      new Error('fixture vote failure'),
    );
    const response = await vote(target, 'like').result;
    expect(response.data).toMatchObject({ success: false });
    expect(recordLibraryReaction).not.toHaveBeenCalled();
  });

  it('既存のユーザー検証が通らない操作は評価と履歴の両方を作らない', async () => {
    vi.mocked(isUserValid).mockResolvedValue(false);
    const response = await vote('comment', 'dislike').result;
    expect(response.data).toMatchObject({ requiresUserValidation: true });
    expect(recordCommentVote).not.toHaveBeenCalled();
    expect(recordLibraryReaction).not.toHaveBeenCalled();
  });
});
