import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// ============================================================
// 1. dim_tags
// ============================================================
export const dimTags = sqliteTable("dim_tags", {
  tagId: integer("tag_id").primaryKey({ autoIncrement: true }),
  tagName: text("tag_name").notNull(),
});

// ============================================================
// 2. dim_posts
// ============================================================
export const dimPosts = sqliteTable(
  "dim_posts",
  {
    postId: integer("post_id").primaryKey({ autoIncrement: true }),
    postAuthorIpHash: text("post_author_ip_hash").notNull(),
    postDateJst: text("post_date_jst").notNull(),
    postDateGmt: text("post_date_gmt").notNull(),
    postContent: text("post_content").notNull(),
    postTitle: text("post_title").notNull(),
    commentStatus: text("comment_status").notNull(),
    countLikes: integer("count_likes").notNull().default(0),
    countDislikes: integer("count_dislikes").notNull().default(0),
    uuid: text("uuid").notNull(),
    tokenCount: integer("token_count").notNull().default(0),
    ogpImageUrl: text("ogp_image_url"),
    tweetIdOfFirstTweet: text("tweet_id_of_first_tweet"),
    blueskyPostUriOfFirstPost: text("bluesky_post_uri_of_first_post"),
    misskeyNoteIdOfFirstNote: text("misskey_note_id_of_first_note"),
    isWelcomed: integer("is_welcomed", { mode: "boolean" }),
    isWelcomedExplanation: text("is_welcomed_explanation"),
    isSnsPickuped: integer("is_sns_pickuped", { mode: "boolean" }).default(false),
    isSnsShared: integer("is_sns_shared", { mode: "boolean" }).default(false),
  },
  (table) => [
    uniqueIndex("idx_dim_posts_uuid").on(table.uuid),
  ],
);

// ============================================================
// 3. rel_post_tags
// ============================================================
export const relPostTags = sqliteTable(
  "rel_post_tags",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => dimPosts.postId, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => dimTags.tagId, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.tagId] }),
    index("idx_28958_term_taxonomy_id").on(table.tagId),
    index("idx_dim_tags_post_id").on(table.postId),
  ],
);

// ============================================================
// 4. dim_comments
// ============================================================
export const dimComments = sqliteTable(
  "dim_comments",
  {
    commentId: integer("comment_id").primaryKey({ autoIncrement: true }),
    postId: integer("post_id")
      .notNull()
      .references(() => dimPosts.postId, { onDelete: "cascade" }),
    commentAuthor: text("comment_author").notNull().default("Anonymous"),
    commentAuthorIpHash: text("comment_author_ip_hash").notNull().default(""),
    commentDateJst: text("comment_date_jst").notNull(),
    commentDateGmt: text("comment_date_gmt").notNull(),
    commentContent: text("comment_content").notNull(),
    commentParent: integer("comment_parent").notNull(),
    uuid: text("uuid").notNull(),
  },
  (table) => [
    index("idx_28782_comment_date_gmt").on(table.commentDateGmt),
    index("idx_28782_comment_parent").on(table.commentParent),
    index("idx_28782_comment_post_id").on(table.postId),
  ],
);

// ============================================================
// 5. fct_post_vote_history
// ============================================================
export const fctPostVoteHistory = sqliteTable(
  "fct_post_vote_history",
  {
    postVoteId: integer("post_vote_id").primaryKey({ autoIncrement: true }),
    voteDateGmt: text("vote_date_gmt").notNull(),
    voteUserIpHash: text("vote_user_ip_hash").notNull(),
    postId: integer("post_id")
      .notNull()
      .references(() => dimPosts.postId, { onDelete: "cascade" }),
    voteTypeInt: integer("vote_type_int").notNull(),
    voteDateJst: text("vote_date_jst").notNull(),
  },
  (table) => [
    index("idx_fct_post_vote_history_vote_date_gmt_vote_type_int").on(
      table.voteDateGmt,
      table.voteTypeInt,
    ),
  ],
);

