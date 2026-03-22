# SNS Worker Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SNS投稿/削除/レポート機能をPythonコンテナからCloudflare Worker（TypeScript）に移植し、コンテナDOクラッシュによるSNS連携停止を根本的に解消する。

**Architecture:** 現在Pythonコンテナ経由で行っているSNS API呼び出し（Twitter/Bluesky/Misskey）をWorker内のTypeScript関数に置き換える。Twitter OAuth 1.0a署名には`oauth-1.0a`パッケージを使用。BigQuery呼び出しは既存の`jose`パッケージによるJWT認証パターンを踏襲。OGP画像生成のみコンテナに残す。併せて24時間ウィンドウ制限撤廃とハートビート監視を追加する。

**Tech Stack:** TypeScript, Cloudflare Workers, oauth-1.0a, jose, fetch API

**Background — 今回のインシデント:**
- AutomationContainer（Durable Object）がプラットフォーム側のコードリセットで"Network connection lost"のクラッシュループに陥った
- Cronの`callContainer()`が全て失敗し、10時間以上SNS連携が停止した
- エラーはログに出力されるのみで外部通知なし。24時間ウィンドウ制限により、停止が長引くと投稿が永久にスキップされるリスクがあった

---

## File Structure

### 新規作成
| ファイル | 責務 |
|---|---|
| `app/modules/social/twitter.server.ts` | Twitter API v1（メディアアップロード）+ v2（ツイート作成/削除）クライアント |
| `app/modules/social/bluesky.server.ts` | Bluesky AT Protocol クライアント（ログイン、blob upload、投稿、削除） |
| `app/modules/social/misskey.server.ts` | Misskey REST API クライアント（ファイルアップロード、ノート作成、削除） |
| `app/modules/social/post.server.ts` | SNS投稿の統合ディスパッチャー（platform → 各クライアント呼び出し） |
| `app/modules/social/delete.server.ts` | SNS削除の統合ディスパッチャー |
| `app/modules/social/types.ts` | 共通型定義（Platform, PostParams, PostResult等） |
| `app/modules/bigquery.server.ts` | BigQuery REST API クライアント（JWT認証、クエリ実行） |
| `app/modules/social/report.server.ts` | 殿堂入り/週間レポートのロジック |
| `tests/modules/social/twitter.server.test.ts` | Twitter クライアントのテスト |
| `tests/modules/social/bluesky.server.test.ts` | Bluesky クライアントのテスト |
| `tests/modules/social/misskey.server.test.ts` | Misskey クライアントのテスト |
| `tests/modules/social/post.server.test.ts` | SNS投稿ディスパッチャーのテスト |
| `tests/modules/social/delete.server.test.ts` | SNS削除ディスパッチャーのテスト |
| `tests/modules/bigquery.server.test.ts` | BigQuery クライアントのテスト |
| `tests/modules/social/report.server.test.ts` | レポートのテスト |

### 変更
| ファイル | 変更内容 |
|---|---|
| `app/modules/automation.server.ts` | `handleSocialPostConsumer`から`callContainer('/post-social')`を削除し、`social/post.server.ts`の関数を直接呼ぶ |
| `app/modules/admin-delete.server.ts` | `callContainer('/delete-social')`を`social/delete.server.ts`の関数に置き換え |
| `worker.ts` | Cronハンドラで`callContainer('/report-legendary')`と`callContainer('/report-weekly')`を`social/report.server.ts`の関数に置き換え。ハートビートping追加 |
| `app/routes/api.internal.$.tsx` | `handlePostsForOgp`の24時間制限を撤廃し、LIMIT 5を追加 |
| `app/types/env.ts` | `BIGQUERY_CREDENTIALS`を必須フィールドに変更（`?`除去）。`HEALTHCHECK_URL`追加 |
| `wrangler.toml` | `HEALTHCHECK_URL`環境変数追加 |
| `package.json` | `oauth-1.0a`依存追加 |

---

## Task 1: 共通型定義 + oauth-1.0aインストール

**Files:**
- Create: `app/modules/social/types.ts`
- Modify: `package.json`

- [ ] **Step 1: oauth-1.0aパッケージをインストール**

```bash
pnpm add oauth-1.0a
```

- [ ] **Step 2: 共通型定義ファイルを作成**

`app/modules/social/types.ts`:
```typescript
export const PLATFORMS = ['twitter', 'bluesky', 'activitypub'] as const;
export type Platform = (typeof PLATFORMS)[number];

export interface SocialPostParams {
  platform: Platform;
  postTitle: string;
  postUrl: string;
  ogUrl: string;
  messageType: 'new' | 'legendary' | 'random';
}

export interface SocialPostResult {
  providerPostId: string;
}

export interface SocialDeleteParams {
  platform: Platform;
  providerPostId: string;
}

export interface TwitterCredentials {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

export interface BlueskyCredentials {
  user: string;
  password: string;
}

export interface MisskeyCredentials {
  token: string;
}

export const TYPE_PREFIX: Record<string, string> = {
  new: '新規記事',
  legendary: '殿堂入り',
  random: 'ランダム',
};
```

- [ ] **Step 3: env.tsにBIGQUERY_CREDENTIALSを追加**

`app/types/env.ts` に追加（`GCS_CREDENTIALS`の近くに）:
```typescript
  // BigQuery (SA key JSON — used by report tasks)
  BIGQUERY_CREDENTIALS: string;
```

注: `BIGQUERY_CREDENTIALS`はコンテナの環境変数として既に`resolveSecrets`で渡されているが、Worker secretとしても`wrangler secret put BIGQUERY_CREDENTIALS`で設定済みであることを確認すること。

- [ ] **Step 4: Commit**

