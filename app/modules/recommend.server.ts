/*
リコメンドアルゴリズムの詳細について記載する

# アルゴリズム概要

## インターフェイス
- インプットは以下の二種類
  1. ユーザーが過去に閲覧した記事のリスト
  2. ユーザーが過去にいいねした記事のリスト
- アウトプット
  - 記事データのリスト

## 処理ロジック
- インプット配列を以下の順番でソートする
  - いいねした記事の中では、いいねした日付が新しい順
  - 閲覧した記事の中では、閲覧日付が新しい順
- インプット配列を合算する
  - 最大要素数は100件までにする
- ソートした順番でウェイトをつける
  - スーパー楕円を使ってウェイトをつける
  - ウェイトの計算式は以下の通り
    - ウェイト w = (1 - i^a)^(1/a)
    - i は記事のインデックスを100で割った値
    - a はパラメータ
- 記事のベクトルに対してウェイトをかけ、合算する
- 合算したベクトルに最も近い記事を10件取得する
*/

import { z } from "zod";
import { prisma } from "./db.server";

const RecommendInputSchema = z.object({
    likedPosts: z.array(
        z.object({
            postId: z.number(),
            likedAtGMT: z.date().transform(d => new Date(d.getTime()))
        })
    ),
    viewedPosts: z.array(
        z.object({
            postId: z.number(),
            viewedAtGMT: z.date().transform(d => new Date(d.getTime()))
        })
    )
})
type RecommendInput = z.infer<typeof RecommendInputSchema>;

const RecommendParametersSchema = z.object({
    elipse_weight: z.number(),
})
type RecommendParameters = z.infer<typeof RecommendParametersSchema>;

const RecommendResultSchema = z.array(z.object({
    postId: z.number(),
    postTitle: z.string(),
    postDateGmt: z.date(),
    countLikes: z.number(),
}))
type RecommendResult = z.infer<typeof RecommendResultSchema>;

export async function getRecommendPosts(input: RecommendInput, parameters: RecommendParameters): Promise<RecommendResult> {
    const validatedInput = RecommendInputSchema.parse({
        likedPosts: input.likedPosts.map(post => ({
            ...post,
            likedAtGMT: new Date(post.likedAtGMT)
        })),
        viewedPosts: input.viewedPosts.map(post => ({
            ...post,
            viewedAtGMT: new Date(post.viewedAtGMT)
        }))
    });

    validatedInput.likedPosts.sort((a, b) => b.likedAtGMT.getTime() - a.likedAtGMT.getTime());
    validatedInput.viewedPosts.sort((a, b) => b.viewedAtGMT.getTime() - a.viewedAtGMT.getTime());

    const allPosts = [...validatedInput.likedPosts, ...validatedInput.viewedPosts].slice(0, Math.min(validatedInput.likedPosts.length + validatedInput.viewedPosts.length - 1, 100));

    const weightsArray = allPosts.map((post, index) => {
        const relativeIndex = index / (allPosts.length);
        const weight = (1 - relativeIndex ** parameters.elipse_weight) ** (1 / parameters.elipse_weight);
        return {
            postId: post.postId,
            weight: weight,
        }
    });
    const recommendedPosts = await getRecommendedPostsFromDB(weightsArray);
    return recommendedPosts;
}

async function getRecommendedPostsFromDB(weightsArray: { postId: number, weight: number }[]): Promise<RecommendResult> {
    
    const results = await prisma.$queryRaw<Array<{
        post_id: number,
        post_title: string,
        post_date_gmt: Date,
        count_likes: number
    }>>`SELECT * FROM get_recommended_posts(${weightsArray}::jsonb[])`;

    return results.map(result => ({
        postId: result.post_id,
        postTitle: result.post_title,
        postDateGmt: result.post_date_gmt,
        countLikes: result.count_likes
    }));
}

/*
DB内部のストアドプロシージャは以下の通り
```sqlCREATE OR REPLACE FUNCTION get_recommended_posts(
    weights jsonb[]  -- [{postId: number, weight: number}, ...]の形式
)
RETURNS TABLE (
    post_id INTEGER,
    post_title TEXT,
    post_date_gmt TIMESTAMP WITH TIME ZONE,
    count_likes INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH weighted_vectors AS (
        -- 重み付きベクトルの計算
        SELECT 
            array(
                SELECT unnest(p.content_embedding::real[]) * (w->>'weight')::float
            )::vector as combined_vector
        FROM 
            dim_posts as p
        INNER JOIN 
            unnest($1) AS w
            ON p.post_id = (w->>'postId')::integer
    ),
    summed_vector AS (
        -- 重み付きベクトルの合計を計算
        SELECT SUM(combined_vector) as final_vector
        FROM weighted_vectors
    ), result as (
    SELECT 
        p.post_id,
        p.post_title::text,
        p.post_date_gmt::timestamp with time zone,
        p.count_likes
    FROM 
        dim_posts as p,
        summed_vector as sv
    WHERE 
        -- 入力された記事IDには含まれていない記事から選択
        p.post_id NOT IN (
            SELECT (w->>'postId')::integer 
            FROM unnest($1) w
        )
    ORDER BY 
        -- コサイン類似度で並び替え
        p.content_embedding <=> sv.final_vector
    LIMIT 10
    )
    select * from result
    order by count_likes desc, post_date_gmt desc;
END
$$ LANGUAGE plpgsql;
```
*/