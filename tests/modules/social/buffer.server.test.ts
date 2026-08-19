import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  postToXViaBuffer,
  deleteBufferPost,
  fetchBufferPostState,
  extractXStatusIdFromUrl,
  waitForBufferPostSent,
} from '~/modules/social/buffer.server';

const API_KEY = 'test-api-key';

function mockFetchSequence(responses: Array<{ body: unknown; status?: number }>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  let i = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      const r = responses[Math.min(i, responses.length - 1)];
      i++;
      return new Response(JSON.stringify(r.body), {
        status: r.status ?? 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('postToXViaBuffer', () => {
  it('Xチャンネル解決 → createPost を投げ、Buffer Post ID を返す', async () => {
    const calls = mockFetchSequence([
      { body: { data: { account: { organizations: [{ id: 'org1' }] } } } },
      { body: { data: { channels: [{ id: 'ch1', name: 'X', service: 'twitter' }] } } },
      { body: { data: { createPost: { post: { id: 'buf-123' } } } } },
    ]);

    const res = await postToXViaBuffer(API_KEY, {
      text: 'テスト投稿',
      imageUrl: 'https://static.example.com/ogp/1.png',
    });

    expect(res.bufferPostId).toBe('buf-123');
    expect(calls.length).toBe(3);

    // 認証ヘッダ (Bearer + APIキー)
    const headers = calls[2].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${API_KEY}`);

    // createPost の入力形状
    const body = JSON.parse(calls[2].init.body as string);
    expect(body.variables.input.channelId).toBe('ch1');
    expect(body.variables.input.text).toBe('テスト投稿');
    expect(body.variables.input.schedulingType).toBe('automatic');
    expect(body.variables.input.mode).toBe('shareNow');
    expect(body.variables.input.dueAt).toBeUndefined();
    expect(body.variables.input.assets).toEqual([
      { image: { url: 'https://static.example.com/ogp/1.png' } },
    ]);
  });

  it('画像なしの場合は assets が空配列になる', async () => {
    const calls = mockFetchSequence([
      { body: { data: { account: { organizations: [{ id: 'org1' }] } } } },
      { body: { data: { channels: [{ id: 'ch1', name: 'X', service: 'twitter' }] } } },
      { body: { data: { createPost: { post: { id: 'buf-2' } } } } },
    ]);
    await postToXViaBuffer(API_KEY, { text: 'テキストのみ' });
    const body = JSON.parse(calls[2].init.body as string);
    expect(body.variables.input.assets).toEqual([]);
  });

  it('MutationError が返ると throw する', async () => {
    mockFetchSequence([
      { body: { data: { account: { organizations: [{ id: 'org1' }] } } } },
      { body: { data: { channels: [{ id: 'ch1', name: 'X', service: 'twitter' }] } } },
      { body: { data: { createPost: { message: 'Channel not found' } } } },
    ]);
    await expect(postToXViaBuffer(API_KEY, { text: 'x' })).rejects.toThrow(/Channel not found/);
  });

  it('channelId 指定時はチャンネル解決をスキップし、createPost のみ呼ぶ', async () => {
    const calls = mockFetchSequence([
      { body: { data: { createPost: { post: { id: 'buf-cache-1' } } } } },
    ]);
    const res = await postToXViaBuffer(API_KEY, { text: 'x' }, { channelId: 'ch-x' });
    expect(res.bufferPostId).toBe('buf-cache-1');
    expect(calls.length).toBe(1); // 解決なし・createPost のみ
    const body = JSON.parse(calls[0].init.body as string);
    expect(body.variables.input.channelId).toBe('ch-x');
  });

  it('Xチャンネルが見つからない場合は throw する', async () => {
    mockFetchSequence([
      { body: { data: { account: { organizations: [{ id: 'org1' }] } } } },
      { body: { data: { channels: [{ id: 'c2', name: 'IG', service: 'instagram' }] } } },
    ]);
    await expect(postToXViaBuffer(API_KEY, { text: 'x' })).rejects.toThrow(
      /X \(Twitter\) channel not found/,
    );
  });

  it('HTTP非成功時は本文を含めず throw する（キー漏えい防止）', async () => {
    const calls = mockFetchSequence([
      { body: { data: { account: { organizations: [{ id: 'org1' }] } } } },
      { body: { data: { channels: [{ id: 'ch1', name: 'X', service: 'twitter' }] } } },
      { body: { data: { createPost: { post: { id: 'buf-3' } } } }, status: 500 },
    ]);
    // 最後の1回を HTTP 500 に差し替え
    await postToXViaBuffer(API_KEY, { text: 'x' }).catch((e) => {
      expect(String(e)).not.toContain(API_KEY);
      expect(String(e)).toMatch(/500/);
    });
    expect(calls.length).toBe(3);
  });
});

describe('deleteBufferPost', () => {
  it('成功時にエラーを投げない', async () => {
    const calls = mockFetchSequence([{ body: { data: { deletePost: { id: 'buf-1' } } } }]);
    await expect(deleteBufferPost(API_KEY, 'buf-1')).resolves.toBeUndefined();
    const body = JSON.parse(calls[0].init.body as string);
    expect(body.variables.input.id).toBe('buf-1');
  });

  it('VoidMutationError が返ると throw する', async () => {
    mockFetchSequence([{ body: { data: { deletePost: { message: 'not found' } } } }]);
    await expect(deleteBufferPost(API_KEY, 'buf-1')).rejects.toThrow(/not found/);
  });
});

describe('fetchBufferPostState', () => {
  it('status / externalLink を返す', async () => {
    const calls = mockFetchSequence([
      { body: { data: { post: { status: 'sent', externalLink: 'https://x.com/foo/status/999' } } } },
    ]);
    const s = await fetchBufferPostState(API_KEY, 'buf-1');
    expect(s.status).toBe('sent');
    expect(s.externalLink).toBe('https://x.com/foo/status/999');
    const body = JSON.parse(calls[0].init.body as string);
    expect(body.variables.input.id).toBe('buf-1');
  });
});

describe('extractXStatusIdFromUrl', () => {
  it('URL からツイートIDを抽出する', () => {
    expect(extractXStatusIdFromUrl('https://x.com/foo/status/123456789')).toBe('123456789');
    expect(extractXStatusIdFromUrl('https://twitter.com/foo/status/987654321')).toBe('987654321');
    expect(extractXStatusIdFromUrl(null)).toBeNull();
    expect(extractXStatusIdFromUrl('https://example.com/other')).toBeNull();
    expect(extractXStatusIdFromUrl('')).toBeNull();
  });
});

describe('waitForBufferPostSent', () => {
  it('scheduled → sent に遷移して実XツイートIDを返す', async () => {
    mockFetchSequence([
      { body: { data: { post: { status: 'scheduled', externalLink: null } } } },
      { body: { data: { post: { status: 'sent', externalLink: 'https://x.com/foo/status/777' } } } },
    ]);
    const id = await waitForBufferPostSent(API_KEY, 'buf-1', { pollIntervalMs: 10, maxWaitMs: 2000 });
    expect(id).toBe('777');
  });

  it('タイムアウトすると null を返す', async () => {
    mockFetchSequence([{ body: { data: { post: { status: 'scheduled', externalLink: null } } } }]);
    const id = await waitForBufferPostSent(API_KEY, 'buf-1', { pollIntervalMs: 10, maxWaitMs: 50 });
    expect(id).toBeNull();
  });
});
