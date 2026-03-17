CREATE TABLE `dim_comments` (
	`comment_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`post_id` integer NOT NULL,
	`comment_author` text DEFAULT 'Anonymous' NOT NULL,
	`comment_author_ip_hash` text DEFAULT '' NOT NULL,
	`comment_date_jst` text NOT NULL,
	`comment_date_gmt` text NOT NULL,
	`comment_content` text NOT NULL,
	`comment_parent` integer NOT NULL,
	`uuid` text NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `dim_posts`(`post_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_28782_comment_date_gmt` ON `dim_comments` (`comment_date_gmt`);--> statement-breakpoint
CREATE INDEX `idx_28782_comment_parent` ON `dim_comments` (`comment_parent`);--> statement-breakpoint
CREATE INDEX `idx_28782_comment_post_id` ON `dim_comments` (`post_id`);--> statement-breakpoint
CREATE TABLE `dim_posts` (
	`post_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`post_author_ip_hash` text NOT NULL,
	`post_date_jst` text NOT NULL,
	`post_date_gmt` text NOT NULL,
	`post_content` text NOT NULL,
	`post_title` text NOT NULL,
	`comment_status` text NOT NULL,
	`count_likes` integer DEFAULT 0 NOT NULL,
	`count_dislikes` integer DEFAULT 0 NOT NULL,
	`uuid` text NOT NULL,
	`token_count` integer DEFAULT 0 NOT NULL,
	`ogp_image_url` text,
	`tweet_id_of_first_tweet` text,
	`bluesky_post_uri_of_first_post` text,
	`misskey_note_id_of_first_note` text,
	`is_welcomed` integer,
	`is_welcomed_explanation` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_dim_posts_uuid` ON `dim_posts` (`uuid`);--> statement-breakpoint
CREATE TABLE `dim_stop_words` (
	`stop_word_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`stop_word` text NOT NULL,
	`created_at_gmt` text NOT NULL,
	`created_at_jst` text NOT NULL,
	`memo` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `dim_tags` (
	`tag_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tag_name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `dim_users` (
	`user_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`encrypted_password` text,
	`user_created_at_gmt` text NOT NULL,
	`user_created_at_jst` text NOT NULL,
	`user_auth_type` text NOT NULL,
	`user_uuid` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dim_users_email_unique` ON `dim_users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `dim_users_user_uuid_unique` ON `dim_users` (`user_uuid`);--> statement-breakpoint
CREATE TABLE `fct_aicompletion_commit_history` (
	`commit_id` text PRIMARY KEY NOT NULL,
	`commit_at_utc` text NOT NULL,
	`commit_at_jst` text NOT NULL,
	`commit_user_ip_hash` text NOT NULL,
	`suggestion_result` text NOT NULL,
	`commit_text` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `fct_aicompletion_suggestion_history` (
	`suggestion_id` text PRIMARY KEY NOT NULL,
	`suggested_user_ip_hash` text NOT NULL,
	`suggest_at_utc` text NOT NULL,
	`suggest_at_jst` text NOT NULL,
	`used_token` integer NOT NULL,
	`prompt_text` text NOT NULL,
	`context_text` text NOT NULL,
	`text` text NOT NULL,
	`suggestion_result` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `fct_comment_vote_history` (
	`comment_vote_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`vote_user_ip_hash` text NOT NULL,
	`comment_id` integer NOT NULL,
	`vote_type` integer NOT NULL,
	`post_id` integer DEFAULT 0 NOT NULL,
	`comment_vote_date_jst` text NOT NULL,
	`comment_vote_date_utc` text NOT NULL,
	FOREIGN KEY (`comment_id`) REFERENCES `dim_comments`(`comment_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_29085_comment_id` ON `fct_comment_vote_history` (`comment_id`);--> statement-breakpoint
CREATE INDEX `idx_29085_post_id` ON `fct_comment_vote_history` (`post_id`);--> statement-breakpoint
CREATE INDEX `idx_29085_user_id` ON `fct_comment_vote_history` (`vote_user_ip_hash`);--> statement-breakpoint
CREATE INDEX `idx_29085_vote_type` ON `fct_comment_vote_history` (`vote_type`);--> statement-breakpoint
CREATE TABLE `fct_post_edit_history` (
	`post_id` integer NOT NULL,
	`post_revision_number` integer NOT NULL,
	`post_edit_date_jst` text NOT NULL,
	`post_edit_date_gmt` text NOT NULL,
	`editor_user_id` text NOT NULL,
	`post_title_before_edit` text NOT NULL,
	`post_title_after_edit` text NOT NULL,
	`post_content_before_edit` text NOT NULL,
	`post_content_after_edit` text NOT NULL,
	PRIMARY KEY(`post_id`, `post_revision_number`),
	FOREIGN KEY (`post_id`) REFERENCES `dim_posts`(`post_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `fct_post_vote_history` (
	`post_vote_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`vote_date_gmt` text NOT NULL,
	`vote_user_ip_hash` text NOT NULL,
	`post_id` integer NOT NULL,
	`vote_type_int` integer NOT NULL,
	`vote_date_jst` text NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `dim_posts`(`post_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_fct_post_vote_history_vote_date_gmt_vote_type_int` ON `fct_post_vote_history` (`vote_date_gmt`,`vote_type_int`);--> statement-breakpoint
CREATE TABLE `fct_user_bookmark_activity` (
	`bookmark_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`post_id` integer NOT NULL,
	`bookmark_date_gmt` text NOT NULL,
	`bookmark_date_jst` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `dim_users`(`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`post_id`) REFERENCES `dim_posts`(`post_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `now_editing_pages` (
	`post_id` integer PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`last_heart_beat_at_utc` text NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `dim_posts`(`post_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `rel_post_tags` (
	`post_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`post_id`, `tag_id`),
	FOREIGN KEY (`post_id`) REFERENCES `dim_posts`(`post_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `dim_tags`(`tag_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_28958_term_taxonomy_id` ON `rel_post_tags` (`tag_id`);--> statement-breakpoint
CREATE INDEX `idx_dim_tags_post_id` ON `rel_post_tags` (`post_id`);