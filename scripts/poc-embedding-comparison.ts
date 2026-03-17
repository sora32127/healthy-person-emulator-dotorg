/**
 * PoC: OpenAI text-embedding-3-small vs Cloudflare Workers AI EmbeddingGemma-300m
 *
 * 実行方法:
 *   CF_API_TOKEN=xxx pnpm tsx scripts/poc-embedding-comparison.ts
 *
 * 必要な環境変数:
 *   DATABASE_URL (Prisma用)
 *   OPENAI_API_KEY
 *   CF_API_TOKEN (Workers AI用)
 *   CLOUDFLARE_ACCOUNT_ID (デフォルト: 9ecb9a8692f7c2c5c56387d93a9a1e60)
 */

import { PrismaClient } from "@prisma/client";
import { OpenAI } from "openai";

const prisma = new PrismaClient();

const CLOUDFLARE_ACCOUNT_ID =
  process.env.CLOUDFLARE_ACCOUNT_ID || "9ecb9a8692f7c2c5c56387d93a9a1e60";
const CF_API_TOKEN = process.env.CF_API_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const SAMPLE_SIZE = 20;
const QUERY_POST_COUNT = 5;

// ----- Types -----

interface PostData {
  post_id: number;
  post_title: string;
  post_content: string;
  token_count: number | null;
}

interface EmbeddingResult {
  postId: number;
  openaiEmbedding: number[];
  gemmaEmbedding: number[];
}

// ----- Cloudflare Workers AI API -----

