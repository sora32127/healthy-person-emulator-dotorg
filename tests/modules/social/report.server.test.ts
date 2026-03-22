import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('~/modules/bigquery.server', () => ({
  queryBigQuery: vi.fn(),
}));
vi.mock('~/modules/social/twitter.server', () => ({
  postToTwitter: vi.fn().mockResolvedValue({ providerPostId: 'tweet-1' }),
  createPostText: vi.fn().mockReturnValue('[殿堂入り] : test'),
  tweetRaw: vi.fn().mockResolvedValue({ providerPostId: 'tweet-weekly' }),
}));

import {
  reportLegendary,
  reportWeekly,
  createWeeklyTweetText,
} from '~/modules/social/report.server';
import { queryBigQuery } from '~/modules/bigquery.server';
import type { CloudflareEnv } from '~/types/env';

const mockEnv = {
  BIGQUERY_CREDENTIALS: JSON.stringify({
    client_email: 'a',
    private_key: 'b',
    private_key_id: 'c',
    project_id: 'd',
  }),
  INTERNAL_API_KEY: 'test-key',
  BASE_URL: 'https://healthy-person-emulator.org',
  SS_TWITTER_CK: { get: vi.fn().mockResolvedValue('ck') },
  SS_TWITTER_CS: { get: vi.fn().mockResolvedValue('cs') },
  SS_TWITTER_AT: { get: vi.fn().mockResolvedValue('at') },
  SS_TWITTER_ATS: { get: vi.fn().mockResolvedValue('ats') },
  SS_AUTOMATION_DRY_RUN: { get: vi.fn().mockResolvedValue('false') },
} as unknown as CloudflareEnv;

describe('createWeeklyTweetText', () => {
  it('週間レポートのテキストを生成する', () => {
    const data = [
      { post_id: '1', post_title: '記事1', vote_count: '10' },
      { post_id: '2', post_title: '記事2', vote_count: '5' },
    ];
    const text = createWeeklyTweetText(data);
    expect(text).toContain('【今週の人気投稿】');
    expect(text).toContain('記事1');
    expect(text).toContain('記事2');
  });
});

describe('reportLegendary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('殿堂入り記事がない場合は何もしない', async () => {
    vi.mocked(queryBigQuery).mockResolvedValue([]);
    const result = await reportLegendary(mockEnv);
    expect(result.processed).toBe(0);
  });
});
