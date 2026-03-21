# フェーズ1: フリーミアムAPI + CLI 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** プラットフォームのデータへのプログラマティックなアクセス手段（REST API + CLI）を提供する

**Architecture:** 既存のReact Router v7アプリに `/api/*` ルートとしてAPIエンドポイントを追加。APIキー管理テーブルをD1に追加し、全リクエストでAPIキー認証+レートリミットを行う。CLIは別パッケージ（`packages/cli`）としてAPIのラッパーを実装

**Tech Stack:** Cloudflare Workers + D1 + Drizzle ORM, React Router v7, Vitest, Node.js CLI (npm package)

**Spec:** `docs/superpowers/specs/2026-03-21-monetization-design.md` フェーズ1

---

## ファイル構成

### 新規作成

| ファイル | 責務 |
|---|---|
| `app/drizzle/schema.ts` | `dimApiKeys` テーブル定義を追加 |
| `drizzle/migrations/XXXX_add_api_keys.sql` | D1マイグレーション（drizzle-kit生成） |
| `app/modules/apiKey.server.ts` | APIキー生成・検証・レートリミット |
| `app/routes/api.v1.posts._index.tsx` | `GET /api/v1/posts` |
| `app/routes/api.v1.posts.$postId.tsx` | `GET /api/v1/posts/:postId` |
| `app/routes/api.v1.search.tsx` | `GET /api/v1/search` |
| `app/routes/api.v1.tags._index.tsx` | `GET /api/v1/tags` |
| `app/routes/api.v1.tags.$tagName.posts.tsx` | `GET /api/v1/tags/:tagName/posts` |
| `app/routes/_layout.settings.api.tsx` | APIキー管理ページ（Web） |
| `app/modules/apiKey.server.test.ts` | APIキーモジュールのテスト |
| `packages/cli/package.json` | CLIパッケージ定義 |
| `packages/cli/src/index.ts` | CLIエントリーポイント |
| `packages/cli/src/client.ts` | APIクライアント |
| `packages/cli/tsconfig.json` | TypeScript設定 |

### 変更

| ファイル | 変更内容 |
|---|---|
| `app/drizzle/schema.ts` | `dimApiKeys` テーブル追加 |
| `app/repositories/types.ts` | APIキー関連の型追加 |
| `app/repositories/d1.server.ts` | APIキー CRUD 関数追加 |
| `app/modules/db.server.ts` | APIキー関数のre-export追加 |
| `package.json` | workspaces設定追加（packages/cli） |

---

## Task 1: APIキーテーブルのスキーマ定義

**Files:**
- Modify: `app/drizzle/schema.ts`
- Modify: `app/repositories/types.ts`

- [ ] **Step 1: `dimApiKeys` テーブルをスキーマに追加**

`app/drizzle/schema.ts` の末尾に追加:

```typescript
// ============================================================
// N. dim_api_keys
// ============================================================
export const dimApiKeys = sqliteTable('dim_api_keys', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => dimUsers.userId, { onDelete: 'cascade' }),
  apiKey: text('api_key').notNull().unique(),
  isPremium: integer('is_premium', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
});
```

- [ ] **Step 2: 型定義を追加**

`app/repositories/types.ts` に追加:

```typescript
export type ApiKeyRecord = {
  id: number;
  userId: number;
  apiKey: string;
  isPremium: boolean;
  createdAt: string;
};
```

- [ ] **Step 3: コミット**

```bash
git add app/drizzle/schema.ts app/repositories/types.ts
git commit -m "feat: APIキーテーブルのスキーマ定義を追加した"
```

---

## Task 2: D1マイグレーション生成・適用

**Files:**
- Create: `drizzle/migrations/XXXX_add_api_keys.sql`（drizzle-kitが生成）

- [ ] **Step 1: マイグレーション生成**

Run: `pnpm drizzle-kit generate`

生成されたSQLファイルに以下と同等の内容があることを確認:

