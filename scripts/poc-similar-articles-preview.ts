/**
 * 類似記事プレビュー: OpenAI vs EmbeddingGemma の類似検索結果を並べて表示
 *
 * CF_API_TOKEN=xxx pnpm tsx scripts/poc-similar-articles-preview.ts
 */

import { PrismaClient } from "@prisma/client";
import { OpenAI } from "openai";

const prisma = new PrismaClient();
const CLOUDFLARE_ACCOUNT_ID =
  process.env.CLOUDFLARE_ACCOUNT_ID || "9ecb9a8692f7c2c5c56387d93a9a1e60";
const CF_API_TOKEN = process.env.CF_API_TOKEN;

const POOL_SIZE = 100; // 類似検索の候補プール
const QUERY_COUNT = 15; // クエリする投稿数
const TOP_K = 5; // 表示する類似記事数

interface PostData {
  post_id: number;
  post_title: string;
  post_content: string;
  token_count: number | null;
}

async function getGemmaEmbedding(text: string): Promise<number[]> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/google/embeddinggemma-300m`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: [text] }),
    },
  );
  const data = (await res.json()) as { result: { data: number[][] }; success: boolean };
  return data.result.data[0];
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function main() {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // ランダムに候補プールを取得（最近の投稿から）
  const posts = await prisma.$queryRaw<PostData[]>`
    SELECT post_id, post_title, post_content, token_count
    FROM dim_posts
    WHERE post_content IS NOT NULL AND post_content != ''
    ORDER BY post_id DESC
    LIMIT ${POOL_SIZE}
  `;

  console.log(`候補プール: ${posts.length}件（最近の投稿）\n`);
  console.log("Embedding生成中...");

  // 全候補のembeddingを生成
  const openaiEmbs: Map<number, number[]> = new Map();
  const gemmaEmbs: Map<number, number[]> = new Map();

  for (const post of posts) {
    const inputText = `タイトル: ${post.post_title}\n本文: ${post.post_content}`;
    const gemmaInput = inputText.slice(0, 4000);

    try {
      const [oai, gemma] = await Promise.all([
        openai.embeddings.create({ model: "text-embedding-3-small", input: inputText }),
        getGemmaEmbedding(gemmaInput),
      ]);
      openaiEmbs.set(post.post_id, oai.data[0].embedding);
      gemmaEmbs.set(post.post_id, gemma);
      process.stdout.write(".");
    } catch (e) {
      process.stdout.write("x");
    }
  }
  console.log(` done (${openaiEmbs.size}件)\n`);

  // クエリ投稿を選んで類似検索
  const queryPosts = posts.slice(0, QUERY_COUNT);

  for (const qp of queryPosts) {
    const oaiVec = openaiEmbs.get(qp.post_id);
    const gemVec = gemmaEmbs.get(qp.post_id);
    if (!oaiVec || !gemVec) continue;

    // OpenAI ランキング
    const oaiRanked = posts
      .filter((p) => p.post_id !== qp.post_id && openaiEmbs.has(p.post_id))
      .map((p) => ({
        id: p.post_id,
        title: p.post_title,
        sim: cosineSimilarity(oaiVec, openaiEmbs.get(p.post_id)!),
      }))
      .sort((a, b) => b.sim - a.sim)
      .slice(0, TOP_K);

    // Gemma ランキング
    const gemRanked = posts
      .filter((p) => p.post_id !== qp.post_id && gemmaEmbs.has(p.post_id))
      .map((p) => ({
        id: p.post_id,
        title: p.post_title,
        sim: cosineSimilarity(gemVec, gemmaEmbs.get(p.post_id)!),
      }))
      .sort((a, b) => b.sim - a.sim)
      .slice(0, TOP_K);

    console.log("━".repeat(80));
    console.log(`📝 クエリ: [${qp.post_id}] ${qp.post_title}`);
    console.log("");

    console.log("  OpenAI text-embedding-3-small:");
    for (let i = 0; i < oaiRanked.length; i++) {
      const r = oaiRanked[i];
      const inGemma = gemRanked.some((g) => g.id === r.id);
      console.log(
        `    ${i + 1}. [${r.id}] ${r.title.slice(0, 50)} (${r.sim.toFixed(3)}) ${inGemma ? "✅" : ""}`,
      );
    }

    console.log("");
    console.log("  EmbeddingGemma-300m:");
    for (let i = 0; i < gemRanked.length; i++) {
      const r = gemRanked[i];
      const inOai = oaiRanked.some((o) => o.id === r.id);
      console.log(
        `    ${i + 1}. [${r.id}] ${r.title.slice(0, 50)} (${r.sim.toFixed(3)}) ${inOai ? "✅" : ""}`,
      );
    }
    console.log("");
  }

  console.log("━".repeat(80));
  console.log("✅ = 両モデルのTop-5に共通して含まれる記事");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
