import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { dimPosts, dimDeletedPosts, socialPostJobs } from '../drizzle/schema';
import { nowUTC } from '../drizzle/utils';
import { deleteVectors } from './cloudflare.server';
import { deleteFromSocial } from './social/delete.server';
import type { CloudflareEnv } from '../types/env';

const PLATFORM_COLUMN_MAP = {
  twitter: 'tweetIdOfFirstTweet',
  bluesky: 'blueskyPostUriOfFirstPost',
  activitypub: 'misskeyNoteIdOfFirstNote',
} as const;

type Platform = keyof typeof PLATFORM_COLUMN_MAP;

export async function deletePost(
  env: CloudflareEnv,
  postId: number,
  deletedByEmail: string,
  deletionReason?: string,
): Promise<void> {
  const db = drizzle(env.DB);

  // 1. 記事を取得
  const [post] = await db.select().from(dimPosts).where(eq(dimPosts.postId, postId)).limit(1);
  if (!post) {
    throw new Error(`記事 ID ${postId} が見つかりません`);
  }

  // 2. トランザクション内でDB操作
  await db.batch([
    // dim_deleted_posts に記録を挿入
    db.insert(dimDeletedPosts).values({
      originalPostId: post.postId,
      postTitle: post.postTitle,
      postContent: post.postContent,
      postDateGmt: post.postDateGmt,
      deletedAtUtc: nowUTC(),
      deletedByEmail,
      deletionReason: deletionReason || null,
      tweetIdOfFirstTweet: post.tweetIdOfFirstTweet,
      blueskyPostUriOfFirstPost: post.blueskyPostUriOfFirstPost,
      misskeyNoteIdOfFirstNote: post.misskeyNoteIdOfFirstNote,
    }),
    // social_post_jobs を削除（FKなし）
    db.delete(socialPostJobs).where(eq(socialPostJobs.postId, postId)),
    // dim_posts を削除（CASCADE で子テーブル自動削除）
    db.delete(dimPosts).where(eq(dimPosts.postId, postId)),
  ]);

  // 3. ベクトル削除
  try {
    await deleteVectors([String(postId)]);
  } catch (err) {
    console.error(`[admin-delete] ベクトル削除失敗 (postId=${postId}):`, err);
  }

  // 4. OGP画像削除
  try {
    await env.STATIC_BUCKET.delete(`ogp/${postId}.jpg`);
  } catch (err) {
    console.error(`[admin-delete] OGP画像削除失敗 (postId=${postId}):`, err);
  }

  // 5. SNS投稿削除
  const snsEntries: Array<{ platform: Platform; providerPostId: string }> = [];
  if (post.tweetIdOfFirstTweet) {
    snsEntries.push({ platform: 'twitter', providerPostId: post.tweetIdOfFirstTweet });
  }
  if (post.blueskyPostUriOfFirstPost) {
    snsEntries.push({ platform: 'bluesky', providerPostId: post.blueskyPostUriOfFirstPost });
  }
  if (post.misskeyNoteIdOfFirstNote) {
    snsEntries.push({ platform: 'activitypub', providerPostId: post.misskeyNoteIdOfFirstNote });
  }

  for (const entry of snsEntries) {
    try {
      await deleteFromSocial(env, {
        platform: entry.platform,
        providerPostId: entry.providerPostId,
      });
    } catch (err) {
      console.error(`[admin-delete] SNS削除失敗 (${entry.platform}, postId=${postId}):`, err);
    }
  }
}
