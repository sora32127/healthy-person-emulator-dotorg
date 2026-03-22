import { describe, it, expect, vi } from 'vitest';

vi.mock('~/modules/social/twitter.server', () => ({
  postToTwitter: vi.fn().mockResolvedValue({ providerPostId: 'tweet-123' }),
}));
vi.mock('~/modules/social/bluesky.server', () => ({
  postToBluesky: vi.fn().mockResolvedValue({ providerPostId: 'at://did/post/abc' }),
}));
vi.mock('~/modules/social/misskey.server', () => ({
  postToMisskey: vi.fn().mockResolvedValue({ providerPostId: 'note-456' }),
}));

import { postToSocial } from '~/modules/social/post.server';
import type { CloudflareEnv } from '~/types/env';

const mockEnv = {
  SS_TWITTER_CK: { get: vi.fn().mockResolvedValue('ck') },
  SS_TWITTER_CS: { get: vi.fn().mockResolvedValue('cs') },
  SS_TWITTER_AT: { get: vi.fn().mockResolvedValue('at') },
  SS_TWITTER_ATS: { get: vi.fn().mockResolvedValue('ats') },
  SS_BLUESKY_USER: { get: vi.fn().mockResolvedValue('user') },
  SS_BLUESKY_PASSWORD: { get: vi.fn().mockResolvedValue('pass') },
  SS_MISSKEY_TOKEN: { get: vi.fn().mockResolvedValue('token') },
  SS_AUTOMATION_DRY_RUN: { get: vi.fn().mockResolvedValue('false') },
} as unknown as CloudflareEnv;

describe('postToSocial', () => {
  it('twitterプラットフォームでTwitterクライアントを呼ぶ', async () => {
    const result = await postToSocial(mockEnv, {
      platform: 'twitter',
      postTitle: 'テスト',
      postUrl: 'https://example.com/archives/1',
      ogUrl: 'https://static.example.com/ogp/1.jpg',
      messageType: 'new',
    });
    expect(result.providerPostId).toBe('tweet-123');
  });

  it('blueskyプラットフォームでBlueskyクライアントを呼ぶ', async () => {
    const result = await postToSocial(mockEnv, {
      platform: 'bluesky',
      postTitle: 'テスト',
      postUrl: 'https://example.com/archives/1',
      ogUrl: 'https://static.example.com/ogp/1.jpg',
      messageType: 'new',
    });
    expect(result.providerPostId).toBe('at://did/post/abc');
  });

  it('activitypubプラットフォームでMisskeyクライアントを呼ぶ', async () => {
    const result = await postToSocial(mockEnv, {
      platform: 'activitypub',
      postTitle: 'テスト',
      postUrl: 'https://example.com/archives/1',
      ogUrl: 'https://static.example.com/ogp/1.jpg',
      messageType: 'new',
    });
    expect(result.providerPostId).toBe('note-456');
  });
});