```bash
git add app/modules/social/types.ts app/types/env.ts package.json pnpm-lock.yaml
git commit -m "chore: oauth-1.0aを追加し、SNS共通型定義とBIGQUERY_CREDENTIALS型を作成した"
```

---

## Task 2: Twitter クライアント

**Files:**
- Create: `app/modules/social/twitter.server.ts`
- Create: `tests/modules/social/twitter.server.test.ts`

**参考:** Python実装 `container/tasks/post_tweet.py`
- tweepy OAuth1UserHandler で署名 → v1 `media/upload` でOGP画像アップロード → v2 `tweets` でツイート作成
- 削除: v2 `DELETE /2/tweets/:id`

- [ ] **Step 1: テストファイルを作成**

`tests/modules/social/twitter.server.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { postToTwitter, deleteFromTwitter, createPostText } from '~/modules/social/twitter.server';
import type { TwitterCredentials } from '~/modules/social/types';

// Mock global fetch
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
    expect(text).toBe('[新規記事] : テスト記事 健常者エミュレータ事例集\nhttps://example.com/archives/1');
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
    // 1. OGP画像のfetch
    mockFetch.mockResolvedValueOnce(new Response(new ArrayBuffer(100), { status: 200 }));
    // 2. メディアアップロード (v1)
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ media_id_string: '12345' }), { status: 200 }));
    // 3. ツイート作成 (v2)
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: '67890' } }), { status: 201 }));

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
    // 1. ツイート作成 (v2) — メディアアップロードなし
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: '11111' } }), { status: 201 }));

    const result = await postToTwitter(creds, {
      postTitle: 'テスト',
      postUrl: 'https://example.com/archives/1',
      ogUrl: '',
      messageType: 'legendary',
    });

    expect(result.providerPostId).toBe('11111');
    expect(mockFetch).toHaveBeenCalledTimes(1); // fetch for OGP image skipped
  });
});

describe('deleteFromTwitter', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('ツイートを削除する', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ data: { deleted: true } }), { status: 200 }));

    await deleteFromTwitter(creds, '67890');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.x.com/2/tweets/67890');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
pnpm test -- tests/modules/social/twitter.server.test.ts
```
Expected: FAIL — モジュールが存在しない

- [ ] **Step 3: Twitter クライアントを実装**

`app/modules/social/twitter.server.ts`:
```typescript
/**
 * Twitter API client for Cloudflare Workers.
 * Uses OAuth 1.0a for authentication.
 * - Media upload: v1 API (POST https://upload.twitter.com/1.1/media/upload.json)
 * - Tweet creation: v2 API (POST https://api.x.com/2/tweets)
 * - Tweet deletion: v2 API (DELETE https://api.x.com/2/tweets/:id)
 */

import OAuth from 'oauth-1.0a';
import { createHmac } from 'node:crypto';
import { TYPE_PREFIX } from './types';
import type { TwitterCredentials, SocialPostResult } from './types';

export function createPostText(postTitle: string, postUrl: string, messageType: string): string {
  const prefix = TYPE_PREFIX[messageType];
  if (!prefix) throw new Error(`Unknown message type: ${messageType}`);
  return `[${prefix}] : ${postTitle} 健常者エミュレータ事例集\n${postUrl}`;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function createOAuth(creds: TwitterCredentials): OAuth {
  return new OAuth({
    consumer: { key: creds.consumerKey, secret: creds.consumerSecret },
    signature_method: 'HMAC-SHA1',
    hash_function(baseString, key) {
      return createHmac('sha1', key).update(baseString).digest('base64');
    },
  });
}

export function getAuthHeader(
  oauth: OAuth,
  creds: TwitterCredentials,
  request: { url: string; method: string },
): string {
  const token = { key: creds.accessToken, secret: creds.accessTokenSecret };
  const authorized = oauth.authorize(request, token);
  return oauth.toHeader(authorized).Authorization;
}

async function uploadMedia(creds: TwitterCredentials, imageData: ArrayBuffer): Promise<string> {
  const oauth = createOAuth(creds);

  const formData = new FormData();
  formData.append('media_data', arrayBufferToBase64(imageData));

  const url = 'https://upload.twitter.com/1.1/media/upload.json';
  const authHeader = getAuthHeader(oauth, creds, { url, method: 'POST' });

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: authHeader },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twitter media upload failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { media_id_string: string };
  return data.media_id_string;
}

/**
 * Create a tweet. If ogUrl is provided, uploads it as media.
 * If ogUrl is empty/undefined, creates a text-only tweet.
 */
export async function postToTwitter(
  creds: TwitterCredentials,
  params: { postTitle: string; postUrl: string; ogUrl?: string; messageType: string },
): Promise<SocialPostResult> {
  const text = createPostText(params.postTitle, params.postUrl, params.messageType);

  let mediaId: string | undefined;
  if (params.ogUrl) {
    // 1. Download OGP image
    const imageRes = await fetch(params.ogUrl);
    if (!imageRes.ok) throw new Error(`Failed to fetch OGP image: ${imageRes.status}`);
    const imageData = await imageRes.arrayBuffer();

    // 2. Upload media
    mediaId = await uploadMedia(creds, imageData);
  }

  // 3. Create tweet (v2 API)
  const oauth = createOAuth(creds);
  const tweetUrl = 'https://api.x.com/2/tweets';
  const tweetBody: Record<string, unknown> = { text };
  if (mediaId) {
    tweetBody.media = { media_ids: [mediaId] };
  }
  const body = JSON.stringify(tweetBody);
  const authHeader = getAuthHeader(oauth, creds, { url: tweetUrl, method: 'POST' });

  const res = await fetch(tweetUrl, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Twitter create tweet failed (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { data: { id: string } };
  return { providerPostId: data.data.id };
}

/**
 * Post a raw text tweet (no media, no formatting).
 * Used by weekly summary and other custom-format tweets.
 */
export async function tweetRaw(creds: TwitterCredentials, text: string): Promise<SocialPostResult> {
  const oauth = createOAuth(creds);
  const tweetUrl = 'https://api.x.com/2/tweets';
  const authHeader = getAuthHeader(oauth, creds, { url: tweetUrl, method: 'POST' });

  const res = await fetch(tweetUrl, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Twitter create tweet failed (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { data: { id: string } };
  return { providerPostId: data.data.id };
}

export async function deleteFromTwitter(creds: TwitterCredentials, tweetId: string): Promise<void> {
  const oauth = createOAuth(creds);
  const url = `https://api.x.com/2/tweets/${tweetId}`;
  const authHeader = getAuthHeader(oauth, creds, { url, method: 'DELETE' });

  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: authHeader },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twitter delete failed (${res.status}): ${text}`);
  }
}
```