```sql
CREATE TABLE `dim_api_keys` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` integer NOT NULL REFERENCES `dim_users`(`user_id`) ON DELETE CASCADE,
  `api_key` text NOT NULL,
  `is_premium` integer DEFAULT false NOT NULL,
  `created_at` text NOT NULL
);
CREATE UNIQUE INDEX `dim_api_keys_api_key_unique` ON `dim_api_keys` (`api_key`);
```

- [ ] **Step 2: ローカルD1にマイグレーション適用**

Run: `pnpm wrangler d1 migrations apply healthy-person-emulator-db --local`

- [ ] **Step 3: コミット**

```bash
git add drizzle/
git commit -m "feat: dim_api_keysテーブルのマイグレーションを追加した"
```

---

## Task 3: APIキーモジュール（生成・検証・レートリミット）

**Files:**
- Create: `app/modules/apiKey.server.ts`
- Create: `app/modules/apiKey.server.test.ts`
- Modify: `app/repositories/d1.server.ts`
- Modify: `app/repositories/types.ts`
- Modify: `app/modules/db.server.ts`

- [ ] **Step 1: テストを書く**

`app/modules/apiKey.server.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateApiKey, validateRateLimit } from './apiKey.server';

describe('generateApiKey', () => {
  it('hpe_ プレフィックスで始まる64文字のキーを生成する', () => {
    const key = generateApiKey();
    expect(key).toMatch(/^hpe_[a-f0-9]{60}$/);
  });

  it('毎回異なるキーを生成する', () => {
    const key1 = generateApiKey();
    const key2 = generateApiKey();
    expect(key1).not.toBe(key2);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `pnpm test -- app/modules/apiKey.server.test.ts`
Expected: FAIL（モジュールが存在しない）

- [ ] **Step 3: リポジトリにAPIキーCRUD関数を追加**

`app/repositories/d1.server.ts` の `createD1Repository` 関数内に以下を追加:

```typescript
async createApiKey(userId: number): Promise<ApiKeyRecord> {
  const apiKey = generateApiKey();
  const now = new Date().toISOString();
  await db.delete(schema.dimApiKeys).where(eq(schema.dimApiKeys.userId, userId));
  const [row] = await db
    .insert(schema.dimApiKeys)
    .values({ userId, apiKey, createdAt: now })
    .returning();
  return { id: row.id, userId: row.userId, apiKey: row.apiKey, isPremium: row.isPremium, createdAt: row.createdAt };
},

async findByApiKey(apiKey: string): Promise<ApiKeyRecord | null> {
  const rows = await db.select().from(schema.dimApiKeys).where(eq(schema.dimApiKeys.apiKey, apiKey)).limit(1);
  if (rows.length === 0) return null;
  const row = rows[0];
  return { id: row.id, userId: row.userId, apiKey: row.apiKey, isPremium: row.isPremium, createdAt: row.createdAt };
},

async getApiKeyByUserId(userId: number): Promise<ApiKeyRecord | null> {
  const rows = await db.select().from(schema.dimApiKeys).where(eq(schema.dimApiKeys.userId, userId)).limit(1);
  if (rows.length === 0) return null;
  const row = rows[0];
  return { id: row.id, userId: row.userId, apiKey: row.apiKey, isPremium: row.isPremium, createdAt: row.createdAt };
},
```

`generateApiKey` はファイル先頭にヘルパーとして追加:

```typescript
function generateApiKey(): string {
  const bytes = new Uint8Array(30);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `hpe_${hex}`;
}
```

`app/repositories/types.ts` の `DatabaseRepository` interfaceに追加:

```typescript
createApiKey(userId: number): Promise<ApiKeyRecord>;
findByApiKey(apiKey: string): Promise<ApiKeyRecord | null>;
getApiKeyByUserId(userId: number): Promise<ApiKeyRecord | null>;
```

`app/modules/db.server.ts` にre-exportを追加:

```typescript
export const createApiKey = (...args: Parameters<DatabaseRepository['createApiKey']>) =>
  getRepo().createApiKey(...args);
export const findByApiKey = (...args: Parameters<DatabaseRepository['findByApiKey']>) =>
  getRepo().findByApiKey(...args);
export const getApiKeyByUserId = (...args: Parameters<DatabaseRepository['getApiKeyByUserId']>) =>
  getRepo().getApiKeyByUserId(...args);
```

`app/modules/apiKey.server.ts` はヘルパーのみ残す:

```typescript
export { generateApiKey } from '~/repositories/d1.server';

const RATE_LIMITS = { free: 10, premium: 60 } as const;

export function getRateLimit(isPremium: boolean): number {
  return isPremium ? RATE_LIMITS.premium : RATE_LIMITS.free;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `pnpm test -- app/modules/apiKey.server.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add app/modules/apiKey.server.ts app/modules/apiKey.server.test.ts
git commit -m "feat: APIキー生成・検証モジュールを実装した"
```

---

## Task 4: API認証ミドルウェア

**Files:**
- Create: `app/modules/apiAuth.server.ts`

- [ ] **Step 1: API認証ヘルパーを実装**

`app/modules/apiAuth.server.ts`:

```typescript
import { findByApiKey } from '~/modules/db.server';
import type { ApiKeyRecord } from '~/repositories/types';

type ApiAuthResult =
  | { ok: true; apiKey: ApiKeyRecord }
  | { ok: false; response: Response };

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * APIリクエストの認証を行う。
 * Authorization: Bearer <api-key> ヘッダーからAPIキーを取得し、D1で検証する。
 */
export async function authenticateApiRequest(
  request: Request,
): Promise<ApiAuthResult> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, response: jsonError('Authorization header required. Format: Bearer <api-key>', 401) };
  }

  const token = authHeader.slice('Bearer '.length);
  const record = await findByApiKey(token);
  if (!record) {
    return { ok: false, response: jsonError('Invalid API key', 401) };
  }

  return { ok: true, apiKey: record };
}
```

- [ ] **Step 2: コミット**

```bash
git add app/modules/apiAuth.server.ts
git commit -m "feat: API認証ミドルウェアを実装した"
```

---

## Task 5: GET /api/v1/posts エンドポイント

**Files:**
- Create: `app/routes/api.v1.posts._index.tsx`

- [ ] **Step 1: 投稿一覧エンドポイントを実装**

`app/routes/api.v1.posts._index.tsx`:

```typescript
import type { LoaderFunctionArgs } from 'react-router';
import { authenticateApiRequest } from '~/modules/apiAuth.server';
import { getFeedPosts } from '~/modules/db.server';
import type { FeedPostType } from '~/repositories/types';

export async function loader({ request }: LoaderFunctionArgs) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get('pageSize')) || 10));
  const type = (url.searchParams.get('type') as FeedPostType) || 'timeDesc';

  const data = await getFeedPosts(page, type, pageSize);

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

