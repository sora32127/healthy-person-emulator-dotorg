// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterContextProvider } from 'react-router';
import { action as firstSubmit } from '~/routes/_layout.post';
import { action as previewAction } from '~/routes/_layout.post_.preview';
import { getEmbedding, querySimilar } from '~/modules/cloudflare.server';
import { createPostWithTags, getStopWords } from '~/modules/db.server';
import { getHashedUserIPAddress, validateRequest } from '~/modules/security.server';
import {
  commitSession,
  getSession,
  initSessionStorage,
  isUserValid,
} from '~/modules/session.server';

vi.mock('~/modules/db.server', () => ({
  getStopWords: vi.fn(),
  getTagsCounts: vi.fn(),
  createPostWithTags: vi.fn(),
  updatePostWelcomed: vi.fn(),
}));
vi.mock('~/modules/cloudflare.server', () => ({
  getEmbedding: vi.fn(),
  querySimilar: vi.fn(),
}));
vi.mock('~/modules/security.server', () => ({
  getHashedUserIPAddress: vi.fn(),
  getTurnStileSiteKey: vi.fn(),
  validateRequest: vi.fn(),
  getJudgeWelcomedByGenerativeAI: vi.fn(),
}));
vi.mock('~/modules/embedding.server', () => ({ createEmbedding: vi.fn() }));

const formValues = {
  title: ['記事タイトル'],
  postCategory: 'misDeed',
  situations: {
    who: '自分',
    what: '状況',
    when: '朝',
    where: '家',
    why: '理由',
    how: '方法',
    // eslint-disable-next-line unicorn/no-thenable -- Required article field, not a Promise.
    then: '結果',
    assumption: [],
  },
  reflection: ['振り返り'],
  counterReflection: ['対策'],
  note: [],
  selectedTags: ['既存タグ'],
  createdTags: ['新しいタグ'],
};

function actionArgs(body: URLSearchParams, cookie?: string) {
  const request = new Request('https://example.test/post/preview', {
    method: 'POST',
    body,
    headers: cookie ? { Cookie: cookie } : undefined,
  });
  return {
    request,
    url: new URL(request.url),
    pattern: '/post/preview',
    params: {},
    context: new RouterContextProvider(),
  };
}

function firstSubmitBody(values: unknown) {
  const body = new URLSearchParams({ _action: 'firstSubmit' });
  for (const [key, value] of Object.entries(values as Record<string, unknown>)) {
    body.set(key, JSON.stringify(value));
  }
  return body;
}

function verificationBody(values: unknown = formValues) {
  return new URLSearchParams({
    _action: 'validateTurnstile',
    token: 'valid-token',
    formValues: JSON.stringify(values),
  });
}

function expectNoAI() {
  expect(getEmbedding).not.toHaveBeenCalled();
  expect(querySimilar).not.toHaveBeenCalled();
  expect(createPostWithTags).not.toHaveBeenCalled();
}