// ============================================================
// 6. fct_comment_vote_history
// ============================================================
export const fctCommentVoteHistory = sqliteTable(
  "fct_comment_vote_history",
  {
    commentVoteId: integer("comment_vote_id").primaryKey({
      autoIncrement: true,
    }),
    voteUserIpHash: text("vote_user_ip_hash").notNull(),
    commentId: integer("comment_id")
      .notNull()
      .references(() => dimComments.commentId, { onDelete: "cascade" }),
    voteType: integer("vote_type").notNull(),
    postId: integer("post_id").notNull().default(0),
    commentVoteDateJst: text("comment_vote_date_jst").notNull(),
    commentVoteDateUtc: text("comment_vote_date_utc").notNull(),
  },
  (table) => [
    index("idx_29085_comment_id").on(table.commentId),
    index("idx_29085_post_id").on(table.postId),
    index("idx_29085_user_id").on(table.voteUserIpHash),
    index("idx_29085_vote_type").on(table.voteType),
  ],
);

// ============================================================
// 7. now_editing_pages
// ============================================================
export const nowEditingPages = sqliteTable("now_editing_pages", {
  postId: integer("post_id")
    .primaryKey()
    .references(() => dimPosts.postId, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  lastHeartBeatAtUtc: text("last_heart_beat_at_utc").notNull(),
});

// ============================================================
// 8. fct_post_edit_history
// ============================================================
export const fctPostEditHistory = sqliteTable(
  "fct_post_edit_history",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => dimPosts.postId, { onDelete: "cascade" }),
    postRevisionNumber: integer("post_revision_number").notNull(),
    postEditDateJst: text("post_edit_date_jst").notNull(),
    postEditDateGmt: text("post_edit_date_gmt").notNull(),
    editorUserId: text("editor_user_id").notNull(),
    postTitleBeforeEdit: text("post_title_before_edit").notNull(),
    postTitleAfterEdit: text("post_title_after_edit").notNull(),
    postContentBeforeEdit: text("post_content_before_edit").notNull(),
    postContentAfterEdit: text("post_content_after_edit").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.postRevisionNumber] }),
  ],
);

// ============================================================
// 9. fct_aicompletion_suggestion_history
// ============================================================
export const fctAicompletionSuggestionHistory = sqliteTable(
  "fct_aicompletion_suggestion_history",
  {
    suggestionId: text("suggestion_id").primaryKey(),
    suggestedUserIpHash: text("suggested_user_ip_hash").notNull(),
    suggestAtUtc: text("suggest_at_utc").notNull(),
    suggestAtJst: text("suggest_at_jst").notNull(),
    usedToken: integer("used_token").notNull(),
    promptText: text("prompt_text").notNull(),
    contextText: text("context_text").notNull(),
    text: text("text").notNull(),
    suggestionResult: text("suggestion_result").notNull(), // JSON string (String[])
  },
);

// ============================================================
// 10. fct_aicompletion_commit_history
// ============================================================
export const fctAicompletionCommitHistory = sqliteTable(
  "fct_aicompletion_commit_history",
  {
    commitId: text("commit_id").primaryKey(),
    commitAtUtc: text("commit_at_utc").notNull(),
    commitAtJst: text("commit_at_jst").notNull(),
    commitUserIpHash: text("commit_user_ip_hash").notNull(),
    suggestionResult: text("suggestion_result").notNull(), // JSON string (String[])
    commitText: text("commit_text").notNull(),
  },
);

// ============================================================
// 11. dim_stop_words
// ============================================================
export const dimStopWords = sqliteTable("dim_stop_words", {
  stopWordId: integer("stop_word_id").primaryKey({ autoIncrement: true }),
  stopWord: text("stop_word").notNull(),
  createdAtGmt: text("created_at_gmt").notNull(),
  createdAtJst: text("created_at_jst").notNull(),
  memo: text("memo").notNull(),
});

// ============================================================
// 12. dim_users
// ============================================================
export const dimUsers = sqliteTable("dim_users", {
  userId: integer("user_id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  encryptedPassword: text("encrypted_password"),
  userCreatedAtGmt: text("user_created_at_gmt").notNull(),
  userCreatedAtJst: text("user_created_at_jst").notNull(),
  userAuthType: text("user_auth_type").notNull(), // 'Email' | 'Google'
  userUuid: text("user_uuid").notNull().unique(),
});

// ============================================================
// 13. fct_user_bookmark_activity
// ============================================================
export const fctUserBookmarkActivity = sqliteTable(
  "fct_user_bookmark_activity",
  {
    bookmarkId: integer("bookmark_id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => dimUsers.userId, { onDelete: "cascade" }),
    postId: integer("post_id")
      .notNull()
      .references(() => dimPosts.postId, { onDelete: "cascade" }),
    bookmarkDateGmt: text("bookmark_date_gmt").notNull(),
    bookmarkDateJst: text("bookmark_date_jst").notNull(),
  },
);