- [ ] **Step 2: 手動テスト**

Run: `pnpm start:local`

```bash
curl -H "Authorization: Bearer <test-key>" http://localhost:8787/api/v1/posts
```

Expected: 401（まだAPIキーが存在しないため）。レスポンスが `{"error":"Invalid API key"}` であることを確認。

- [ ] **Step 3: コミット**

```bash
git add app/routes/api.v1.posts._index.tsx
git commit -m "feat: GET /api/v1/posts エンドポイントを実装した"
```

---

## Task 6: GET /api/v1/posts/:postId エンドポイント

**Files:**
- Create: `app/routes/api.v1.posts.$postId.tsx`

- [ ] **Step 1: 投稿詳細エンドポイントを実装**

`app/routes/api.v1.posts.$postId.tsx`:

```typescript
import type { LoaderFunctionArgs } from 'react-router';
import { authenticateApiRequest } from '~/modules/apiAuth.server';
import { ArchiveDataEntry } from '~/modules/db.server';

export async function loader({ request, params }: LoaderFunctionArgs) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return auth.response;

  const postId = Number(params.postId);
  if (Number.isNaN(postId)) {
    return new Response(JSON.stringify({ error: 'Invalid postId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const data = await ArchiveDataEntry.getData(postId);
    return new Response(JSON.stringify({
      postId: data.postId,
      postTitle: data.postTitle,
      postContent: data.postContent,
      postDateGmt: data.postDateGmt,
      countLikes: data.countLikes,
      countDislikes: data.countDislikes,
      tags: data.tags,
      comments: data.comments,
      countBookmarks: data.countBookmarks,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Post not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
```

