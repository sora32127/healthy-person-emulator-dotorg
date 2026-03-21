CREATE TABLE dim_api_keys (
  api_key_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES dim_users(user_id) ON DELETE CASCADE,
  api_key TEXT NOT NULL UNIQUE,
  is_premium INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_dim_api_keys_user_id ON dim_api_keys(user_id);
