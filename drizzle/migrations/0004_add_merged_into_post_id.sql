ALTER TABLE dim_posts ADD COLUMN merged_into_post_id INTEGER;
CREATE INDEX idx_dim_posts_merged_into ON dim_posts(merged_into_post_id);