- [ ] **Step 2: コミット**

```bash
git add app/routes/api.v1.posts.$postId.tsx
git commit -m "feat: GET /api/v1/posts/:postId エンドポイントを実装した"
```

---

## Task 7: GET /api/v1/search エンドポイント

**Files:**
- Create: `app/routes/api.v1.search.tsx`

- [ ] **Step 1: 検索エンドポイントを実装**

`app/routes/api.v1.search.tsx`:

```typescript
import type { LoaderFunctionArgs } from 'react-router';
import { authenticateApiRequest } from '~/modules/apiAuth.server';
import { searchPosts } from '~/modules/db.server';
import type { SearchOrderBy } from '~/repositories/types';

export async function loader({ request }: LoaderFunctionArgs) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const q = url.searchParams.get('q') || '';
  const orderby = (url.searchParams.get('orderby') as SearchOrderBy) || 'timeDesc';
  const tags = url.searchParams.get('tags')?.split(' ').filter(Boolean) || [];
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get('pageSize')) || 10));

  const result = await searchPosts(q, orderby, page, tags, pageSize);

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

- [ ] **Step 2: コミット**

```bash
git add app/routes/api.v1.search.tsx
git commit -m "feat: GET /api/v1/search エンドポイントを実装した"
```

---

## Task 8: GET /api/v1/tags + GET /api/v1/tags/:tagName/posts エンドポイント

**Files:**
- Create: `app/routes/api.v1.tags._index.tsx`
- Create: `app/routes/api.v1.tags.$tagName.posts.tsx`

- [ ] **Step 1: タグ一覧エンドポイントを実装**

`app/routes/api.v1.tags._index.tsx`:

```typescript
import type { LoaderFunctionArgs } from 'react-router';
import { authenticateApiRequest } from '~/modules/apiAuth.server';
import { getTagsCounts } from '~/modules/db.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return auth.response;

  const tags = await getTagsCounts();

  return new Response(JSON.stringify({ tags }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

- [ ] **Step 2: タグ別投稿一覧エンドポイントを実装**

`app/routes/api.v1.tags.$tagName.posts.tsx`:

```typescript
import type { LoaderFunctionArgs } from 'react-router';
import { authenticateApiRequest } from '~/modules/apiAuth.server';
import { searchPosts } from '~/modules/db.server';

export async function loader({ request, params }: LoaderFunctionArgs) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return auth.response;

  const tagName = decodeURIComponent(params.tagName || '');
  if (!tagName) {
    return new Response(JSON.stringify({ error: 'tagName is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get('pageSize')) || 10));

  const result = await searchPosts('', 'timeDesc', page, [tagName], pageSize);

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

- [ ] **Step 3: コミット**

```bash
git add app/routes/api.v1.tags._index.tsx app/routes/api.v1.tags.$tagName.posts.tsx
git commit -m "feat: GET /api/v1/tags, GET /api/v1/tags/:tagName/posts を実装した"
```

---

## Task 9: APIキー管理ページ（Web）

**Files:**
- Create: `app/routes/_layout.settings.api.tsx`

- [ ] **Step 1: APIキー発行・表示ページを実装**

`app/routes/_layout.settings.api.tsx`:

```typescript
import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from 'react-router';
import { useLoaderData, Form } from 'react-router';
import { getAuthenticatedUser } from '~/modules/auth.google.server';
import { createApiKey, getApiKeyByUserId } from '~/modules/db.server';
import { getUserId } from '~/modules/db.server';
import { H1 } from '~/components/Headings';
import { commonMetaFunction } from '~/utils/commonMetafunction';

export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return { authenticated: false, apiKey: null } as const;
  }
  const userId = await getUserId(user.userUuid);
  const existing = await getApiKeyByUserId(userId);
  return { authenticated: true, apiKey: existing?.apiKey ?? null } as const;
}

export async function action({ request, context }: ActionFunctionArgs) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const userId = await getUserId(user.userUuid);
  const record = await createApiKey(userId);
  return { apiKey: record.apiKey };
}

