CREATE TABLE post_merges (
  merge_id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_post_id INTEGER NOT NULL REFERENCES dim_posts(post_id),
  target_post_id INTEGER NOT NULL REFERENCES dim_posts(post_id),
  merged_at_utc TEXT NOT NULL,
  merged_at_jst TEXT NOT NULL,
  merged_by_user_uuid TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_post_merges_source ON post_merges(source_post_id);
CREATE INDEX idx_post_merges_target ON post_merges(target_post_id);
