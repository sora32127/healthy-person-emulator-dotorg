// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterContextProvider } from 'react-router';
import { action } from '~/routes/_layout.archives.edit.$postId';
import { getAuthenticatedUser } from '~/modules/auth.google.server';
import { updatePostWithTagsAndHistory } from '~/modules/db.server';
import { createEmbedding } from '~/modules/embedding.server';
import { getHashedUserIPAddress, validateRequest } from '~/modules/security.server';

vi.mock('~/modules/auth.google.server', () => ({ getAuthenticatedUser: vi.fn() }));
vi.mock('~/modules/db.server', () => ({
  getNowEditingInfo: vi.fn(),
  upsertNowEditingInfo: vi.fn(),
  getPostForEditing: vi.fn(),
  getTagsCounts: vi.fn(),
  getPostEditHistory: vi.fn(),
  updatePostWithTagsAndHistory: vi.fn(),
}));
vi.mock('~/modules/embedding.server', () => ({ createEmbedding: vi.fn() }));
vi.mock('~/modules/security.server', () => ({
  getHashedUserIPAddress: vi.fn(),
  getTurnStileSiteKey: vi.fn(),
  validateRequest: vi.fn(),
}));

const authenticatedUser = {
  userUuid: 'authenticated-editor',
  email: 'editor@example.test',
  userAuthType: 'Google' as const,
};

function editRequest(userId?: string) {
  const body = new URLSearchParams({
    postTitle: 'Edited title',
    postContent: 'An edited article body.',
    tags: 'first, second',
    turnstileToken: 'valid-token',
  });
  if (userId !== undefined) body.set('userId', userId);
  return new Request('https://example.test/archives/edit/42', { method: 'POST', body });
}

function submitEdit(request: Request) {
  return action({
    request,
    url: new URL(request.url),
    pattern: '/archives/edit/:postId',
    params: { postId: '42' },
    context: new RouterContextProvider(),
  });
}

describe('article edit action authentication', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getAuthenticatedUser).mockResolvedValue(authenticatedUser);
    vi.mocked(getHashedUserIPAddress).mockResolvedValue('hashed-ip');
    vi.mocked(validateRequest).mockResolvedValue(true);
    vi.mocked(updatePostWithTagsAndHistory).mockResolvedValue({
      postId: 42,
      postTitle: 'Edited title',
      postContent: '<p>An edited article body.</p>\n',
    });
  });

  it.each([null, { ...authenticatedUser, userUuid: '' }])(
    'rejects a direct POST without a valid authenticated user before processing the form',
    async (user) => {
      vi.mocked(getAuthenticatedUser).mockResolvedValue(user);
      const request = editRequest('forged-editor');
      const readForm = vi.spyOn(request, 'formData');

      await expect(submitEdit(request)).rejects.toMatchObject({ status: 302 });

      expect(getAuthenticatedUser).toHaveBeenCalledWith(request);
      expect(readForm).not.toHaveBeenCalled();
      expect(getHashedUserIPAddress).not.toHaveBeenCalled();
      expect(validateRequest).not.toHaveBeenCalled();
      expect(updatePostWithTagsAndHistory).not.toHaveBeenCalled();
      expect(createEmbedding).not.toHaveBeenCalled();
    },
  );

  it.each(['forged-editor', undefined])(
    'records the authenticated editor regardless of the submitted userId (%s)',
    async (userId) => {
      await expect(submitEdit(editRequest(userId))).resolves.toEqual({
        success: true,
        message: '投稿を編集しました。',
      });

      expect(validateRequest).toHaveBeenCalledWith('valid-token', 'hashed-ip');
      expect(updatePostWithTagsAndHistory).toHaveBeenCalledExactlyOnceWith({
        postId: 42,
        postTitle: 'Edited title',
        postContentHtml: '<p>An edited article body.</p>\n',
        tags: ['first', 'second'],
        editorUserId: authenticatedUser.userUuid,
      });
      expect(createEmbedding).toHaveBeenCalledExactlyOnceWith({
        postId: 42,
        postTitle: 'Edited title',
        postContent: '<p>An edited article body.</p>\n',
      });
    },
  );

  it('still rejects an authenticated edit when Turnstile validation fails', async () => {
    vi.mocked(validateRequest).mockResolvedValue(false);

    await expect(submitEdit(editRequest())).resolves.toMatchObject({ success: false });

    expect(updatePostWithTagsAndHistory).not.toHaveBeenCalled();
    expect(createEmbedding).not.toHaveBeenCalled();
  });
});
