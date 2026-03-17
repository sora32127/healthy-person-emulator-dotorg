import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();
const OUTPUT_DIR = path.join(__dirname, "d1-migration");
const BATCH_SIZE = 500;

function escapeSQL(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  if (value instanceof Date) return `'${value.toISOString()}'`;
  return `'${String(value).replace(/'/g, "''")}'`;
}

function migrateTable(
  tableName: string,
  rows: Record<string, unknown>[],
  columns: string[]
): void {
  console.log(`Migrating ${tableName}: ${rows.length} rows`);
  const sqlLines: string[] = [];

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    for (const row of batch) {
      const values = columns.map((col) => escapeSQL(row[col]));
      sqlLines.push(
        `INSERT OR REPLACE INTO ${tableName} (${columns.join(", ")}) VALUES (${values.join(", ")});`
      );
    }
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, `${tableName}.sql`), sqlLines.join("\n") + "\n");
  console.log(`  -> ${sqlLines.length} INSERT statements written`);
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const summary: { table: string; count: number }[] = [];

  // ============================================================
  // 1. dim_tags (no FK dependencies)
  // ============================================================
  const dimTags = await prisma.dimTags.findMany();
  const dimTagsRows = dimTags.map((r) => ({
    tag_id: r.tagId,
    tag_name: r.tagName,
  }));
  migrateTable("dim_tags", dimTagsRows, ["tag_id", "tag_name"]);
  summary.push({ table: "dim_tags", count: dimTagsRows.length });

  // ============================================================
  // 2. dim_users (no FK dependencies)
  // ============================================================
  const dimUsers = await prisma.dimUsers.findMany();
  const dimUsersRows = dimUsers.map((r) => ({
    user_id: r.userId,
    email: r.email,
    encrypted_password: r.encryptedPassword,
    user_created_at_gmt: r.userCreatedAtGMT,
    user_created_at_jst: r.userCreatedAtJST,
    user_auth_type: r.userAuthType,
    user_uuid: r.userUuid,
  }));
  migrateTable("dim_users", dimUsersRows, [
    "user_id",
    "email",
    "encrypted_password",
    "user_created_at_gmt",
    "user_created_at_jst",
    "user_auth_type",
    "user_uuid",
  ]);
  summary.push({ table: "dim_users", count: dimUsersRows.length });

  // ============================================================
  // 3. dim_posts (depends on nothing for FK insert order)
  //    Exclude content_embedding. Convert is_welcomed boolean -> 0/1.
  // ============================================================
  const dimPosts = await prisma.$queryRaw<
    {
      post_id: number;
      post_author_ip_hash: string;
      post_date_jst: Date;
      post_date_gmt: Date;
      post_content: string;
      post_title: string;
      comment_status: string;
      count_likes: number;
      count_dislikes: number;
      uuid: string;
      token_count: number | null;
      ogp_image_url: string | null;
      tweet_id_of_first_tweet: string | null;
      bluesky_post_uri_of_first_post: string | null;
      misskey_note_id_of_first_note: string | null;
      is_welcomed: boolean | null;
      is_welcomed_explanation: string | null;
    }[]
  >`SELECT post_id, post_author_ip_hash, post_date_jst, post_date_gmt, post_content, post_title, comment_status, count_likes, count_dislikes, uuid, token_count, ogp_image_url, tweet_id_of_first_tweet, bluesky_post_uri_of_first_post, misskey_note_id_of_first_note, is_welcomed, is_welcomed_explanation FROM dim_posts`;
  const dimPostsRows = dimPosts.map((r) => ({
    post_id: r.post_id,
    post_author_ip_hash: r.post_author_ip_hash,
    post_date_jst: r.post_date_jst,
    post_date_gmt: r.post_date_gmt,
    post_content: r.post_content,
    post_title: r.post_title,
    comment_status: r.comment_status,
    count_likes: r.count_likes,
    count_dislikes: r.count_dislikes,
    uuid: r.uuid,
    token_count: r.token_count ?? 0,
    ogp_image_url: r.ogp_image_url,
    tweet_id_of_first_tweet: r.tweet_id_of_first_tweet,
    bluesky_post_uri_of_first_post: r.bluesky_post_uri_of_first_post,
    misskey_note_id_of_first_note: r.misskey_note_id_of_first_note,
    is_welcomed: r.is_welcomed == null ? null : r.is_welcomed ? 1 : 0,
    is_welcomed_explanation: r.is_welcomed_explanation,
  }));
  migrateTable("dim_posts", dimPostsRows, [
    "post_id",
    "post_author_ip_hash",
    "post_date_jst",
    "post_date_gmt",
    "post_content",
    "post_title",
    "comment_status",
    "count_likes",
    "count_dislikes",
    "uuid",
    "token_count",
    "ogp_image_url",
    "tweet_id_of_first_tweet",
    "bluesky_post_uri_of_first_post",
    "misskey_note_id_of_first_note",
    "is_welcomed",
    "is_welcomed_explanation",
  ]);
  summary.push({ table: "dim_posts", count: dimPostsRows.length });

  // ============================================================
  // 4. rel_post_tags (depends on dim_tags, dim_posts)
  // ============================================================
  const relPostTags = await prisma.relPostTags.findMany();
  const relPostTagsRows = relPostTags.map((r) => ({
    post_id: r.postId,
    tag_id: r.tagId,
  }));
  migrateTable("rel_post_tags", relPostTagsRows, ["post_id", "tag_id"]);
  summary.push({ table: "rel_post_tags", count: relPostTagsRows.length });

  // ============================================================
  // 5. dim_comments (depends on dim_posts)
  // ============================================================
  const dimComments = await prisma.dimComments.findMany();
  const dimCommentsRows = dimComments.map((r) => ({
    comment_id: r.commentId,
    post_id: r.postId,
    comment_author: r.commentAuthor,
    comment_author_ip_hash: r.commentAuthorIpHash,
    comment_date_jst: r.commentDateJst,
    comment_date_gmt: r.commentDateGmt,
    comment_content: r.commentContent,
    comment_parent: r.commentParent,
    uuid: r.uuid,
  }));
  migrateTable("dim_comments", dimCommentsRows, [
    "comment_id",
    "post_id",
    "comment_author",
    "comment_author_ip_hash",
    "comment_date_jst",
    "comment_date_gmt",
    "comment_content",
    "comment_parent",
    "uuid",
  ]);
  summary.push({ table: "dim_comments", count: dimCommentsRows.length });

  // ============================================================
  // 6. now_editing_pages (depends on dim_posts)
  // ============================================================
  const nowEditing = await prisma.nowEditingPages.findMany();
  const nowEditingRows = nowEditing.map((r) => ({
    post_id: r.postId,
    user_id: r.userId,
    last_heart_beat_at_utc: r.lastHeartBeatAtUTC,
  }));
  migrateTable("now_editing_pages", nowEditingRows, [
    "post_id",
    "user_id",
    "last_heart_beat_at_utc",
  ]);
  summary.push({ table: "now_editing_pages", count: nowEditingRows.length });

  // ============================================================
  // 7. fct_post_vote_history (depends on dim_posts)
  // ============================================================
  const postVotes = await prisma.fctPostVoteHistory.findMany();
  const postVotesRows = postVotes.map((r) => ({
    post_vote_id: r.postVoteId,
    vote_date_gmt: r.voteDateGmt,
    vote_user_ip_hash: r.voteUserIpHash,
    post_id: r.postId,
    vote_type_int: r.voteTypeInt,
    vote_date_jst: r.vote_date_jst,
  }));
  migrateTable("fct_post_vote_history", postVotesRows, [
    "post_vote_id",
    "vote_date_gmt",
    "vote_user_ip_hash",
    "post_id",
    "vote_type_int",
    "vote_date_jst",
  ]);
  summary.push({ table: "fct_post_vote_history", count: postVotesRows.length });

  // ============================================================
  // 8. fct_comment_vote_history (depends on dim_comments)
  //    post_id: Decimal -> integer
  // ============================================================
  const commentVotes = await prisma.fctCommentVoteHistory.findMany();
  const commentVotesRows = commentVotes.map((r) => ({
    comment_vote_id: r.commentVoteId,
    vote_user_ip_hash: r.voteUserIpHash,
    comment_id: r.commentId,
    vote_type: r.voteType,
    post_id: Number(r.postId),
    comment_vote_date_jst: r.commentVoteDateJst,
    comment_vote_date_utc: r.comment_vote_date_utc,
  }));
  migrateTable("fct_comment_vote_history", commentVotesRows, [
    "comment_vote_id",
    "vote_user_ip_hash",
    "comment_id",
    "vote_type",
    "post_id",
    "comment_vote_date_jst",
    "comment_vote_date_utc",
  ]);
  summary.push({
    table: "fct_comment_vote_history",
    count: commentVotesRows.length,
  });

  // ============================================================
  // 9. fct_post_edit_history (depends on dim_posts)
  // ============================================================
  const postEdits = await prisma.fctPostEditHistory.findMany();
  const postEditsRows = postEdits.map((r) => ({
    post_id: r.postId,
    post_revision_number: r.postRevisionNumber,
    post_edit_date_jst: r.postEditDateJst,
    post_edit_date_gmt: r.postEditDateGmt,
    editor_user_id: r.editorUserId,
    post_title_before_edit: r.postTitleBeforeEdit,
    post_title_after_edit: r.postTitleAfterEdit,
    post_content_before_edit: r.postContentBeforeEdit,
    post_content_after_edit: r.postContentAfterEdit,
  }));
  migrateTable("fct_post_edit_history", postEditsRows, [
    "post_id",
    "post_revision_number",
    "post_edit_date_jst",
    "post_edit_date_gmt",
    "editor_user_id",
    "post_title_before_edit",
    "post_title_after_edit",
    "post_content_before_edit",
    "post_content_after_edit",
  ]);
  summary.push({
    table: "fct_post_edit_history",
    count: postEditsRows.length,
  });

  // ============================================================
  // 10. fct_user_bookmark_activity (depends on dim_users, dim_posts)
  // ============================================================
  const bookmarks = await prisma.fctUserBookmarkActivity.findMany();
  const bookmarksRows = bookmarks.map((r) => ({
    bookmark_id: r.bookmarkId,
    user_id: r.userId,
    post_id: r.postId,
    bookmark_date_gmt: r.bookmarkDateGMT,
    bookmark_date_jst: r.bookmarkDateJST,
  }));
  migrateTable("fct_user_bookmark_activity", bookmarksRows, [
    "bookmark_id",
    "user_id",
    "post_id",
    "bookmark_date_gmt",
    "bookmark_date_jst",
  ]);
  summary.push({
    table: "fct_user_bookmark_activity",
    count: bookmarksRows.length,
  });

  // ============================================================
  // 11. fct_aicompletion_suggestion_history (independent)
  //     suggestion_result: String[] -> JSON.stringify()
  // ============================================================
  try {
    const suggestions =
      await prisma.fctAICompletionSuggestionHistory.findMany();
    const suggestionsRows = suggestions.map((r) => ({
      suggestion_id: r.suggestionId,
      suggested_user_ip_hash: r.suggestedUserIPHash,
      suggest_at_utc: r.suggestionAtUtc,
      suggest_at_jst: r.suggestionAtJst,
      used_token: r.usedTokens,
      prompt_text: r.promptText,
      context_text: r.contextText,
      text: r.text,
      suggestion_result: JSON.stringify(r.suggestionResult),
    }));
    migrateTable("fct_aicompletion_suggestion_history", suggestionsRows, [
      "suggestion_id",
      "suggested_user_ip_hash",
      "suggest_at_utc",
      "suggest_at_jst",
      "used_token",
      "prompt_text",
      "context_text",
      "text",
      "suggestion_result",
    ]);
    summary.push({
      table: "fct_aicompletion_suggestion_history",
      count: suggestionsRows.length,
    });
  } catch (e) {
    console.warn("  [SKIP] fct_aicompletion_suggestion_history: table not found or error:", (e as Error).message);
    summary.push({ table: "fct_aicompletion_suggestion_history (SKIPPED)", count: 0 });
  }

  // ============================================================
  // 12. fct_aicompletion_commit_history (independent)
  //     suggestion_result: String[] -> JSON.stringify()
  // ============================================================
  try {
    const commits = await prisma.fctAICompletionCommitHistory.findMany();
    const commitsRows = commits.map((r) => ({
      commit_id: r.commitId,
      commit_at_utc: r.commitAtUtc,
      commit_at_jst: r.commitAtJst,
      commit_user_ip_hash: r.commitUserIPHash,
      suggestion_result: JSON.stringify(r.suggestionResult),
      commit_text: r.commitText,
    }));
    migrateTable("fct_aicompletion_commit_history", commitsRows, [
      "commit_id",
      "commit_at_utc",
      "commit_at_jst",
      "commit_user_ip_hash",
      "suggestion_result",
      "commit_text",
    ]);
    summary.push({
      table: "fct_aicompletion_commit_history",
      count: commitsRows.length,
    });
  } catch (e) {
    console.warn("  [SKIP] fct_aicompletion_commit_history: table not found or error:", (e as Error).message);
    summary.push({ table: "fct_aicompletion_commit_history (SKIPPED)", count: 0 });
  }

  // ============================================================
  // 13. dim_stop_words (independent)
  // ============================================================
  try {
    const stopWords = await prisma.dimStopWords.findMany();
    const stopWordsRows = stopWords.map((r) => ({
      stop_word_id: r.stopWordId,
      stop_word: r.stopWord,
      created_at_gmt: r.createdAtGMT,
      created_at_jst: r.createdAtJST,
      memo: r.memo,
    }));
    migrateTable("dim_stop_words", stopWordsRows, [
      "stop_word_id",
      "stop_word",
      "created_at_gmt",
      "created_at_jst",
      "memo",
    ]);
    summary.push({ table: "dim_stop_words", count: stopWordsRows.length });
  } catch (e) {
    console.warn("  [SKIP] dim_stop_words: table not found or error:", (e as Error).message);
    summary.push({ table: "dim_stop_words (SKIPPED)", count: 0 });
  }

  // ============================================================
  // Summary
  // ============================================================
  console.log("\n=== Migration Summary ===");
  let total = 0;
  for (const s of summary) {
    console.log(`  ${s.table}: ${s.count} rows`);
    total += s.count;
  }
  console.log(`  ----------`);
  console.log(`  Total: ${total} rows`);
  console.log(`\nSQL files written to: ${OUTPUT_DIR}`);
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
