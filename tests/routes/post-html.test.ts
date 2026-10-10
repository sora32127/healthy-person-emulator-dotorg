// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterContextProvider } from 'react-router';
import { action as preview } from '~/routes/_layout.post';
import { action as create } from '~/routes/_layout.post_.preview';
import { action as edit } from '~/routes/_layout.archives.edit.$postId';
import { createPostWithTags, updatePostWithTagsAndHistory } from '~/modules/db.server';

vi.mock('~/modules/db.server', () => ({
  getStopWords: vi.fn().mockResolvedValue([]),
  createPostWithTags: vi.fn(),
  updatePostWithTagsAndHistory: vi.fn(),
  updatePostWelcomed: vi.fn(),
}));
vi.mock('~/modules/session.server', () => ({ isUserValid: vi.fn().mockResolvedValue(true) }));
vi.mock('~/modules/auth.google.server', () => ({
  getAuthenticatedUser: vi
    .fn()
    .mockResolvedValue({ userUuid: 'editor', email: 'editor@example.test' }),
}));
vi.mock('~/modules/security.server', () => ({
  getHashedUserIPAddress: vi.fn().mockResolvedValue('192.0.2.1'),
  validateRequest: vi.fn().mockResolvedValue(true),
  getJudgeWelcomedByGenerativeAI: vi
    .fn()
    .mockResolvedValue({ isWelcomed: true, explanation: '' }),
}));
vi.mock('~/modules/embedding.server', () => ({ createEmbedding: vi.fn() }));
vi.mock('~/modules/cloudflare.server', () => ({
  getEmbedding: vi.fn().mockResolvedValue([]),
  querySimilar: vi.fn().mockResolvedValue([]),
}));

const submittedHtml = '<strong>本文</strong><img src="/image.png" onerror="unexpected()">';
const safeHtml = '<strong>本文</strong><img src="/image.png" />';

function newPostRequest(action: string) {
  const fields = {
    title: ['記事タイトル'],
    postCategory: 'misDeed',
    situations: {
      who: submittedHtml,
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
    selectedTags: [],
    createdTags: [],
  };
  const body = new URLSearchParams({ _action: action });
  for (const [key, value] of Object.entries(fields)) body.set(key, JSON.stringify(value));
  return new Request('https://example.test/post', { method: 'POST', body });
}

function actionArgs(request: Request, postId?: string) {
  return {
    request,
    url: new URL(request.url),
    pattern: postId ? '/archives/edit/:postId' : '/post',
    params: postId ? { postId } : {},
    context: new RouterContextProvider(),
  };
}

describe('article HTML boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createPostWithTags).mockImplementation(async (input) => ({
      postId: 1,
      postTitle: input.postTitle,
      postContent: input.postContent,
    }));
    vi.mocked(updatePostWithTagsAndHistory).mockImplementation(async (input) => ({
      postId: input.postId,
      postTitle: input.postTitle,
      postContent: input.postContentHtml,
    }));
  });

  it('returns only sanitized HTML for the new-post preview', async () => {
    const result = await preview(actionArgs(newPostRequest('firstSubmit')));
    expect(result?.data.success).toBe(true);
    expect(result?.data.data?.data?.WikifiedResult).toContain(safeHtml);
    expect(result?.data.data?.data?.WikifiedResult).not.toContain('onerror');
  });

  it('sanitizes a direct new-post submission before persistence', async () => {
    await create(actionArgs(newPostRequest('secondSubmit')));
    const savedHtml = vi.mocked(createPostWithTags).mock.calls[0][0].postContent;
    expect(savedHtml).toContain(safeHtml);
    expect(savedHtml).not.toContain('onerror');
  });

  it('sanitizes Markdown HTML before persisting an edit', async () => {
    const body = new URLSearchParams({
      postTitle: 'Edited title',
      postContent: submittedHtml,
      tags: 'example',
      userId: 'editor',
      turnstileToken: 'verified',
    });
    const request = new Request('https://example.test/archives/edit/1', {
      method: 'POST',
      body,
    });
    await edit(actionArgs(request, '1'));
    const savedHtml = vi.mocked(updatePostWithTagsAndHistory).mock.calls[0][0].postContentHtml;
    expect(savedHtml).toContain(safeHtml);
    expect(savedHtml).not.toContain('onerror');
  });
});