- [ ] **Step 4: テストを実行して通ることを確認**

```bash
pnpm test -- tests/modules/social/twitter.server.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/modules/social/twitter.server.ts tests/modules/social/twitter.server.test.ts
git commit -m "feat: Twitter APIクライアントをTypeScriptで実装した

OAuth 1.0aでメディアアップロード(v1)とツイート作成/削除(v2)を行う"
```

---

## Task 3: Bluesky クライアント

**Files:**
- Create: `app/modules/social/bluesky.server.ts`
- Create: `tests/modules/social/bluesky.server.test.ts`

**参考:** Python実装 `container/tasks/post_bluesky.py`
- AT Protocol: `com.atproto.server.createSession` → `com.atproto.repo.uploadBlob` → `com.atproto.repo.createRecord`
- テキストフォーマット: `【新規記事】 : {title}` （URLはembedに含む、テキストには含まない）
- 削除: `com.atproto.repo.deleteRecord`

- [ ] **Step 1: テストファイルを作成**

`tests/modules/social/bluesky.server.test.ts`:
```typescript
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
    // 1. Login (createSession)
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ did: 'did:plc:test', accessJwt: 'jwt-token' }), { status: 200 }));
    // 2. OGP image download
    mockFetch.mockResolvedValueOnce(new Response(new ArrayBuffer(100), { status: 200 }));
    // 3. Upload blob
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ blob: { ref: { '$link': 'bafk...' }, mimeType: 'image/jpeg', size: 100 } }), { status: 200 }));
    // 4. Create record
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ uri: 'at://did:plc:test/app.bsky.feed.post/abc123' }), { status: 200 }));

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
    // 1. Login
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ did: 'did:plc:test', accessJwt: 'jwt-token' }), { status: 200 }));
    // 2. Delete record
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));

    await deleteFromBluesky(creds, 'at://did:plc:test/app.bsky.feed.post/abc123');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
pnpm test -- tests/modules/social/bluesky.server.test.ts
```

- [ ] **Step 3: Bluesky クライアントを実装**

`app/modules/social/bluesky.server.ts`:
```typescript
/**
 * Bluesky (AT Protocol) client for Cloudflare Workers.
 * All calls use fetch() against bsky.social XRPC endpoints.
 */

import { TYPE_PREFIX } from './types';
import type { BlueskyCredentials, SocialPostResult } from './types';

const BASE_URL = 'https://bsky.social/xrpc';

export function createPostText(postTitle: string, messageType: string): string {
  const prefix = TYPE_PREFIX[messageType];
  if (!prefix) throw new Error(`Unknown message type: ${messageType}`);
  return `【${prefix}】 : ${postTitle}`;
}

interface BlueskySession {
  did: string;
  accessJwt: string;
}

async function login(creds: BlueskyCredentials): Promise<BlueskySession> {
  const res = await fetch(`${BASE_URL}/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: creds.user, password: creds.password }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bluesky login failed (${res.status}): ${text}`);
  }
  return (await res.json()) as BlueskySession;
}

async function uploadBlob(session: BlueskySession, imageData: ArrayBuffer): Promise<unknown> {
  const res = await fetch(`${BASE_URL}/com.atproto.repo.uploadBlob`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.accessJwt}`,
      'Content-Type': 'image/jpeg',
    },
    body: imageData,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bluesky blob upload failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as { blob: unknown };
  return data.blob;
}