async function getGemmaEmbedding(text: string): Promise<number[]> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/google/embeddinggemma-300m`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CF_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: [text] }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Cloudflare API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as {
    result: { data: number[][] };
    success: boolean;
  };
  if (!data.success || !data.result?.data?.[0]) {
    throw new Error(
      `Cloudflare API unexpected result: ${JSON.stringify(data)}`,
    );
  }
  return data.result.data[0];
}

// ----- OpenAI API -----

async function getOpenAIEmbedding(
  openai: OpenAI,
  text: string,
): Promise<{ embedding: number[]; tokenCount: number }> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return {
    embedding: response.data[0].embedding,
    tokenCount: response.usage.total_tokens,
  };
}

// ----- Math utilities -----

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function l2Norm(vec: number[]): number {
  return Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
}

// ----- Analysis -----

function analyzeTokenDistribution(posts: PostData[]) {
  const tokens = posts
    .map((p) => p.token_count)
    .filter((t): t is number => t !== null)
    .sort((a, b) => a - b);

  if (tokens.length === 0) {
    console.log("  token_count データなし");
    return;
  }

  const sum = tokens.reduce((a, b) => a + b, 0);
  const p50 = tokens[Math.floor(tokens.length * 0.5)];
  const p90 = tokens[Math.floor(tokens.length * 0.9)];
  const p95 = tokens[Math.floor(tokens.length * 0.95)];
  const max = tokens[tokens.length - 1];
  const over2k = tokens.filter((t) => t > 2000).length;

  console.log(`  投稿数: ${tokens.length}`);
  console.log(`  平均: ${Math.round(sum / tokens.length)} tokens`);
  console.log(`  p50: ${p50} | p90: ${p90} | p95: ${p95} | max: ${max}`);
  console.log(
    `  2K超過: ${over2k}件 (${((over2k / tokens.length) * 100).toFixed(1)}%)`,
  );
}

function compareRankings(
  queryPostId: number,
  embeddings: EmbeddingResult[],
): { kendallTau: number; top5Overlap: number } {
  const queryEmb = embeddings.find((e) => e.postId === queryPostId);
  if (!queryEmb) return { kendallTau: 0, top5Overlap: 0 };

  const others = embeddings.filter((e) => e.postId !== queryPostId);

  const openaiRanked = others
    .map((e) => ({
      postId: e.postId,
      sim: cosineSimilarity(queryEmb.openaiEmbedding, e.openaiEmbedding),
    }))
    .sort((a, b) => b.sim - a.sim);

  const gemmaRanked = others
    .map((e) => ({
      postId: e.postId,
      sim: cosineSimilarity(queryEmb.gemmaEmbedding, e.gemmaEmbedding),
    }))
    .sort((a, b) => b.sim - a.sim);

  // Top-5 overlap
  const openaiTop5 = new Set(openaiRanked.slice(0, 5).map((r) => r.postId));
  const gemmaTop5 = new Set(gemmaRanked.slice(0, 5).map((r) => r.postId));
  let overlap = 0;
  for (const id of openaiTop5) {
    if (gemmaTop5.has(id)) overlap++;
  }

  // Kendall tau
  const openaiOrder = openaiRanked.map((r) => r.postId);
  const gemmaOrderMap = new Map(gemmaRanked.map((r, i) => [r.postId, i]));
  let concordant = 0;
  let discordant = 0;
  for (let i = 0; i < openaiOrder.length; i++) {
    for (let j = i + 1; j < openaiOrder.length; j++) {
      const gi = gemmaOrderMap.get(openaiOrder[i])!;
      const gj = gemmaOrderMap.get(openaiOrder[j])!;
      if (gi < gj) concordant++;
      else if (gi > gj) discordant++;
    }
  }
  const totalPairs = concordant + discordant;
  const kendallTau =
    totalPairs > 0 ? (concordant - discordant) / totalPairs : 0;

  return { kendallTau, top5Overlap: overlap };
}

// ----- Main -----

async function main() {
  if (!CF_API_TOKEN) {
    console.error("CF_API_TOKEN が設定されていません");
    process.exit(1);
  }
  if (!OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY が設定されていません");
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  // Step 1: Token分布
  console.log("=== Step 1: Token分布 ===\n");

  const allPosts = await prisma.$queryRaw<PostData[]>`
    SELECT post_id, post_title, post_content, token_count
    FROM dim_posts
    WHERE post_content IS NOT NULL AND post_content != ''
    ORDER BY post_id DESC
  `;
  console.log(`全投稿数: ${allPosts.length}`);
  analyzeTokenDistribution(allPosts);

  // Step 2: サンプル取得
  console.log(`\n=== Step 2: サンプル ${SAMPLE_SIZE}件 ===\n`);

  const sortedByToken = allPosts
    .filter((p) => p.token_count !== null)
    .sort((a, b) => (a.token_count ?? 0) - (b.token_count ?? 0));

  const sampleIndices = Array.from({ length: SAMPLE_SIZE }, (_, i) =>
    Math.floor((i * (sortedByToken.length - 1)) / (SAMPLE_SIZE - 1)),
  );
  const samplePosts = sampleIndices.map((idx) => sortedByToken[idx]);

  for (const p of samplePosts) {
    console.log(
      `  [${p.post_id}] ${p.post_title.slice(0, 40)}... (${p.token_count} tokens)`,
    );
  }

  // Step 3: 両モデルでembedding生成
  console.log("\n=== Step 3: Embedding生成 ===\n");

  const embeddings: EmbeddingResult[] = [];
  for (const post of samplePosts) {
    const inputText = `タイトル: ${post.post_title}\n本文: ${post.post_content}`;
    // EmbeddingGemma は 2K tokens → 日本語で約4000文字を上限とする
    const gemmaInput = inputText.slice(0, 4000);

    try {
      const [openaiResult, gemmaResult] = await Promise.all([
        getOpenAIEmbedding(openai, inputText),
        getGemmaEmbedding(gemmaInput),
      ]);

      embeddings.push({
        postId: post.post_id,
        openaiEmbedding: openaiResult.embedding,
        gemmaEmbedding: gemmaResult,
      });

      console.log(
        `  [${post.post_id}] OK (OpenAI: ${openaiResult.tokenCount}tok/dim=${openaiResult.embedding.length}, Gemma: dim=${gemmaResult.length})`,
      );
    } catch (error) {
      console.error(`  [${post.post_id}] エラー: ${error}`);
    }
  }

  if (embeddings.length < 3) {
    console.error("Embedding生成が不十分です。");
    process.exit(1);
  }

  // Step 4: 正規化チェック
  console.log("\n=== Step 4: 正規化チェック ===\n");
  const first = embeddings[0];
  const openaiNorm = l2Norm(first.openaiEmbedding);
  const gemmaNorm = l2Norm(first.gemmaEmbedding);

  console.log(
    `  OpenAI: dim=${first.openaiEmbedding.length}, L2 norm=${openaiNorm.toFixed(4)} (${Math.abs(openaiNorm - 1) < 0.01 ? "正規化済み" : "未正規化"})`,
  );
  console.log(
    `  Gemma:  dim=${first.gemmaEmbedding.length}, L2 norm=${gemmaNorm.toFixed(4)} (${Math.abs(gemmaNorm - 1) < 0.01 ? "正規化済み" : "未正規化"})`,
  );

  // Step 5: ランキング比較
  console.log("\n=== Step 5: 類似検索ランキング比較 ===\n");

  const queryPosts = embeddings.slice(0, QUERY_POST_COUNT);
  let totalTau = 0;
  let totalOverlap = 0;

  for (const qp of queryPosts) {
    const post = samplePosts.find((p) => p.post_id === qp.postId)!;
    const { kendallTau, top5Overlap } = compareRankings(qp.postId, embeddings);
    totalTau += kendallTau;
    totalOverlap += top5Overlap;

    console.log(`  [${qp.postId}] "${post.post_title.slice(0, 35)}..."`);
    console.log(
      `    Kendall τ: ${kendallTau.toFixed(3)} | Top-5 一致: ${top5Overlap}/5`,
    );
  }

  // Summary
  const avgTau = totalTau / QUERY_POST_COUNT;
  const avgOverlap = totalOverlap / QUERY_POST_COUNT;

  console.log("\n=== 総合レポート ===\n");
  console.log(`サンプル数: ${embeddings.length}`);
  console.log(`OpenAI: dim=${first.openaiEmbedding.length}, norm=${openaiNorm.toFixed(2)}`);
  console.log(`Gemma:  dim=${first.gemmaEmbedding.length}, norm=${gemmaNorm.toFixed(2)}`);
  console.log(`平均 Kendall τ: ${avgTau.toFixed(3)}`);
  console.log(`平均 Top-5 一致: ${avgOverlap.toFixed(1)}/5 (${((avgOverlap / 5) * 100).toFixed(0)}%)`);

  if (Math.abs(gemmaNorm - 1) >= 0.01) {
    console.log(
      "\n⚠️  Gemmaは未正規化 → Vectorize cosine距離で自動処理されるため問題なし",
    );
  }

  console.log("\n✅ PoC完了");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
