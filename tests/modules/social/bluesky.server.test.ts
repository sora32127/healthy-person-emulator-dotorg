import { describe, it, expect, vi, beforeEach } from 'vitest';
import { postToBluesky, deleteFromBluesky, createPostText } from '~/modules/social/bluesky.server';
import type { BlueskyCredentials } from '~/modules/social/types';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const creds: BlueskyCredentials = { user: 'test.bsky.social', password: 'test-pass' };

describe('createPostText', () => {
  it('新規記事のテキストを生成する', () => {
    const text = createPostText('テスト記事', 'new');
    expect(text).toBe('【新規記事】 : テスト記事');
  });
});

describe('postToBluesky', () => {
  beforeEach(() => mockFetch.mockReset());

  it('ログイン→画像アップロード→投稿の3ステップで投稿する', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ did: 'did:plc:test', accessJwt: 'jwt-token' }), {
        status: 200,
      }),
    );
    mockFetch.mockResolvedValueOnce(new Response(new ArrayBuffer(100), { status: 200 }));
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ blob: { ref: { $link: 'bafk...' }, mimeType: 'image/jpeg', size: 100 } }),
        { status: 200 },
      ),
    );
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ uri: 'at://did:plc:test/app.bsky.feed.post/abc123' }), {
        status: 200,
      }),
    );

    const result = await postToBluesky(creds, {
      postTitle: 'テスト',
      postUrl: 'https://example.com/archives/1',
      ogUrl: 'https://static.example.com/ogp/1.jpg',
      messageType: 'new',
    });

    expect(result.providerPostId).toBe('at://did:plc:test/app.bsky.feed.post/abc123');
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });
});

describe('deleteFromBluesky', () => {
  beforeEach(() => mockFetch.mockReset());

  it('at:// URIからrepo/collection/rkeyを抽出して削除する', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ did: 'did:plc:test', accessJwt: 'jwt-token' }), {
        status: 200,
      }),
    );
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));

    await deleteFromBluesky(creds, 'at://did:plc:test/app.bsky.feed.post/abc123');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
