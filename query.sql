EXPORT DATA OPTIONS(
  uri="gs://hpe-temp/search*.parquet",
  format="PARQUET",
  overwrite=true
) AS 

WITH count_comments AS (
  SELECT post_id, COUNT(comment_id) AS count_comments 
  FROM `hpe_raw.dim_comments`
  GROUP BY post_id
), 

tags AS (
  SELECT rel.post_id, rel.tag_id, dim.tag_name
  FROM `hpe_raw.rel_post_tags` rel
  LEFT JOIN `hpe_raw.dim_tags` dim
  ON rel.tag_id = dim.tag_id
),

tags_agg AS (
  SELECT post_id, ARRAY_AGG(
    STRUCT(tag_id, tag_name)
  ) AS tags
  FROM tags
  GROUP BY post_id
)

SELECT
  dim_posts.post_id,
  post_date_jst,
  post_title,
  post_content,
  count_likes,
  count_dislikes,
  COALESCE(count_comments.count_comments, 0) AS count_comments,
  ogp_image_url,
  tags_agg.tags
FROM `healthy-person-emulator.hpe_raw.dim_posts` AS dim_posts
LEFT JOIN count_comments
  ON dim_posts.post_id = count_comments.post_id
LEFT JOIN tags_agg
  ON dim_posts.post_id = tags_agg.post_id 