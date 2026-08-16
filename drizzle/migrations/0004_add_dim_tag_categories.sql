-- Migration 0004: add_dim_tag_categories

CREATE TABLE IF NOT EXISTS dim_tag_categories (
  category_id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_code TEXT NOT NULL UNIQUE,
  category_name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS rel_tag_categories (
  tag_id INTEGER NOT NULL REFERENCES dim_tags(tag_id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES dim_tag_categories(category_id) ON DELETE CASCADE,
  PRIMARY KEY (tag_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_rel_tag_categories_tag_id ON rel_tag_categories(tag_id);
CREATE INDEX IF NOT EXISTS idx_rel_tag_categories_category_id ON rel_tag_categories(category_id);

-- 「推奨事項分類」カテゴリを登録
INSERT OR IGNORE INTO dim_tag_categories (category_id, category_code, category_name, display_order)
VALUES (1, 'recommendation', '推奨事項分類', 1);

-- 該当タグ（8タグ）が存在する場合のみ紐付け
INSERT OR IGNORE INTO rel_tag_categories (tag_id, category_id)
SELECT tag_id, 1
FROM dim_tags
WHERE tag_name IN (
  'やってはいけないこと',
  'やらないほうがよいこと',
  'やったほうがよいこと',
  'やってよかったこと',
  'やらなかったほうがよかったこと',
  'こうしたほうがよかったこと',
  'やってもいいこと',
  'やってほしくなかったこと'
);
