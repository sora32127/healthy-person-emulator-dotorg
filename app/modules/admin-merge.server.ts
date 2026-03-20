import { drizzle } from 'drizzle-orm/d1';
import { eq, inArray } from 'drizzle-orm';
import { dimPosts, relPostTags, dimTags } from '../drizzle/schema';
import { deleteVectors } from './cloudflare.server';
import { createPostWithTags } from './db.server';
import { createEmbedding } from './embedding.server';
import type { CloudflareEnv } from '../types/env';

export async function mergePosts(
  env: CloudflareEnv,
  sourcePostIds: number[],
  newPostTitle: string,
  newPostContent: string,
): Promise<{ mergedPostId: number }> {
  const db = drizzle(env.DB);

  // 1. ソース記事の存在確認
  const sourcePosts = await db
    .select({ postId: dimPosts.postId, postTitle: dimPosts.postTitle })
    .from(dimPosts)
    .where(inArray(dimPosts.postId, sourcePostIds));

  if (sourcePosts.length !== sourcePostIds.length) {
    const foundIds = sourcePosts.map((p) => p.postId);
    const missingIds = sourcePostIds.filter((id) => !foundIds.includes(id));
    throw new Error(`記事が見つかりません: ${missingIds.join(', ')}`);
  }

  // 2. ソース記事のタグ和集合を算出
  const tagRows = await db
    .select({ tagName: dimTags.tagName })
    .from(relPostTags)
    .innerJoin(dimTags, eq(relPostTags.tagId, dimTags.tagId))
    .where(inArray(relPostTags.postId, sourcePostIds));

  const uniqueTagNames = [...new Set(tagRows.map((t) => t.tagName))];

  // 3. 新規記事を作成
  const newPost = await createPostWithTags({
    postContent: newPostContent,
    postTitle: newPostTitle,
    hashedUserIpAddress: 'admin-merge',
    selectedTags: uniqueTagNames,
  });

  // 4. 新記事の embedding を作成
  await createEmbedding({
    postId: newPost.postId,
    postContent: newPostContent,
    postTitle: newPostTitle,
  });

  // 5. ソース記事を統合済みに更新
  for (const sourcePostId of sourcePostIds) {
    await db
      .update(dimPosts)
      .set({
        mergedIntoPostId: newPost.postId,
        commentStatus: 'closed',
      })
      .where(eq(dimPosts.postId, sourcePostId));
  }

  // 6. ソース記事のベクトルを削除
  try {
    await deleteVectors(sourcePostIds.map(String));
  } catch (err) {
    console.error('[admin-merge] ベクトル削除失敗:', err);
  }

  return { mergedPostId: newPost.postId };
}

export async function generateMergeDraft(
  env: CloudflareEnv,
  sourcePosts: { postId: number; postTitle: string; postContent: string }[],
): Promise<{ title: string; content: string }> {
  const sourceTexts = sourcePosts
    .map((p) => `### 記事ID: ${p.postId}\nタイトル: ${p.postTitle}\n\n${p.postContent}`)
    .join('\n\n---\n\n');

  const prompt = `以下の複数の記事は、内容がほぼ同じです。これらを統合して1つの記事にまとめてください。

ルール:
- 各記事の重要な情報を漏れなく含める
- 重複する情報は1つにまとめる
- 元の記事のHTMLタグ構造を維持する（見出し、リスト等）
- 自然な日本語で読みやすくまとめる
- タイトルも1つにまとめる

出力形式:
最初の行にタイトルを書き、空行の後にHTML形式の本文を書いてください。

---

${sourceTexts}`;

  const result = await env.AI.run('@cf/nvidia/nemotron-3-120b-a12b' as any, {
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 4096,
  });

  const responseText = (result as any).response || '';

  // 最初の行をタイトル、残りを本文として分割
  const lines = responseText.trim().split('\n');
  const title = lines[0].replace(/^#*\s*/, '').trim();
  const content = lines.slice(1).join('\n').trim();

  return { title, content };
}
