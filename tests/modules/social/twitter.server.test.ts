import { describe, it, expect, vi, beforeEach } from 'vitest';
import { postToTwitter, deleteFromTwitter, createPostText } from '~/modules/social/twitter.server';
import type { TwitterCredentials } from '~/modules/social/types';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const creds: TwitterCredentials = {
  consumerKey: 'test-ck',
  consumerSecret: 'test-cs',
  accessToken: 'test-at',
  accessTokenSecret: 'test-ats',
};

describe('createPostText', () => {
  it('新規記事のテキストを生成する', () => {
    const text = createPostText('テスト記事', 'https://example.com/archives/1', 'new');
    expect(text).toBe(
      '[新規記事] : テスト記事 健常者エミュレータ事例集\nhttps://example.com/archives/1',
    );
  });

  it('殿堂入りのテキストを生成する', () => {
    const text = createPostText('殿堂記事', 'https://example.com/archives/2', 'legendary');
    expect(text).toContain('[殿堂入り]');
  });

  it('不明なmessageTypeでエラーを投げる', () => {
    expect(() => createPostText('test', 'url', 'unknown')).toThrow('Unknown message type');
  });
});

describe('postToTwitter', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('OGP画像をアップロードしてツイートを作成する', async () => {
    mockFetch.mockResolvedValueOnce(new Response(new ArrayBuffer(100), { status: 200 }));
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ media_id_string: '12345' }), { status: 200 }),
    );
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: '67890' } }), { status: 201 }),
    );

    const result = await postToTwitter(creds, {
      postTitle: 'テスト',
      postUrl: 'https://example.com/archives/1',
      ogUrl: 'https://static.example.com/ogp/1.jpg',
      messageType: 'new',
    });

    expect(result.providerPostId).toBe('67890');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('ogUrlが空の場合はテキストのみでツイートする', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: '11111' } }), { status: 201 }),
    );

    const result = await postToTwitter(creds, {
      postTitle: 'テスト',
      postUrl: 'https://example.com/archives/1',
      ogUrl: '',
      messageType: 'legendary',
    });

    expect(result.providerPostId).toBe('11111');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe('deleteFromTwitter', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('ツイートを削除する', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { deleted: true } }), { status: 200 }),
    );

    await deleteFromTwitter(creds, '67890');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.x.com/2/tweets/67890');
  });
});
