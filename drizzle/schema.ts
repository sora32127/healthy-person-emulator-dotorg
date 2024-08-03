import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const dimPosts = sqliteTable('dim_posts', {
  postId: integer('post_id').primaryKey(),
  postAuthorIpHash: text('post_author_ip_hash').notNull(),
  postDateJst: text('post_date_jst').notNull().default(sql`datetime('now', 'localtime')`),
  postDateGmt: text('post_date_gmt').notNull().default(sql`datetime('now')`),
  postContent: text('post_content').notNull(),
  postTitle: text('post_title').notNull(),
  commentStatus: text('comment_status').notNull(),
  countLikes: integer('count_likes').notNull().default(0),
  countDislikes: integer('count_dislikes').notNull().default(0),
  uuid: text('uuid').notNull().default(sql`lower(hex(randomblob(16)))`),
  ogpImageUrl: text('ogp_image_url'),
  isSnsShared: integer('is_sns_shared').notNull().default(0),
  isSnsPickuped: integer('is_sns_pickuped').notNull().default(0),
});

export const dimComments = sqliteTable('dim_comments', {
  commentId: integer('comment_id').primaryKey(),
  postId: integer('post_id').notNull().references(() => dimPosts.postId, { onDelete: 'cascade' }),
  commentAuthor: text('comment_author').notNull().default('Anonymous'),
  commentAuthorIpHash: text('comment_author_ip_hash').notNull().default(''),
  commentDateJst: text('comment_date_jst').notNull().default(sql`datetime('now', 'localtime')`),
  commentDateGmt: text('comment_date_gmt').notNull().default(sql`datetime('now')`),
  commentContent: text('comment_content').notNull(),
  commentParent: integer('comment_parent').notNull(),
  uuid: text('uuid').notNull().default(sql`lower(hex(randomblob(16)))`),
});

export const dimTags = sqliteTable('dim_tags', {
  tagId: integer('tag_id').primaryKey(),
  tagName: text('tag_name').notNull(),
});

export const fctCommentVoteHistory = sqliteTable('fct_comment_vote_history', {
  commentVoteId: integer('comment_vote_id').primaryKey(),
  voteUserIpHash: text('vote_user_ip_hash').notNull(),
  commentId: integer('comment_id').notNull().references(() => dimComments.commentId, { onDelete: 'cascade' }),
  voteType: integer('vote_type').notNull(),
  postId: integer('post_id').notNull().references(() => dimPosts.postId, { onDelete: 'cascade' }),
  commentVoteDateJst: text('comment_vote_date_jst').notNull().default(sql`datetime('now', 'localtime')`),
  commentVoteDateUtc: text('comment_vote_date_utc').notNull().default(sql`datetime('now')`),
});

export const fctPostEditHistory = sqliteTable('fct_post_edit_history', {
  postEditId: integer('post_edit_id').primaryKey(),
  postId: integer('post_id').notNull().references(() => dimPosts.postId, { onDelete: 'cascade' }),
  postRevisionNumber: integer('post_revision_number').notNull(),
  postEditDateJst: text('post_edit_date_jst').notNull().default(sql`datetime('now', 'localtime')`),
  postEditDateGmt: text('post_edit_date_gmt').notNull().default(sql`datetime('now')`),
  postTitleBeforeEdit: text('post_title_before_edit').notNull(),
  postTitleAfterEdit: text('post_title_after_edit').notNull(),
  postContentBeforeEdit: text('post_content_before_edit').notNull(),
  postContentAfterEdit: text('post_content_after_edit').notNull(),
  editorUserId: text('editor_user_id'),
});

export const fctPostVoteHistory = sqliteTable('fct_post_vote_history', {
  postVoteId: integer('post_vote_id').primaryKey(),
  voteDateGmt: text('vote_date_gmt').notNull().default(sql`datetime('now')`),
  voteUserIpHash: text('vote_user_ip_hash').notNull(),
  postId: integer('post_id').notNull().references(() => dimPosts.postId, { onDelete: 'cascade' }),
  voteTypeInt: integer('vote_type_int').notNull(),
  voteDateJst: text('vote_date_jst').notNull().default(sql`datetime('now', 'localtime')`),
});

export const nowEditingPages = sqliteTable('now_editing_pages', {
  postId: integer('post_id').primaryKey().references(() => dimPosts.postId, { onDelete: 'cascade' }),
  lastHeartBeatAtUtc: text('last_heart_beat_at_utc').notNull().default(sql`datetime('now')`),
  userId: text('user_id').notNull(),
});

export const relPostTags = sqliteTable('rel_post_tags', {
  relPostTagsId: integer('rel_post_tags_id').primaryKey(),
  postId: integer('post_id').notNull().references(() => dimPosts.postId, { onDelete: 'cascade' }),
  tagId: integer('tag_id').notNull().references(() => dimTags.tagId, { onDelete: 'cascade' }),
});