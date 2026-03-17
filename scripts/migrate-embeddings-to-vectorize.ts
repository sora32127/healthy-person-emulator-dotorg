/**
 * 全投稿の embedding を EmbeddingGemma-300m で生成し Cloudflare Vectorize にバックフィル
 *
 * 実行方法:
 *   pnpm tsx scripts/migrate-embeddings-to-vectorize.ts
 *
 * 中断しても再開可能（進捗ファイルで処理済みIDを追跡）
 */

import { PrismaClient } from "@prisma/client";
import { appendFileSync, existsSync, readFileSync } from "node:fs";

const prisma = new PrismaClient();

const CLOUDFLARE_ACCOUNT_ID =
  process.env.CLOUDFLARE_ACCOUNT_ID || "9ecb9a8692f7c2c5c56387d93a9a1e60";
const CF_WORKERS_AI_TOKEN = process.env.CF_WORKERS_AI_TOKEN;
const VECTORIZE_INDEX_NAME =
  process.env.VECTORIZE_INDEX_NAME || "embeddings-index";

const CONCURRENCY = 10; // 並列数（レート制限対策で抑制）
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const UPSERT_BATCH_SIZE = 500; // Vectorize upsert バッチサイズ
const PROGRESS_FILE = "scripts/.migrate-progress.txt";

interface PostData {
  post_id: number;
  post_title: string;
  post_content: string;
}

interface VectorData {
  id: string;
  values: number[];
  metadata: Record<string, unknown>;
}

// ----- Cloudflare API -----

async function getEmbedding(text: string): Promise<number[]> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/google/embeddinggemma-300m`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CF_WORKERS_AI_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: [text] }),
    },
  );
  if (!res.ok) {
    throw new Error(`Workers AI error ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    result: { data: number[][] };
    success: boolean;
  };
  if (!data.success || !data.result?.data?.[0]) {
    throw new Error(`Workers AI unexpected: ${JSON.stringify(data)}`);
  }
  return data.result.data[0];
}

async function upsertToVectorize(vectors: VectorData[]): Promise<number> {
  const ndjson = vectors.map((v) => JSON.stringify(v)).join("\n");
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/vectorize/v2/indexes/${VECTORIZE_INDEX_NAME}/upsert`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CF_WORKERS_AI_TOKEN}`,
        "Content-Type": "application/x-ndjson",
      },
      body: ndjson,
    },
  );
  if (!res.ok) {
    throw new Error(
      `Vectorize upsert error ${res.status}: ${await res.text()}`,
    );
  }
  const data = (await res.json()) as {
    result: { count: number };
    success: boolean;
  };
  return data.result.count;
}

// ----- Progress tracking -----

function loadProgress(): Set<number> {
  if (!existsSync(PROGRESS_FILE)) return new Set();
  const content = readFileSync(PROGRESS_FILE, "utf-8");
  return new Set(
    content
      .split("\n")
      .filter(Boolean)
      .map(Number),
  );
}

function saveProgress(postIds: number[]) {
  appendFileSync(PROGRESS_FILE, postIds.join("\n") + "\n");
}

// ----- Concurrent pool -----

async function processWithPool(
  posts: PostData[],
  concurrency: number,
  onResult: (post: PostData, embedding: number[]) => void,
  onError: (post: PostData, error: unknown) => void,
): Promise<void> {
  let index = 0;

  async function worker() {
    while (index < posts.length) {
      const i = index++;
      const post = posts[i];
      const inputText = `タイトル: ${post.post_title}\n本文: ${post.post_content}`;
      let lastError: unknown;
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          const embedding = await getEmbedding(inputText);
          onResult(post, embedding);
          lastError = null;
          break;
        } catch (e) {
          lastError = e;
          if (String(e).includes("429")) {
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
          } else {
            break;
          }
        }
      }
      if (lastError) {
        onError(post, lastError);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
}

// ----- Main -----

async function main() {
  if (!CF_WORKERS_AI_TOKEN) {
    console.error("CF_WORKERS_AI_TOKEN が設定されていません");
    process.exit(1);
  }

  const done = loadProgress();
  console.log(`処理済み: ${done.size}件`);

  const allPosts = await prisma.$queryRaw<PostData[]>`
    SELECT post_id, post_title, post_content
    FROM dim_posts
    WHERE post_content IS NOT NULL AND post_content != ''
    ORDER BY post_id ASC
  `;

  const remaining = allPosts.filter((p) => !done.has(p.post_id));
  console.log(`全投稿: ${allPosts.length}件, 残り: ${remaining.length}件`);
  console.log(`並列数: ${CONCURRENCY}\n`);

  if (remaining.length === 0) {
    console.log("全件処理済みです。");
    await prisma.$disconnect();
    return;
  }

  let processed = 0;
  let errors = 0;
  const pendingVectors: VectorData[] = [];
  const pendingIds: number[] = [];
  const startTime = Date.now();

  async function flushBatch() {
    if (pendingVectors.length === 0) return;
    const batch = pendingVectors.splice(0);
    const ids = pendingIds.splice(0);
    try {
      await upsertToVectorize(batch);
      saveProgress(ids);
    } catch (e) {
      console.error(`  Vectorize upsert エラー: ${e}`);
    }
  }

  await processWithPool(
    remaining,
    CONCURRENCY,
    (post, embedding) => {
      pendingVectors.push({
        id: String(post.post_id),
        values: embedding,
        metadata: {
          postId: post.post_id,
          postTitle: post.post_title,
          embeddingModel: "embeddinggemma-300m",
          updatedAt: new Date().toISOString(),
        },
      });
      pendingIds.push(post.post_id);
      processed++;

      if (processed % 100 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        const rate = (processed / (Number(elapsed) || 1)).toFixed(1);
        console.log(
          `  ${processed + done.size}/${allPosts.length} (${rate}件/s, ${elapsed}s, err=${errors})`,
        );
      }

      if (pendingVectors.length >= UPSERT_BATCH_SIZE) {
        // fire and forget (次のバッチと並行)
        flushBatch();
      }
    },
    (post, e) => {
      errors++;
      console.error(`  [${post.post_id}] エラー: ${e}`);
    },
  );

  // 残りを flush
  await flushBatch();

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(
    `\n✅ 完了: ${processed}件処理, ${errors}件エラー, ${totalTime}秒`,
  );
  console.log(`合計: ${processed + done.size}/${allPosts.length}件`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
