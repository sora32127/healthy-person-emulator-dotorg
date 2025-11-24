-- PostgreSQL 拡張機能を有効化
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Prisma互換性のため supabase_admin ユーザーを作成
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin'
    ) THEN
        CREATE ROLE supabase_admin WITH LOGIN PASSWORD 'supabase_admin_password';
        ALTER ROLE supabase_admin WITH SUPERUSER;
    END IF;
END;
$$;

-- Supabase Database Functions で定義されている関数を作成
--
-- search_similar_content - 類似した記事を検索
--
CREATE OR REPLACE FUNCTION search_similar_content(
    query_post_id BIGINT,
    match_threshold INTEGER,
    match_count INTEGER
)
RETURNS TABLE (
    post_id INT,
    post_title VARCHAR(255),
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.post_id,
        p.post_title,
        (p.content_embedding <#> q.content_embedding) * -1 AS similarity
    FROM dim_posts p
    CROSS JOIN (
        SELECT content_embedding 
        FROM dim_posts d
        WHERE d.post_id = query_post_id
    ) q
    WHERE (p.content_embedding <#> q.content_embedding) * -1 > match_threshold
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- 必要な権限を付与
GRANT ALL PRIVILEGES ON DATABASE postgres TO postgres;
GRANT ALL PRIVILEGES ON SCHEMA public TO postgres;
