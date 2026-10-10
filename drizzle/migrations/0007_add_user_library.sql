CREATE TABLE IF NOT EXISTS user_library_entries (
  user_uuid TEXT NOT NULL REFERENCES dim_users(user_uuid) ON DELETE CASCADE,
  post_id INTEGER NOT NULL REFERENCES dim_posts(post_id) ON DELETE CASCADE,
  note TEXT NOT NULL DEFAULT '' CHECK(length(note) <= 2000),
  is_saved INTEGER NOT NULL DEFAULT 0 CHECK(is_saved IN (0, 1)),
  saved_at TEXT,
  last_viewed_at TEXT,
  PRIMARY KEY (user_uuid, post_id)
);

CREATE INDEX IF NOT EXISTS idx_user_library_saved ON user_library_entries(user_uuid, is_saved, saved_at);
CREATE INDEX IF NOT EXISTS idx_user_library_history ON user_library_entries(user_uuid, last_viewed_at);

CREATE TABLE IF NOT EXISTS user_library_settings (
  user_uuid TEXT NOT NULL PRIMARY KEY REFERENCES dim_users(user_uuid) ON DELETE CASCADE,
  history_enabled INTEGER NOT NULL DEFAULT 1 CHECK(history_enabled IN (0, 1))
);
