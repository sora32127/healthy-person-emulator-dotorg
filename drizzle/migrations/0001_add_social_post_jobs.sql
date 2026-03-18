CREATE TABLE `social_post_jobs` (
  `id` text PRIMARY KEY NOT NULL,
  `post_id` integer NOT NULL,
  `platform` text NOT NULL,
  `status` text NOT NULL DEFAULT 'pending',
  `provider_post_id` text,
  `claimed_at` text,
  `lease_timeout_sec` integer DEFAULT 60,
  `attempt_count` integer DEFAULT 0,
  `last_error` text,
  `resolved_at` text,
  `resolution_note` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
CREATE INDEX `idx_social_post_jobs_post_id` ON `social_post_jobs` (`post_id`);
CREATE INDEX `idx_social_post_jobs_status` ON `social_post_jobs` (`status`);