export default function ApiKeySettings() {
  const data = useLoaderData<typeof loader>();

  if (!data.authenticated) {
    return (
      <div>
        <H1>API設定</H1>
        <p>APIキーを発行するにはログインしてください。</p>
      </div>
    );
  }

  return (
    <div>
      <H1>API設定</H1>
      {data.apiKey ? (
        <div>
          <p>あなたのAPIキー:</p>
          <code className="block bg-base-200 p-4 rounded-md break-all my-4">{data.apiKey}</code>
          <p className="text-sm opacity-70">このキーは他人に共有しないでください。</p>
          <Form method="post" className="mt-4">
            <button type="submit" className="btn btn-warning">
              キーを再生成
            </button>
          </Form>
        </div>
      ) : (
        <div>
          <p>APIキーを発行して、CLIやプログラムからアクセスできるようになります。</p>
          <Form method="post" className="mt-4">
            <button type="submit" className="btn btn-primary">
              APIキーを発行
            </button>
          </Form>
        </div>
      )}
    </div>
  );
}

export const meta: MetaFunction = () => {
  return commonMetaFunction({
    title: 'API設定',
    description: 'APIキーの発行・管理',
    url: 'https://healthy-person-emulator.org/settings/api',
    image: null,
  });
};
```

- [ ] **Step 2: 手動テスト**

Run: `pnpm start:local`
1. ログインした状態で `/settings/api` にアクセス
2. 「APIキーを発行」ボタンをクリック
3. `hpe_` で始まるキーが表示されることを確認
4. そのキーで `curl -H "Authorization: Bearer <key>" http://localhost:8787/api/v1/tags` が200を返すことを確認

- [ ] **Step 3: コミット**

```bash
git add app/routes/_layout.settings.api.tsx
git commit -m "feat: APIキー管理ページを実装した"
```

---

## Task 10: レートリミット設定

**Files:**
- 設定先: Cloudflareダッシュボード or `wrangler.toml`

- [ ] **Step 1: レートリミットの方針を決定・記録**

レートリミットはCloudflare Rate Limiting Rules（Enterprise）またはアプリケーションレベルで実装する。

アプリレベルの簡易実装: `app/modules/apiAuth.server.ts` に以下を追加:

```typescript
// D1ベースの簡易レートリミット
// dim_api_keys テーブルに requestCountCurrentMinute, currentMinuteStart カラムを追加する方式
// → フェーズ2で isPremium に応じた上限切り替えが必要になるタイミングで実装する
// フェーズ1では Cloudflare Rate Limiting Rules で IP 単位の制限のみ設定
```

フェーズ1ではCloudflareダッシュボードで `/api/v1/*` に対するIP単位のRate Limiting Rule（10req/min）を設定する。APIキー単位の制限はフェーズ2で実装。

- [ ] **Step 2: コミット（ドキュメントのみ）**

設定手順を README またはスペックに記録してコミット。

---

## Task 11: CLIパッケージのセットアップ

**Files:**
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/src/client.ts`
- Create: `packages/cli/src/index.ts`
- Modify: `package.json` (root)

- [ ] **Step 1: pnpm workspace設定**

`pnpm-workspace.yaml`（ルートに作成、既にあれば追加）:

```yaml
packages:
  - "packages/*"
