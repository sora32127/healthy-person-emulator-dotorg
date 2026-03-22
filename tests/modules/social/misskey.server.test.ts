import { describe, it, expect, vi, beforeEach } from 'vitest';
import { postToMisskey, deleteFromMisskey } from '../../../app/modules/social/misskey.server';
import type { MisskeyCredentials } from '../../../app/modules/social/types';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const creds: MisskeyCredentials = { token: 'test-token' };

describe('postToMisskey', () => {
  beforeEach(() => mockFetch.mockReset());

  it('画像アップロード→ノート作成の2ステップで投稿する', async () => {
    mockFetch.mockResolvedValueOnce(new Response(new ArrayBuffer(100), { status: 200 }));
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'file-123' }), { status: 200 }),
    );
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ createdNote: { id: 'note-456' } }), { status: 200 }),
    );

    const result = await postToMisskey(creds, {
      postTitle: 'テスト',
      postUrl: 'https://example.com/archives/1',
      ogUrl: 'https://static.example.com/ogp/1.jpg',
      messageType: 'new',
    });

    expect(result.providerPostId).toBe('note-456');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});

describe('deleteFromMisskey', () => {
  beforeEach(() => mockFetch.mockReset());

  it('ノートを削除する', async () => {
    mockFetch.mockResolvedValueOnce(new Response('', { status: 204 }));

    await deleteFromMisskey(creds, 'note-456');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