describe('post preview AI validation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    initSessionStorage('preview-ai-test-secret');
    vi.mocked(getStopWords).mockResolvedValue([]);
    vi.mocked(getHashedUserIPAddress).mockResolvedValue('192.0.2.1');
    vi.mocked(validateRequest).mockResolvedValue(true);
    vi.mocked(getEmbedding).mockResolvedValue([0.1, 0.2]);
    vi.mocked(querySimilar).mockResolvedValue([
      { id: '42', score: 0.9, metadata: { postId: 42, postTitle: '似た事例' } },
    ]);
  });

  afterEach(() => vi.restoreAllMocks());

  it('creates an anonymous preview without calling AI', async () => {
    const result = await firstSubmit(actionArgs(firstSubmitBody(formValues)));

    expect(result?.data.success).toBe(true);
    expectNoAI();
    expect(validateRequest).not.toHaveBeenCalled();
  });

  it('rejects invalid preview input before calling AI', async () => {
    const result = await firstSubmit(actionArgs(firstSubmitBody({ ...formValues, title: [] })));

    expect(result?.init?.status).toBe(400);
    expect(result?.data.success).toBe(false);
    expectNoAI();
  });

  it('returns 400 for malformed preview JSON without calling AI', async () => {
    const body = firstSubmitBody(formValues);
    body.set('title', '{');
    const result = await firstSubmit(actionArgs(body));

    expect(result?.init?.status).toBe(400);
    expect(result?.data.success).toBe(false);
    expectNoAI();
  });

  it('requires a Turnstile token before searching', async () => {
    const body = verificationBody();
    body.delete('token');
    const result = await previewAction(actionArgs(body));

    expect(result?.init?.status).toBe(400);
    expect(result?.data.success).toBe(false);
    expectNoAI();
    expect(validateRequest).not.toHaveBeenCalled();
  });

  it('rejects an invalid token even if the session was previously verified', async () => {
    const session = await getSession(null);
    session.set('isValidUser', true);
    const cookie = await commitSession(session);
    vi.mocked(validateRequest).mockResolvedValue(false);
    const result = await previewAction(actionArgs(verificationBody(), cookie));

    expect(result?.init?.status).toBe(400);
    expect(result?.data.success).toBe(false);
    expectNoAI();
  });

  it.each(['{', 'null', '{}'])(
    'rejects invalid formValues (%s) before calling AI',
    async (value) => {
      const body = verificationBody();
      body.set('formValues', value);
      const result = await previewAction(actionArgs(body));

      expect(result?.init?.status).toBe(400);
      expect(result?.data.success).toBe(false);
      expectNoAI();
    },
  );

  it('rejects schema-invalid formValues before calling AI', async () => {
    const result = await previewAction(actionArgs(verificationBody({ ...formValues, title: [] })));

    expect(result?.init?.status).toBe(400);
    expect(result?.data.success).toBe(false);
    expectNoAI();
  });

  it('searches only after validation and returns candidates with the verified session', async () => {
    const result = await previewAction(actionArgs(verificationBody()));

    expect(validateRequest).toHaveBeenCalledExactlyOnceWith('valid-token', '192.0.2.1');
    expect(getEmbedding).toHaveBeenCalledExactlyOnceWith(
      'タイトル: 記事タイトル\nタグ: 既存タグ,新しいタグ\n本文: 自分 朝 家 理由 状況 方法 結果 振り返り 対策',
    );
    expect(querySimilar).toHaveBeenCalledExactlyOnceWith([0.1, 0.2], 5);
    expect(vi.mocked(validateRequest).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(getEmbedding).mock.invocationCallOrder[0],
    );
    expect(result?.data).toMatchObject({
      success: true,
      similarPosts: [{ postId: 42, postTitle: '似た事例', score: 0.9 }],
    });
    const cookie = new Headers(result?.init?.headers).get('Set-Cookie')!;
    await expect(
      isUserValid(new Request('https://example.test', { headers: { Cookie: cookie } })),
    ).resolves.toBe(true);
    expect(createPostWithTags).not.toHaveBeenCalled();
  });

  it.each([getEmbedding, querySimilar])(
    'keeps posting available when similarity search fails',
    async (fail) => {
      vi.mocked(fail).mockRejectedValueOnce(new Error('service unavailable'));
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await previewAction(actionArgs(verificationBody()));

      expect(result?.data).toMatchObject({ success: true, similarPosts: [] });
      const cookie = new Headers(result?.init?.headers).get('Set-Cookie')!;
      await expect(
        isUserValid(new Request('https://example.test', { headers: { Cookie: cookie } })),
      ).resolves.toBe(true);
      expect(createPostWithTags).not.toHaveBeenCalled();
    },
  );

  it('does not run AI or persist a post for an unverified final submission', async () => {
    const result = await previewAction(
      actionArgs(new URLSearchParams({ _action: 'secondSubmit' })),
    );

    expect(result?.init?.status).toBe(400);
    expect(result?.data.success).toBe(false);
    expectNoAI();
  });
});