```

- [ ] **Step 2: CLIパッケージを作成**

`packages/cli/package.json`:

```json
{
  "name": "hpe-cli",
  "version": "0.1.0",
  "description": "CLI for 健常者エミュレータ事例集 API",
  "bin": {
    "hpe": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {},
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

`packages/cli/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: APIクライアントを実装**

`packages/cli/src/client.ts`:

```typescript
export class HpeClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(options: { baseUrl?: string; apiKey: string }) {
    this.baseUrl = options.baseUrl || 'https://healthy-person-emulator.org';
    this.apiKey = options.apiKey;
  }

  private async request(path: string, params?: Record<string, string>): Promise<unknown> {
    const url = new URL(`/api/v1${path}`, this.baseUrl);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value) url.searchParams.set(key, value);
      }
    }

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`API error ${res.status}: ${body}`);
    }

    return res.json();
  }

  async getPosts(options?: { page?: number; pageSize?: number; sort?: string }) {
    return this.request('/posts', {
      page: String(options?.page || 1),
      pageSize: String(options?.pageSize || 10),
      sort: options?.sort || 'timeDesc',
    });
  }

  async getPost(postId: number) {
    return this.request(`/posts/${postId}`);
  }

  async search(query: string, options?: { page?: number; pageSize?: number; orderby?: string; tags?: string[] }) {
    return this.request('/search', {
      q: query,
      page: String(options?.page || 1),
      pageSize: String(options?.pageSize || 10),
      orderby: options?.orderby || 'timeDesc',
      tags: options?.tags?.join(' ') || '',
    });
  }

  async getTags() {
    return this.request('/tags');
  }

  async getPostsByTag(tagName: string, options?: { page?: number; pageSize?: number }) {
    return this.request(`/tags/${encodeURIComponent(tagName)}/posts`, {
      page: String(options?.page || 1),
      pageSize: String(options?.pageSize || 10),
    });
  }
}
```

- [ ] **Step 4: CLIエントリーポイントを実装**

`packages/cli/src/index.ts`:

```typescript
#!/usr/bin/env node

import { HpeClient } from './client.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.hpe');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

function loadConfig(): { apiKey?: string; baseUrl?: string } {
  if (!existsSync(CONFIG_FILE)) return {};
  return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
}

function saveConfig(config: { apiKey?: string; baseUrl?: string }) {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function getClient(): HpeClient {
  const config = loadConfig();
  if (!config.apiKey) {
    console.error('API key not set. Run: hpe auth set-key <key>');
    process.exit(1);
  }
  return new HpeClient({ apiKey: config.apiKey, baseUrl: config.baseUrl });
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const subcommand = args[1];

  if (command === 'auth' && subcommand === 'set-key') {
    const key = args[2];
    if (!key) { console.error('Usage: hpe auth set-key <api-key>'); process.exit(1); }
    const config = loadConfig();
    config.apiKey = key;
    saveConfig(config);
    console.log(JSON.stringify({ status: 'ok', message: 'API key saved' }));
    return;
  }

  const client = getClient();

  if (command === 'posts') {
    const page = args.find((a) => a.startsWith('--page='))?.split('=')[1];
    const result = await client.getPosts({ page: page ? Number(page) : undefined });
    console.log(JSON.stringify(result));
    return;
  }

  if (command === 'post') {
    const postId = Number(subcommand);
    if (Number.isNaN(postId)) { console.error('Usage: hpe post <postId>'); process.exit(1); }
    const result = await client.getPost(postId);
    console.log(JSON.stringify(result));
    return;
  }

  if (command === 'search') {
    const query = subcommand || '';
    const result = await client.search(query);
    console.log(JSON.stringify(result));
    return;
  }

  if (command === 'tags') {
    const result = await client.getTags();
    console.log(JSON.stringify(result));
    return;
  }

  console.error(JSON.stringify({
    error: 'Unknown command',
    usage: ['hpe auth set-key <key>', 'hpe posts', 'hpe post <id>', 'hpe search <query>', 'hpe tags'],
  }));
  process.exit(1);
}

main().catch((err) => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
```

- [ ] **Step 5: ビルド確認**

```bash
cd packages/cli && pnpm install && pnpm build
```

Expected: `dist/` に `index.js` と `client.js` が生成される

- [ ] **Step 6: コミット**

```bash
git add packages/cli/ pnpm-workspace.yaml
git commit -m "feat: CLIパッケージを実装した"
```

---

## Task 12: lint・型チェック・ビルド確認

- [ ] **Step 1: lint**

Run: `pnpm lint`
Expected: エラーなし（あれば修正）

- [ ] **Step 2: 型チェック**

Run: `pnpm tsc --noEmit` (アプリ側)
Expected: エラーなし

- [ ] **Step 3: ビルド**

Run: `pnpm build`
Expected: 正常終了

- [ ] **Step 4: 修正があればコミット**

```bash
git add -A
git commit -m "fix: lint・型エラーを修正した"
```
