CREATE TABLE IF NOT EXISTS user_library_entries (
  user_uuid TEXT NOT NULL REFERENCES dim_users(user_uuid) ON DELETE CASCADE,
  post_id INTEGER NOT NULL REFERENCES dim_posts(post_id) ON DELETE CASCADE,
  last_viewed_at TEXT NOT NULL,
  PRIMARY KEY (user_uuid, post_id)
);
CREATE INDEX IF NOT EXISTS idx_user_library_history
  ON user_library_entries (user_uuid, last_viewed_at);

CREATE TABLE IF NOT EXISTS user_library_settings (
  user_uuid TEXT NOT NULL PRIMARY KEY REFERENCES dim_users(user_uuid) ON DELETE CASCADE,
  history_enabled INTEGER NOT NULL DEFAULT 1 CHECK (history_enabled IN (0, 1))
);

CREATE TABLE IF NOT EXISTS user_library_reactions (
  user_uuid TEXT NOT NULL REFERENCES dim_users(user_uuid) ON DELETE CASCADE,
  post_id INTEGER NOT NULL REFERENCES dim_posts(post_id) ON DELETE CASCADE,
  comment_id INTEGER REFERENCES dim_comments(comment_id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('like', 'dislike', 'comment_like', 'comment_dislike')),
  target_id INTEGER NOT NULL,
  occurred_at TEXT NOT NULL,
  PRIMARY KEY (user_uuid, kind, target_id),
  CHECK (
    (kind IN ('like', 'dislike') AND comment_id IS NULL AND target_id = post_id)
    OR (kind IN ('comment_like', 'comment_dislike') AND comment_id IS NOT NULL AND target_id = comment_id)
  )
);
CREATE INDEX IF NOT EXISTS idx_user_library_reactions_history
  ON user_library_reactions (user_uuid, occurred_at);