export async function postToBluesky(
  creds: BlueskyCredentials,
  params: { postTitle: string; postUrl: string; ogUrl: string; messageType: string },
): Promise<SocialPostResult> {
  const session = await login(creds);
  const text = createPostText(params.postTitle, params.messageType);

  // Download OGP image
  const imageRes = await fetch(params.ogUrl);
  if (!imageRes.ok) throw new Error(`Failed to fetch OGP image: ${imageRes.status}`);
  const imageData = await imageRes.arrayBuffer();

  // Upload blob
  const blob = await uploadBlob(session, imageData);

  // Create post with external embed
  const res = await fetch(`${BASE_URL}/com.atproto.repo.createRecord`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.accessJwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      repo: session.did,
      collection: 'app.bsky.feed.post',
      record: {
        $type: 'app.bsky.feed.post',
        text,
        embed: {
          $type: 'app.bsky.embed.external',
          external: {
            uri: params.postUrl,
            title: params.postTitle,
            description: '',
            thumb: blob,
          },
        },
        createdAt: new Date().toISOString(),
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Bluesky create post failed (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { uri: string };
  return { providerPostId: data.uri };
}

export async function deleteFromBluesky(creds: BlueskyCredentials, postUri: string): Promise<void> {
  const session = await login(creds);

  // Parse at://did:plc:xxx/app.bsky.feed.post/yyy
  const parts = postUri.replace('at://', '').split('/');
  const repo = parts[0];
  const collection = parts[1];
  const rkey = parts[2];

  const res = await fetch(`${BASE_URL}/com.atproto.repo.deleteRecord`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.accessJwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ repo, collection, rkey }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bluesky delete failed (${res.status}): ${text}`);
  }
}
```

- [ ] **Step 4: テストを実行して通ることを確認**

```bash
pnpm test -- tests/modules/social/bluesky.server.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add app/modules/social/bluesky.server.ts tests/modules/social/bluesky.server.test.ts
git commit -m "feat: Bluesky APIクライアントをTypeScriptで実装した

AT Protocol XRPC経由でログイン・画像アップロード・投稿・削除を行う"
```

---

## Task 4: Misskey クライアント

**Files:**
- Create: `app/modules/social/misskey.server.ts`
- Create: `tests/modules/social/misskey.server.test.ts`

**参考:** Python実装 `container/tasks/post_activitypub.py`
- `drive/files/create` でファイルアップロード → `notes/create` でノート作成
- テキストフォーマット: `[新規記事] : {title} 健常者エミュレータ事例集\n{url}` （Twitterと同じ）
- 削除: `notes/delete`

- [ ] **Step 1: テストファイルを作成**

`tests/modules/social/misskey.server.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { postToMisskey, deleteFromMisskey } from '~/modules/social/misskey.server';
import type { MisskeyCredentials } from '~/modules/social/types';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const creds: MisskeyCredentials = { token: 'test-token' };

describe('postToMisskey', () => {
  beforeEach(() => mockFetch.mockReset());

  it('画像アップロード→ノート作成の2ステップで投稿する', async () => {
    // 1. OGP image download
    mockFetch.mockResolvedValueOnce(new Response(new ArrayBuffer(100), { status: 200 }));
    // 2. Drive file upload
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ id: 'file-123' }), { status: 200 }));
    // 3. Note create
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ createdNote: { id: 'note-456' } }), { status: 200 }));

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
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
pnpm test -- tests/modules/social/misskey.server.test.ts
```

- [ ] **Step 3: Misskey クライアントを実装**

`app/modules/social/misskey.server.ts`:
```typescript
/**
 * Misskey REST API client for Cloudflare Workers.
 * Targets misskey.io.
 */

import { TYPE_PREFIX } from './types';
import type { MisskeyCredentials, SocialPostResult } from './types';

const BASE_URL = 'https://misskey.io/api';

export function createPostText(postTitle: string, postUrl: string, messageType: string): string {
  const prefix = TYPE_PREFIX[messageType];
  if (!prefix) throw new Error(`Unknown message type: ${messageType}`);
  return `[${prefix}] : ${postTitle} 健常者エミュレータ事例集\n${postUrl}`;
}

async function uploadFile(creds: MisskeyCredentials, imageData: ArrayBuffer): Promise<string> {
  const formData = new FormData();
  formData.append('i', creds.token);
  formData.append('file', new Blob([imageData], { type: 'image/jpeg' }), 'og_image.jpg');

  const res = await fetch(`${BASE_URL}/drive/files/create`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Misskey file upload failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { id: string };
  return data.id;
}

export async function postToMisskey(
  creds: MisskeyCredentials,
  params: { postTitle: string; postUrl: string; ogUrl: string; messageType: string },
): Promise<SocialPostResult> {
  const text = createPostText(params.postTitle, params.postUrl, params.messageType);

  // Download OGP image
  const imageRes = await fetch(params.ogUrl);
  if (!imageRes.ok) throw new Error(`Failed to fetch OGP image: ${imageRes.status}`);
  const imageData = await imageRes.arrayBuffer();

  // Upload file to drive
  const fileId = await uploadFile(creds, imageData);

  // Create note
  const res = await fetch(`${BASE_URL}/notes/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      i: creds.token,
      text,
      fileIds: [fileId],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Misskey create note failed (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { createdNote: { id: string } };
  return { providerPostId: data.createdNote.id };
}

export async function deleteFromMisskey(creds: MisskeyCredentials, noteId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/notes/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ i: creds.token, noteId }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Misskey delete failed (${res.status}): ${text}`);
  }
}
```

- [ ] **Step 4: テストを実行して通ることを確認**

```bash
pnpm test -- tests/modules/social/misskey.server.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add app/modules/social/misskey.server.ts tests/modules/social/misskey.server.test.ts
git commit -m "feat: Misskey APIクライアントをTypeScriptで実装した

REST API経由でドライブアップロード・ノート作成・削除を行う"
```

---

## Task 5: SNS投稿/削除ディスパッチャー

**Files:**
- Create: `app/modules/social/post.server.ts`
- Create: `app/modules/social/delete.server.ts`
- Create: `tests/modules/social/post.server.test.ts`
- Create: `tests/modules/social/delete.server.test.ts`

- [ ] **Step 1: テストファイルを作成**

`tests/modules/social/post.server.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the individual clients
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

// Minimal env mock for Secrets Store
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
```

`tests/modules/social/delete.server.test.ts`:
```typescript
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
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
pnpm test -- tests/modules/social/post.server.test.ts tests/modules/social/delete.server.test.ts
```

- [ ] **Step 3: ディスパッチャーを実装**

`app/modules/social/post.server.ts`:
```typescript
/**
 * SNS posting dispatcher.
 * Routes post requests to the appropriate platform client.
 */

import type { CloudflareEnv } from '~/types/env';
import type { SocialPostParams, SocialPostResult } from './types';
import { postToTwitter } from './twitter.server';
import { postToBluesky } from './bluesky.server';
import { postToMisskey } from './misskey.server';

export async function postToSocial(
  env: CloudflareEnv,
  params: SocialPostParams,
): Promise<SocialPostResult> {
  const dryRun = (await env.SS_AUTOMATION_DRY_RUN.get()) === 'true';
  if (dryRun) {
    console.log(`[social] DRY RUN: would post to ${params.platform}: ${params.postTitle}`);
    return { providerPostId: 'dry-run' };
  }

  switch (params.platform) {
    case 'twitter': {
      const creds = {
        consumerKey: await env.SS_TWITTER_CK.get(),
        consumerSecret: await env.SS_TWITTER_CS.get(),
        accessToken: await env.SS_TWITTER_AT.get(),
        accessTokenSecret: await env.SS_TWITTER_ATS.get(),
      };
      return postToTwitter(creds, params);
    }
    case 'bluesky': {
      const creds = {
        user: await env.SS_BLUESKY_USER.get(),
        password: await env.SS_BLUESKY_PASSWORD.get(),
      };
      return postToBluesky(creds, params);
    }
    case 'activitypub': {
      const creds = { token: await env.SS_MISSKEY_TOKEN.get() };
      return postToMisskey(creds, params);
    }
    default:
      throw new Error(`Unknown platform: ${params.platform}`);
  }
}
```

`app/modules/social/delete.server.ts`:
```typescript
/**
 * SNS deletion dispatcher.
 */

import type { CloudflareEnv } from '~/types/env';
import type { SocialDeleteParams } from './types';
import { deleteFromTwitter } from './twitter.server';
import { deleteFromBluesky } from './bluesky.server';
import { deleteFromMisskey } from './misskey.server';

export async function deleteFromSocial(
  env: CloudflareEnv,
  params: SocialDeleteParams,
): Promise<void> {
  const dryRun = (await env.SS_AUTOMATION_DRY_RUN.get()) === 'true';
  if (dryRun) {
    console.log(`[social] DRY RUN: would delete ${params.platform}: ${params.providerPostId}`);
    return;
  }

  switch (params.platform) {
    case 'twitter': {
      const creds = {
        consumerKey: await env.SS_TWITTER_CK.get(),
        consumerSecret: await env.SS_TWITTER_CS.get(),
        accessToken: await env.SS_TWITTER_AT.get(),
        accessTokenSecret: await env.SS_TWITTER_ATS.get(),
      };
      return deleteFromTwitter(creds, params.providerPostId);
    }
    case 'bluesky': {
      const creds = {
        user: await env.SS_BLUESKY_USER.get(),
        password: await env.SS_BLUESKY_PASSWORD.get(),
      };
      return deleteFromBluesky(creds, params.providerPostId);
    }
    case 'activitypub': {
      const creds = { token: await env.SS_MISSKEY_TOKEN.get() };
      return deleteFromMisskey(creds, params.providerPostId);
    }
    default:
      throw new Error(`Unknown platform: ${params.platform}`);
  }
}
```

- [ ] **Step 4: テストを実行して通ることを確認**

```bash
pnpm test -- tests/modules/social/post.server.test.ts tests/modules/social/delete.server.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add app/modules/social/post.server.ts app/modules/social/delete.server.ts tests/modules/social/post.server.test.ts tests/modules/social/delete.server.test.ts
git commit -m "feat: SNS投稿/削除のディスパッチャーを実装した

プラットフォームに応じてTwitter/Bluesky/Misskeyクライアントを呼び分ける"
```

---

## Task 6: BigQuery クライアント + レポート機能

**Files:**
- Create: `app/modules/bigquery.server.ts`
- Create: `app/modules/social/report.server.ts`
- Create: `tests/modules/bigquery.server.test.ts`
- Create: `tests/modules/social/report.server.test.ts`

**参考:**
- `app/modules/gcs-export.server.ts:46-86` — JWT認証パターン（`jose`使用）
- `container/tasks/report_legendary_article.py` — BQクエリ + タグ付けAPI + ツイート
- `container/tasks/report_weekly_summary.py` — BQクエリ + ツイート
- BQクエリのスコープ: `https://www.googleapis.com/auth/bigquery.readonly`

- [ ] **Step 1: BigQueryクライアントのテストを作成**

`tests/modules/bigquery.server.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { queryBigQuery } from '~/modules/bigquery.server';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock jose
vi.mock('jose', () => ({
  importPKCS8: vi.fn().mockResolvedValue('mock-key'),
  SignJWT: vi.fn().mockImplementation(() => ({
    setProtectedHeader: vi.fn().mockReturnThis(),
    setIssuer: vi.fn().mockReturnThis(),
    setSubject: vi.fn().mockReturnThis(),
    setAudience: vi.fn().mockReturnThis(),
    setIssuedAt: vi.fn().mockReturnThis(),
    setExpirationTime: vi.fn().mockReturnThis(),
    sign: vi.fn().mockResolvedValue('mock-jwt'),
  })),
}));

describe('queryBigQuery', () => {
  beforeEach(() => mockFetch.mockReset());

  it('クエリを実行して結果を返す', async () => {
    // 1. OAuth2 token exchange
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'bq-token' }), { status: 200 }));
    // 2. BQ query
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      rows: [
        { f: [{ v: '123' }, { v: 'テスト記事' }] },
      ],
      schema: { fields: [{ name: 'post_id' }, { name: 'post_title' }] },
    }), { status: 200 }));

    const credsJson = JSON.stringify({
      client_email: 'test@test.iam.gserviceaccount.com',
      private_key: 'fake-key',
      private_key_id: 'kid',
      project_id: 'test-project',
    });

    const rows = await queryBigQuery(credsJson, 'SELECT * FROM table');
    expect(rows).toEqual([{ post_id: '123', post_title: 'テスト記事' }]);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
pnpm test -- tests/modules/bigquery.server.test.ts
```

- [ ] **Step 3: BigQueryクライアントを実装**

`app/modules/bigquery.server.ts`:
```typescript
/**
 * BigQuery REST API client for Cloudflare Workers.
 * Uses jose for JWT signing (same pattern as gcs-export.server.ts).
 */

import { SignJWT, importPKCS8 } from 'jose';

interface BQCredentials {
  client_email: string;
  private_key: string;
  private_key_id: string;
  project_id: string;
}

async function getAccessToken(creds: BQCredentials): Promise<string> {
  const privateKey = await importPKCS8(creds.private_key, 'RS256');

  const jwt = await new SignJWT({
    scope: 'https://www.googleapis.com/auth/bigquery.readonly',
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT', kid: creds.private_key_id })
    .setIssuer(creds.client_email)
    .setSubject(creds.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`BigQuery OAuth2 token failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export async function queryBigQuery(
  credentialsJson: string,
  query: string,
): Promise<Record<string, unknown>[]> {
  const creds = JSON.parse(credentialsJson) as BQCredentials;
  const token = await getAccessToken(creds);

  const res = await fetch(
    `https://bigquery.googleapis.com/bigquery/v2/projects/${creds.project_id}/queries`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, useLegacySql: false }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`BigQuery query failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    schema: { fields: Array<{ name: string }> };
    rows?: Array<{ f: Array<{ v: unknown }> }>;
  };

  if (!data.rows) return [];

  const fieldNames = data.schema.fields.map((f) => f.name);
  return data.rows.map((row) => {
    const obj: Record<string, unknown> = {};
    row.f.forEach((cell, i) => {
      obj[fieldNames[i]] = cell.v;
    });
    return obj;
  });
}
```

- [ ] **Step 4: テストを実行して通ることを確認**

```bash
pnpm test -- tests/modules/bigquery.server.test.ts
```

- [ ] **Step 5: レポートのテストを作成**

`tests/modules/social/report.server.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('~/modules/bigquery.server', () => ({
  queryBigQuery: vi.fn(),
}));
vi.mock('~/modules/social/twitter.server', () => ({
  postToTwitter: vi.fn().mockResolvedValue({ providerPostId: 'tweet-1' }),
  createPostText: vi.fn().mockReturnValue('[殿堂入り] : test'),
}));

import { reportLegendary, reportWeekly, createWeeklyTweetText } from '~/modules/social/report.server';
import { queryBigQuery } from '~/modules/bigquery.server';
import type { CloudflareEnv } from '~/types/env';

const mockEnv = {
  BIGQUERY_CREDENTIALS: JSON.stringify({ client_email: 'a', private_key: 'b', private_key_id: 'c', project_id: 'd' }),
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
```

- [ ] **Step 6: レポート機能を実装**

`app/modules/social/report.server.ts`:
```typescript
/**
 * SNS report tasks (legendary articles, weekly summary).
 * Ported from container/tasks/report_legendary_article.py and report_weekly_summary.py.
 */

import type { CloudflareEnv } from '~/types/env';
import { queryBigQuery } from '~/modules/bigquery.server';
import { postToTwitter, tweetRaw } from './twitter.server';
import type { TwitterCredentials } from './types';

function requireBigQueryCredentials(env: CloudflareEnv): string {
  if (!env.BIGQUERY_CREDENTIALS) {
    throw new Error('BIGQUERY_CREDENTIALS is not configured');
  }
  return env.BIGQUERY_CREDENTIALS;
}

async function getTwitterCreds(env: CloudflareEnv): Promise<TwitterCredentials> {
  return {
    consumerKey: await env.SS_TWITTER_CK.get(),
    consumerSecret: await env.SS_TWITTER_CS.get(),
    accessToken: await env.SS_TWITTER_AT.get(),
    accessTokenSecret: await env.SS_TWITTER_ATS.get(),
  };
}

// --- Legendary articles ---

export async function reportLegendary(
  env: CloudflareEnv,
): Promise<{ processed: number }> {
  const bqCreds = requireBigQueryCredentials(env);
  const articles = await queryBigQuery(
    bqCreds,
    'SELECT * FROM `healthy-person-emulator.HPE_REPORTS.report_new_legend_posts`',
  );

  if (articles.length === 0) {
    return { processed: 0 };
  }

  // Add "殿堂入り" tag (tagId=575) via internal API
  for (const article of articles) {
    const postId = article.post_id as number;
    await fetch(`${env.BASE_URL}/api/internal/add-tag-to-post`, {
      method: 'POST',
      headers: {
        'X-API-Key': env.INTERNAL_API_KEY,
        'Content-Type': 'application/json',
        'User-Agent': 'HPE-Automation-Worker/1.0',
      },
      body: JSON.stringify({ postId, tagId: 575 }),
    });
  }

  const dryRun = (await env.SS_AUTOMATION_DRY_RUN.get()) === 'true';
  if (dryRun) {
    console.log(`[report] DRY RUN: would tweet ${articles.length} legendary articles`);
    return { processed: articles.length };
  }

  // Legendary tweets are text-only (no media), same as Python impl
  const creds = await getTwitterCreds(env);
  for (const article of articles) {
    const postId = article.post_id as number;
    const postTitle = article.post_title as string;
    const postUrl = `https://healthy-person-emulator.org/archives/${postId}`;

    await postToTwitter(creds, {
      postTitle,
      postUrl,
      messageType: 'legendary',
    });
  }

  return { processed: articles.length };
}

// --- Weekly summary ---

export function createWeeklyTweetText(
  weeklyData: Array<Record<string, unknown>>,
): string {
  let text = '【今週の人気投稿】\n';
  const top3 = weeklyData.slice(0, 3);
  for (let i = 0; i < top3.length; i++) {
    const post = top3[i];
    const postUrl = `https://healthy-person-emulator.org/archives/${post.post_id}`;
    text += `\n${i + 1} : ${post.post_title} \n${postUrl}\n`;
  }
  // Duplicate first URL at end — triggers Twitter's OG card preview
  text += `\nhttps://healthy-person-emulator.org/archives/${weeklyData[0].post_id}`;
  return text;
}

export async function reportWeekly(
  env: CloudflareEnv,
): Promise<{ posted: boolean }> {
  const bqCreds = requireBigQueryCredentials(env);
  const weeklyData = await queryBigQuery(
    bqCreds,
    'SELECT * FROM `healthy-person-emulator.HPE_REPORTS.report_weekly_summary`',
  );

  if (weeklyData.length === 0) {
    return { posted: false };
  }

  const tweetText = createWeeklyTweetText(weeklyData);

  const dryRun = (await env.SS_AUTOMATION_DRY_RUN.get()) === 'true';
  if (dryRun) {
    console.log(`[report] DRY RUN: would tweet weekly summary:\n${tweetText}`);
    return { posted: false };
  }

  // Weekly summary uses custom text format — use tweetRaw (text-only, no media)
  const creds = await getTwitterCreds(env);
  await tweetRaw(creds, tweetText);

  return { posted: true };
}
```

- [ ] **Step 7: テストを実行して通ることを確認**

```bash
pnpm test -- tests/modules/bigquery.server.test.ts tests/modules/social/report.server.test.ts
```

- [ ] **Step 8: Commit**

```bash
git add app/modules/bigquery.server.ts app/modules/social/report.server.ts tests/modules/bigquery.server.test.ts tests/modules/social/report.server.test.ts
git commit -m "feat: BigQueryクライアントとSNSレポート機能をTypeScriptで実装した

殿堂入り記事レポートと週間まとめレポートをWorker内で直接実行する"
```

---

## Task 7: automation.server.ts の切り替え（SNS投稿）

**Files:**
- Modify: `app/modules/automation.server.ts`

`handleSocialPostConsumer`が`callContainer('/post-social', ...)`の代わりに`social/post.server.ts`を使うように変更する。`callContainer`自体はOGP生成でまだ使うので削除しない。

- [ ] **Step 1: `handleSocialPostConsumer`を修正**

`app/modules/automation.server.ts` の変更点:

1. importに追加:
```typescript
import { postToSocial } from './social/post.server';
import type { Platform } from './social/types';
```

2. `handleSocialPostConsumer` 内の `callContainer('/post-social', ...)` ブロック（行293-301）を以下に置き換え:
```typescript
    const result = await postToSocial(env, {
      platform: payload.platform as Platform,
      postTitle: payload.post_title,
      postUrl: payload.post_url,
      ogUrl: payload.og_url,
      messageType: payload.message_type as 'new' | 'legendary' | 'random',
    });

    const providerPostId = result.providerPostId;
```

3. 行304-308（旧providerPostId抽出ロジック）を削除:
```typescript
    // DELETE these lines:
    const providerPostId =
      (result.tweet_id as string) ??
      (result.bluesky_post_uri as string) ??
      (result.misskey_note_id as string) ??
      null;
```

- [ ] **Step 2: 型定義のimportを整理**

`automation.server.ts`の先頭付近にある`PLATFORMS`定数とlocal `Platform`型を削除し、`social/types.ts`からimportする:

```typescript
// DELETE:
// const PLATFORMS = ['twitter', 'bluesky', 'activitypub'] as const;
// type Platform = (typeof PLATFORMS)[number];

// ADD:
import { PLATFORMS } from './social/types';
import type { Platform } from './social/types';
```

- [ ] **Step 3: ビルドが通ることを確認**

```bash
pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add app/modules/automation.server.ts
git commit -m "refactor: SNS投稿をcallContainerからWorker内関数に切り替えた

handleSocialPostConsumerがsocial/post.server.tsを直接呼ぶように変更"
```

---

## Task 8: admin-delete.server.ts の切り替え（SNS削除）

**Files:**
- Modify: `app/modules/admin-delete.server.ts`

- [ ] **Step 1: callContainer('/delete-social')をdeleteFromSocialに置き換え**

`app/modules/admin-delete.server.ts` の変更:

1. importを変更:
```typescript
// REMOVE:
// import { callContainer } from './automation.server';

// ADD:
import { deleteFromSocial } from './social/delete.server';
```

2. 行78-84（SNS削除のforループ内）を変更:
```typescript
    try {
      await deleteFromSocial(env, {
        platform: entry.platform,
        providerPostId: entry.providerPostId,
      });
    } catch (err) {
```

- [ ] **Step 2: ビルドが通ることを確認**

```bash
pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add app/modules/admin-delete.server.ts
git commit -m "refactor: SNS削除をcallContainerからWorker内関数に切り替えた"
```

---

## Task 9: worker.ts の切り替え（レポート）

**Files:**
- Modify: `worker.ts`

- [ ] **Step 1: 殿堂入りレポートのCronハンドラを修正**

`worker.ts` の `controller.cron === '0 12 * * *'` ブロック（行61-77）を変更:

```typescript
    if (controller.cron === '0 12 * * *') {
      ctx.waitUntil(
        (async () => {
          const start = Date.now();
          try {
            const { reportLegendary } = await import('./app/modules/social/report.server');
            const result = await reportLegendary(env);
            console.log(`[scheduled] cron=0_12_daily completed in ${Date.now() - start}ms | processed=${result.processed}`);
          } catch (err) {
            console.error(
              `[scheduled] cron=0_12_daily FAILED after ${Date.now() - start}ms:`,
              err instanceof Error ? err.message : err,
            );
          }
        })(),
      );
    }
```

- [ ] **Step 2: 週間レポートのCronハンドラを修正**

`worker.ts` の `controller.cron === '0 12 * * 1'` ブロック（行79-95）を変更:

```typescript
    if (controller.cron === '0 12 * * 1') {
      ctx.waitUntil(
        (async () => {
          const start = Date.now();
          try {
            const { reportWeekly } = await import('./app/modules/social/report.server');
            const result = await reportWeekly(env);
            console.log(`[scheduled] cron=0_12_weekly completed in ${Date.now() - start}ms | posted=${result.posted}`);
          } catch (err) {
            console.error(
              `[scheduled] cron=0_12_weekly FAILED after ${Date.now() - start}ms:`,
              err instanceof Error ? err.message : err,
            );
          }
        })(),
      );
    }
```

- [ ] **Step 3: ビルドが通ることを確認**

```bash
pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add worker.ts
git commit -m "refactor: レポートCronをcallContainerからWorker内関数に切り替えた

殿堂入りレポートと週間レポートをsocial/report.server.tsで直接実行する"
```

---

## Task 10: 24時間ウィンドウ撤廃 + LIMIT追加

**Files:**
- Modify: `app/routes/api.internal.$.tsx:91-109`

- [ ] **Step 1: handlePostsForOgpの24時間制限を撤廃**

`app/routes/api.internal.$.tsx` の `handlePostsForOgp` 関数を変更:

```typescript
async function handlePostsForOgp(db: ReturnType<typeof drizzle>) {
  const posts = await db
    .select({
      postId: schema.dimPosts.postId,
      postTitle: schema.dimPosts.postTitle,
      postContent: schema.dimPosts.postContent,
    })
    .from(schema.dimPosts)
    .where(
      and(
        eq(schema.dimPosts.isSnsShared, false),
        eq(schema.dimPosts.isWelcomed, true),
      ),
    )
    .limit(5);

  return jsonResponse({ posts });
}
```

変更点:
- `gte(schema.dimPosts.postDateGmt, oneDayAgo)` 条件を削除
- `const oneDayAgo` 変数を削除
- `.limit(5)` を追加（1回のCronで最大5件処理）

- [ ] **Step 2: 未使用importを削除**

`gte` が他で使われていなければ import から削除:

```typescript
import { eq, and, sql } from 'drizzle-orm';
// gte, lte を削除（他で使われていなければ）
```

- [ ] **Step 3: ビルドが通ることを確認**

```bash
pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add app/routes/api.internal.$.tsx
git commit -m "fix: OGP対象投稿の24時間制限を撤廃し、LIMITを追加した

コンテナ障害で24時間以上停止した場合に投稿が永久にスキップされる問題を解消する"
```

---

## Task 11: ハートビート監視の追加

**Files:**
- Modify: `worker.ts`
- Modify: `wrangler.toml`
- Modify: `app/types/env.ts`

- [ ] **Step 1: env.tsにHEALTHCHECK_URLを追加**

`app/types/env.ts` に追加:
```typescript
  // Healthcheck (e.g. https://hc-ping.com/xxxxx)
  HEALTHCHECK_URL?: string;
```

- [ ] **Step 2: worker.tsの10分Cronにハートビートpingを追加**

`worker.ts` の `*/10 * * * *` ブロック内、ogpResult/recoverResultのログ出力後に追加:

```typescript
            // Heartbeat ping — signals "cron is alive" to external monitor
            if (env.HEALTHCHECK_URL) {
              try {
                await fetch(env.HEALTHCHECK_URL, { method: 'GET' });
              } catch {
                // Best-effort: don't fail the cron if healthcheck ping fails
              }
            }
```

- [ ] **Step 3: wrangler.tomlにHEALTHCHECK_URLの説明コメントを追加**

`wrangler.toml`の`[vars]`セクションに追加:
```toml
# Set HEALTHCHECK_URL via `wrangler secret put HEALTHCHECK_URL`
# e.g. https://hc-ping.com/<uuid>
```

- [ ] **Step 4: ビルドが通ることを確認**

```bash
pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add worker.ts app/types/env.ts wrangler.toml
git commit -m "feat: Cronハートビート監視を追加した

外部監視サービスにpingして、Cron停止を検知可能にする"
```

---

## Task 12: 全体テスト + lint + ビルド確認

**Files:** なし（検証のみ）

- [ ] **Step 1: 全テスト実行**

```bash
pnpm test
```
Expected: ALL PASS

- [ ] **Step 2: lint実行**

```bash
pnpm lint
```
Expected: No errors

- [ ] **Step 3: ビルド確認**

```bash
pnpm build
```
Expected: Success

- [ ] **Step 4: 型チェック**

```bash
pnpm typegen && npx tsc --noEmit
```
Expected: No errors

---

## Task 13: デプロイ + 動作確認

**Files:** なし（運用タスク）

- [ ] **Step 1: Healthchecks.ioでモニターを作成**

外部サービスでヘルスチェックURLを取得し、Workers secretに設定:
```bash
npx wrangler secret put HEALTHCHECK_URL
# プロンプトにhealthcheck URLを入力
```

- [ ] **Step 2: デプロイ**

```bash
npx wrangler deploy
```

- [ ] **Step 3: 次のCron実行後にDBを確認**

10分待ってから:
```bash
npx wrangler d1 execute healthy-person-emulator-db --remote --command "SELECT * FROM social_post_jobs ORDER BY created_at DESC LIMIT 6"
```

ジョブが作成・送信されていることを確認。

- [ ] **Step 4: SNS上で実際の投稿を目視確認**

- Twitter: https://x.com/helthypersonemu
- Bluesky: https://bsky.app/profile/helthypersonemu.bsky.social
- Misskey: https://misskey.io/@helthypersonemu

- [ ] **Step 5: ハートビートが正常にpingされていることを確認**

Healthchecks.ioダッシュボードでpingが届いていることを確認。
