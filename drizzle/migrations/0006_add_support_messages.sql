-- Migration 0008: add_support_messages
-- サポートページで支持を表明できるようにする。名前・メッセージ・金額を保持する。

CREATE TABLE IF NOT EXISTS dim_support_messages (
  support_message_id INTEGER PRIMARY KEY AUTOINCREMENT,
  supporter_name TEXT NOT NULL DEFAULT '匿名',
  support_message TEXT NOT NULL DEFAULT '',
  amount_yen INTEGER NOT NULL,
  stripe_session_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'paid',
  paid_at_utc TEXT NOT NULL,
  paid_at_jst TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dim_support_messages_paid_at_utc ON dim_support_messages(paid_at_utc);
