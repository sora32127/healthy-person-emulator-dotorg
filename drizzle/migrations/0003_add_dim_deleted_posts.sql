CREATE TABLE dim_deleted_posts (
  deleted_post_id INTEGER PRIMARY KEY AUTOINCREMENT,
  original_post_id INTEGER NOT NULL,
  post_title TEXT NOT NULL,
  post_content TEXT NOT NULL,
  post_date_gmt TEXT NOT NULL,
  deleted_at_utc TEXT NOT NULL,
  deleted_by_email TEXT NOT NULL,
  deletion_reason TEXT,
  tweet_id_of_first_tweet TEXT,
  bluesky_post_uri_of_first_post TEXT,
  misskey_note_id_of_first_note TEXT
);
