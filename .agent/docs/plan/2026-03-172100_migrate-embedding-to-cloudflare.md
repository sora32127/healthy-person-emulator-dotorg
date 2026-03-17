# Embedding システムを Cloudflare Workers AI + Vectorize に移行

## Context

OpenAI text-embedding-3-small + pgvector → **Cloudflare Workers AI + Vectorize に一括移行**。
移行期間・dual-write なし。一気に切り替える。

- 投稿数: 11,222件、平均 709 tokens/投稿、最大 6,558 tokens

## 最終アーキテクチャ

```
[投稿作成/編集]
  Cloud Run → Workers AI (EmbeddingGemma-300m) → Vectorize upsert

[類似記事検索]
  Cloud Run → Vectorize: getByIds(postId) → query(vector, topK=17) → 返却
```

## モデル: `@cf/google/embeddinggemma-300m`

- 768次元、2K max tokens、100+言語、MTEB Multilingual 61.15

## Vectorize: `hpe-post-embeddings`

- 768次元、cosine、メタデータ: postId, postTitle

## 実装ステップ

### Step 1: PoC — EmbeddingGemma 動作確認

`scripts/poc-embedding-comparison.ts` を修正してEmbeddingGemmaをテスト。
正規化・次元数・類似検索品質を確認。問題があればここで中止。

### Step 2: Cloudflare クライアント作成

**`app/modules/cloudflare.server.ts` を新規作成**

- `getEmbedding(text)` — Workers AI EmbeddingGemma
- `upsertVectors(vectors)` — Vectorize NDJSON upsert
- `querySimilar(vector, topK)` — Vectorize query
- `getVectorsByIds(ids)` — Vectorize get-by-ids
- `deleteVectors(ids)` — Vectorize delete
- 全関数タイムアウト5秒

### Step 3: Vectorize インデックス作成 + 全件バックフィル

```bash
npx wrangler vectorize create hpe-post-embeddings --dimensions=768 --metric=cosine
```

**`scripts/migrate-embeddings-to-vectorize.ts`** で全11,222件を一括移行。

### Step 4: embedding.server.ts を書き換え

- OpenAI → Workers AI EmbeddingGemma
- pgvector update → Vectorize upsert
- `openai` import 削除

### Step 5: db.server.ts の getSimilarPosts を書き換え

- pgvector SQL → Vectorize REST API (getByIds + query)
- topK=17、self-match除外して15件返却

### Step 6: クリーンアップ

- `.env.example` にCloudflare環境変数追加、OpenAI系削除
- `openai` パッケージ削除
- `content_embedding` カラム・`search_similar_content` 関数は後日削除

## 変更対象ファイル

| ファイル | 変更 |
|---------|------|
| `app/modules/cloudflare.server.ts` | **新規** |
| `app/modules/embedding.server.ts` | OpenAI → Workers AI + Vectorize |
| `app/modules/db.server.ts` | `getSimilarPosts`(L281): pgvector → Vectorize |
| `.env.example` | 環境変数更新 |
| `scripts/migrate-embeddings-to-vectorize.ts` | **新規** |
| `scripts/poc-embedding-comparison.ts` | EmbeddingGemma追加 |

**変更不要**: `_layout.post.tsx`, `_layout.archives.edit.$postId.tsx`, `_layout.archives.$postId.tsx`

## 検証

1. PoC: EmbeddingGemma 正規化・次元数・品質
2. バックフィル後: `wrangler vectorize info` でベクトル数確認
3. 切り替え後: 数記事の類似記事を目視確認
