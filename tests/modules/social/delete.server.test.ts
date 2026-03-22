import { describe, it, expect, vi } from 'vitest';

vi.mock('~/modules/social/twitter.server', () => ({
  deleteFromTwitter: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('~/modules/social/bluesky.server', () => ({
  deleteFromBluesky: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('~/modules/social/misskey.server', () => ({
  deleteFromMisskey: vi.fn().mockResolvedValue(undefined),
}));

import { deleteFromSocial } from '~/modules/social/delete.server';
import { deleteFromTwitter } from '~/modules/social/twitter.server';
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

describe('deleteFromSocial', () => {
  it('twitterプラットフォームでTwitter削除を呼ぶ', async () => {
    await deleteFromSocial(mockEnv, { platform: 'twitter', providerPostId: 'tweet-123' });
    expect(deleteFromTwitter).toHaveBeenCalled();
  });
});
