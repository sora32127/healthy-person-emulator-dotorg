/*
# 検索ロジックの詳細について
検索ロジックは複雑なので、コメントを入れて説明する

## Input:
- 検索キーワード (q)
- タグ (tags)
- ページ番号 (p)
- 並び替え識別子 (orderby)

## Output: 
- 検索メタデータ
  - 合計結果表示数：ページネーションに使う
  - タグ名とタグ数の対応データ：ファセットフィルタに使う
  - 検索パラメータの集合：結果表示に使う
- 検索結果
  - ポストカードデータ
    - postId
    - postTitle
    - postDateGmt
    - tagNames
    - countLikes
    - countDislikes
    - OG画像URL
    - コメント数

## 検索ロジックの詳細
検索キーワード、およびタグの値に応じて場合分けを行う
1. 検索キーワードが空で、タグの値が空の場合
→　全件検索として扱う。通常のフィードと同様のもの。

2. 検索キーワードに値があり、タグが空の場合
→　検索キーワードによる絞り込みを行う。

3. 検索キーワードが空で、タグに値がある場合
→　タグによる絞り込みを行う。

4. 検索キーワードに値があり、タグに値がある場合
→　検索キーワードによる絞り込みを行った後、タグによる絞り込みを行う。

## 検索ロジックの詳細

前提：
- 検索キーワードが複数ある場合、すべてのキーワードが含まれる投稿を検索する
- 検索キーワードはタイトルと本文に含まれるものとする

### 1. 検索キーワードが空で、タグの値が空の場合
簡単なので割愛する

### 2. 検索キーワードに値があり、タグが空の場合
- 検索ワードによる投稿の絞り込みを行う
- タグ数を算出する
- ページネーションのためのメタデータを作成する
- 検索結果を作成する

### 3. 検索キーワードが空で、タグに値がある場合
- タグによる投稿の絞り込みを行う
- タグ数を算出する
- ページネーションのためのメタデータを作成する
- 検索結果を作成する

### 4. 検索キーワードに値があり、タグに値がある場合
- 検索ワードによる投稿の絞り込みを行う
- タグによる投稿の絞り込みを行う
- タグ数を算出する
- ページネーションのためのメタデータを作成する
- 検索結果を作成する

*/

import { Prisma } from "@prisma/client";
import { z } from "zod";
import { PostCardDataSchema, prisma } from "./db.server";

export const searchResultsSchema = z.object({
    meta: z.object({
        totalCount: z.number(),
        tags: z.array(z.object({
            tagName: z.string(),
            count: z.number(),
        })),
        searchParams: z.object({
            q: z.string(),
            tags: z.array(z.string()),
            p: z.number(),
            orderby: z.string(),
        }),
    }),
    results: z.array(PostCardDataSchema),
})

type SearchResults = z.infer<typeof searchResultsSchema>;
type OrderBy = "like" | "timeDesc" | "timeAsc"


export async function getSearchResults(q: string, tags: string[], p: number, orderby: OrderBy): Promise<SearchResults>{
    const separatedQuery = q.split(" "); //　検索キーワードはスペースで分割する想定である
    const offset = (p - 1) * 10;

    if (q === "" && tags.length === 0) {
        const totalCount = await prisma.dimPosts.count();
        const tagsCount = await prisma.relPostTags.groupBy({
            by: ["tagId"],
            _count: { postId: true },
        })
        const tagNames = await prisma.dimTags.findMany({
            where: { tagId: { in: tagsCount.map((tag) => tag.tagId) } },
            select: { tagName: true, tagId: true },
        })
        const tags = tagsCount.map((tag) => {
            return {
                tagName: tagNames.find((tagName) => tagName.tagId === tag.tagId)?.tagName || "",
                count: tag._count.postId,
            }
        })
        const posts = await prisma.dimPosts.findMany({
            select: {
                postId: true,
                postTitle: true,
                postDateGmt: true,
                countLikes: true,
                countDislikes: true,
                ogpImageUrl: true,
            },
            orderBy: orderby === "like" ? { countLikes: "desc" } : orderby === "timeDesc" ? { postDateGmt: "desc" } : { postDateGmt: "asc" },
            take: 10,
            skip: offset,
        })
        const countComments = await prisma.dimComments.groupBy({
            by: ["postId"],
            _count: { commentId: true },
            where: { postId: { in: posts.map((post) => post.postId) } },
        })
        const postTags = await prisma.relPostTags.findMany({
            where: { postId: { in: posts.map((post) => post.postId) } },
            select: {
                postId: true,
                dimTag: {
                    select: {
                        tagName: true,
                        tagId: true,
                    }
                }
            }
        })
        const postsWithCountComments = posts.map((post) => {
            return {
                ...post,
                countComments: countComments.find((c) => c.postId === post.postId)?._count.commentId || 0,
                tags: postTags.filter((tag) => tag.postId === post.postId).map((tag) => tag.dimTag),
            }
        })
        return {
            meta: {
                totalCount,
                tags,
                searchParams: { q: "", tags: [], p, orderby },
            },
            results: postsWithCountComments,
        }
    }

    if (q !== "" && tags.length === 0) {
        /*
        元SQLは以下のようになる
        ```sql
        With post_id_contentmatch as (
            select post_id, count_likes, post_date_gmt
            from dim_posts
            where post_content &@~ 'いけない 人'
        ), post_id_titlematch as (
            select post_id, count_likes, post_date_gmt
            from dim_posts
            where post_title like '%いけない%' and post_title like '%人%'
        ), post_id_union as (
            select post_id, count_likes, post_date_gmt from post_id_contentmatch
            union
            select post_id, count_likes, post_date_gmt from post_id_titlematch
        )
        select post_id, count_likes, post_date_gmt from post_id_union
        order by post_date_gmt desc;
        ```
        - contentとtitleの両方に対してpgroongaの&@~演算子を利用することはできない
          - インデックスを設定しようとするとtimeoutになり、インデックスを作成できていない
          - そのため、クエリを発行しようとするとtimeoutになり、実用的ではない
        - そのため、演算子によってサブクエリを分けている
        */

        const contentQuery = `'${separatedQuery.map((query) => `${query}`).join(" ")}'`

        const postIdsQuery = Prisma.sql`
        with post_id_contentmatch as (
            select post_id, count_likes, post_date_gmt
            from dim_posts
            where post_content &@~ ${Prisma.raw(contentQuery)}
        ), post_id_titlematch as (
            select post_id, count_likes, post_date_gmt
            from dim_posts
            where ${Prisma.raw(separatedQuery.map((query) => `post_title like '%${query}%'`).join(" AND "))}
        ), post_id_union as (
            select post_id, count_likes, post_date_gmt from post_id_contentmatch
            union
            select post_id, count_likes, post_date_gmt from post_id_titlematch
        )
        select post_id, count_likes, post_date_gmt from post_id_union
        order by ${
            orderby === "like" ? Prisma.sql`count_likes DESC, post_date_gmt DESC` : orderby === "timeDesc" ? Prisma.sql`post_date_gmt DESC` : 
            Prisma.sql`post_date_gmt ASC`}
        `

        const posts = await prisma.$queryRaw(postIdsQuery) as { 
            post_id: number,
            count_likes: number,
            post_date_gmt: Date,
        }[];
        const totalCount = posts.length;
        /*
        タグ確認用SQL
        With post_id_contentmatch as (
            select post_id, count_likes, post_date_gmt
            from dim_posts
            where post_content &@~ 'いけない 人'
        ), post_id_titlematch as (
            select post_id, count_likes, post_date_gmt
            from dim_posts
            where post_title like '%いけない%' and post_title like '%人%'
        ), post_id_union as (
            select post_id, count_likes, post_date_gmt from post_id_contentmatch
            union
            select post_id, count_likes, post_date_gmt from post_id_titlematch
        ), post_ids as (
                select post_id from post_id_union
        ), tagcount as (
            select
                tag_name,
                count(*)
            from rel_post_tags
            left join dim_tags
            on rel_post_tags.tag_id = dim_tags.tag_id
            where rel_post_tags.post_id in (select post_id from post_ids)
            group by 1
        )
        select * from tagcount
        order by 2 desc;

        */
        const tagCounts = await prisma.relPostTags.groupBy({
            by: ["tagId"],
            _count: { postId: true },
            where: { postId: { in: posts.map((post) => post.post_id) } },
        })
        const tagNames = await prisma.dimTags.findMany({
            where: { tagId: { in: tagCounts.map((tag) => tag.tagId) } },
            select: { tagName: true, tagId: true },
        })
        const tags = tagCounts.map((tag) => {
            return {
                tagName: tagNames.find((tagName) => tagName.tagId === tag.tagId)?.tagName || "",
                count: tag._count.postId,
            }
        })

        const postIdsWithOffset = posts.slice(offset, offset + 10).map((post) => post.post_id);
        /*
        - Prismaでは、二つ以上のカラムの値に基づいてソートすることはできない
          - SQLで言えばorder by count_likes desc, post_date_gmt descというようなもの
        - そのため、ソートはSQL側ではなくサーバー側で実行している
        */
        const postData = await prisma.dimPosts.findMany({
            where: { postId: { in: postIdsWithOffset } },
            select: {
                postId: true,
                postTitle: true,
                postDateGmt: true,
                countLikes: true,
                countDislikes: true,
                ogpImageUrl: true,
            }
        }).then((posts) => {
            return posts.sort((a, b) => {
                if (orderby === "like") {
                    if (b.countLikes !== a.countLikes) {
                        return b.countLikes - a.countLikes;
                    } 
                    return new Date(b.postDateGmt).getTime() - new Date(a.postDateGmt).getTime();
                }
                if (orderby === "timeDesc") {
                    return new Date(b.postDateGmt).getTime() - new Date(a.postDateGmt).getTime();
                }
                return new Date(a.postDateGmt).getTime() - new Date(b.postDateGmt).getTime();
            });
        })

        const commentCounts = await prisma.dimComments.groupBy({
            by: ["postId"],
            _count: { commentId: true },
            where: { postId: { in: postIdsWithOffset } },
        })

        const postTags = await prisma.relPostTags.findMany({
            where: { postId: { in: postIdsWithOffset } },
            select: {
                postId: true,
                dimTag: {
                    select: {
                        tagName: true,
                        tagId: true,
                    }
                }
            }
        })

        const postsWithData = postData.map((post) => {
            return {
                ...post,
                countComments: commentCounts.find((c) => c.postId === post.postId)?._count.commentId || 0,
                tags: postTags.filter((tag) => tag.postId === post.postId).map((tag) => tag.dimTag),
            }
        })
        return {
            meta: {
                totalCount,
                tags,
                searchParams: { q, tags: [], p, orderby },
            },
            results: postsWithData,
        }
    }

    if (q === "" && tags.length > 0) {
        // タグによる絞り込みを行う
        const tagsTotalRaw = await prisma.$queryRaw`
        with tag_ids as (
            select tag_id, tag_name from dim_tags
            where tag_name in (${Prisma.join(tags)})
        ),
        post_ids as (
            select
                post_id
            from rel_post_tags
            where tag_id in (select tag_id from tag_ids)
            group by 1
            having count(*) = ${tags.length}
        ),
        rel_tags as (
            select
                rel_post_tags.post_id,
                dim_tags.tag_id,
                tag_name
            from rel_post_tags
            left join dim_tags
            on rel_post_tags.tag_id = dim_tags.tag_id
            where post_id in (select post_id from post_ids)
        )
        select
            tag_name as tagname,
            count(distinct post_id)::integer as count
        from rel_tags
        group by 1
        order by 2 desc
        ` as { tagname: string, count: bigint }[]
        // 以下二つの理由により、変換する必要がある
        // 1. countがintegerではなくbigintになっているため、変換する必要があるため
        // 2. シリアライゼーションの都合上「tagname」ではなく「tagName」とする必要があるため
        const tagsTotal = tagsTotalRaw.map((tag) => ({
            tagName: tag.tagname,
            count: Number(tag.count),
        }))

        const totalCountRaw = await prisma.$queryRaw`
        with tag_ids as (
            select tag_id, tag_name from dim_tags
            where tag_name in (
                ${Prisma.join(tags)}
            )
        ),
        tag_count as (
        select
            post_id
        from rel_post_tags
        where tag_id in (select tag_id from tag_ids)
        group by 1
        having count(*) = ${tags.length}
        )
        select count(*) as count from tag_count;
        ` as { count: bigint }[]
        const totalCount = Number(totalCountRaw[0].count)

        const posts = await prisma.dimPosts.findMany({
            select: {
                postId: true,
                postTitle: true,
                postDateGmt: true,
                countLikes: true,
                countDislikes: true,
                ogpImageUrl: true,
            },
            where: {
                rel_post_tags: {
                    some: {
                        dimTag: {
                            tagName: { in: tags }
                        }
                    }
                }
            },
            orderBy: orderby === "like" ? { countLikes: "desc" } : orderby === "timeDesc" ? { postDateGmt: "desc" } : { postDateGmt: "asc" },
            take: 10,
            skip: offset,
        }).then((posts) => {
            return posts.sort((a, b) => {
                if (orderby === "like") {
                    if (b.countLikes !== a.countLikes) {
                        return b.countLikes - a.countLikes;
                    } 
                    return new Date(b.postDateGmt).getTime() - new Date(a.postDateGmt).getTime();
                }
                if (orderby === "timeDesc") {
                    return new Date(b.postDateGmt).getTime() - new Date(a.postDateGmt).getTime();
                }
                return new Date(a.postDateGmt).getTime() - new Date(b.postDateGmt).getTime();
            });
        })

        const commentCounts = await prisma.dimComments.groupBy({
            by: ["postId"],
            _count: { commentId: true },
            where: { postId: { in: posts.map((post) => post.postId) } },
        })

        const postTags = await prisma.relPostTags.findMany({
            where: { postId: { in: posts.map((post) => post.postId) } },
            select: {
                postId: true,
                dimTag: {
                    select: {
                        tagName: true,
                        tagId: true,
                    }
                }
            }
        })

        const postsWithData = posts.map((post) => {
            return {
                ...post,
                countComments: commentCounts.find((c) => c.postId === post.postId)?._count.commentId || 0,
                tags: postTags.filter((tag) => tag.postId === post.postId).map((tag) => tag.dimTag),
            }
        })

        return {
            meta: {
                totalCount,
                tags: tagsTotal,
                searchParams: { q, tags, p, orderby },
            },
            results: postsWithData,
        }
    }
    if (q !== "" && tags.length > 0) {
        /*
        元クエリは以下の通り
        ```sql
        with keyward_titlematch as (
            select post_id, post_date_gmt, count_likes
            from dim_posts
            where post_title like '%人%'
            and post_title like '%いけない%'
        ),
        keyward_contentmatch as (
            select post_id, post_date_gmt, count_likes
            from dim_posts
            where post_content &@~ '人 いけない'
        ),
        keyward_intersection as (
            select * from keyward_titlematch
            union
            select * from keyward_contentmatch
        ),
        tag_tagmatch as (
            select post_id from rel_post_tags
            left join dim_tags
            on rel_post_tags.tag_id = dim_tags.tag_id
            where dim_tags.tag_name in ('コミュニケーション', 'やってはいけないこと')
            group by post_id
            having count(*) >= 2
        ),
        tag_post as (
            select post_id, post_date_gmt, count_likes
            from dim_posts
            where post_id in (select post_id from tag_tagmatch)
        ),
        keyward_tag_intersection as (
            select * from keyward_intersection
            INTERSECT
            select * from tag_post
        )
        select * from keyward_tag_intersection
        ```
        */

        const searchQuery = Prisma.sql`
        with keyward_titlematch as (
            select post_id, post_date_gmt, count_likes
            from dim_posts
            where ${Prisma.raw(separatedQuery.map((query) => `post_title like '%${query}%'`).join(" AND "))}
        ),
        keyward_contentmatch as (
            select post_id, post_date_gmt, count_likes
            from dim_posts
            where post_content &@~ '${Prisma.raw(separatedQuery.map((query) => `${query}`).join(" "))}'
        ),
        keyward_intersection as (
            select * from keyward_titlematch
            union
            select * from keyward_contentmatch
        ),
        tag_tagmatch as (
            select post_id from rel_post_tags
            left join dim_tags
            on rel_post_tags.tag_id = dim_tags.tag_id
            where dim_tags.tag_name in (${Prisma.join(tags)})
            group by post_id
            having count(*) >= ${tags.length}
        ),
        tag_post as (
            select post_id, post_date_gmt, count_likes
            from dim_posts
            where post_id in (select post_id from tag_tagmatch)
        ),
        keyward_tag_intersection as (
            select * from keyward_intersection
            INTERSECT
            select * from tag_post
        )
        select * from keyward_tag_intersection
        `
        const searchResultsRaw = await prisma.$queryRaw(searchQuery) as {
            post_id: bigint,
            post_date_gmt: Date,
            count_likes: bigint,
        }[]
        const searchResults = searchResultsRaw.map((post) => ({
            postId: Number(post.post_id),
            postDateGmt: post.post_date_gmt,
            countLikes: Number(post.count_likes),
        }))
        const totalCount = searchResults.length
        const postIds = searchResults.map((post) => post.postId)

        const tagCounts = await prisma.relPostTags.groupBy({
            by: ["tagId"],
            _count: { postId: true },
            where: { postId: { in: postIds } },
        })
        
        const tagNames = await prisma.dimTags.findMany({
            where: { tagId: { in: tagCounts.map((tag) => tag.tagId) } },
            select: { tagName: true, tagId: true },
        })

        const totalTags = tagCounts.map((tag) => {
            return {
                tagName: tagNames.find((tagName) => tagName.tagId === tag.tagId)?.tagName || "",
                count: tag._count.postId,
            }
        })

        const sortedPosts = searchResults.sort((a, b) => {
            if (orderby === "like") {
                if (b.countLikes !== a.countLikes) {
                    return b.countLikes - a.countLikes;
                } 
                return new Date(b.postDateGmt).getTime() - new Date(a.postDateGmt).getTime();
            }

            if (orderby === "timeDesc") {
                return new Date(b.postDateGmt).getTime() - new Date(a.postDateGmt).getTime();
            }
            return new Date(a.postDateGmt).getTime() - new Date(b.postDateGmt).getTime();
        })
        const postIdsWithOffset = sortedPosts.slice(offset, offset + 10).map((post) => post.postId)

        const posts = await prisma.dimPosts.findMany({
            where: { postId: { in: postIdsWithOffset } },
            select: {
                postId: true,
                postTitle: true,
                postDateGmt: true,
                countLikes: true,
                countDislikes: true,
                ogpImageUrl: true,
            },
        }).then((posts) => {
            return posts.sort((a, b) => {
                if (orderby === "like") {
                    if (b.countLikes !== a.countLikes) {
                        return b.countLikes - a.countLikes;
                    } 
                    return new Date(b.postDateGmt).getTime() - new Date(a.postDateGmt).getTime();
                }
                if (orderby === "timeDesc") {
                    return new Date(b.postDateGmt).getTime() - new Date(a.postDateGmt).getTime();
                }
                return new Date(a.postDateGmt).getTime() - new Date(b.postDateGmt).getTime();
            });
        })

        const postTags = await prisma.relPostTags.findMany({
            where: { postId: { in: postIdsWithOffset } },
            select: {
                postId: true,
                dimTag: {
                    select: {
                        tagName: true,
                        tagId: true,
                    }
                }
            }
        })

        const commentCounts = await prisma.dimComments.groupBy({
            by: ["postId"],
            _count: { commentId: true },
            where: { postId: { in: postIdsWithOffset } },
        })

        const postsWithData = posts.map((post) => {
            return {
                ...post,
                countComments: commentCounts.find((c) => c.postId === post.postId)?._count.commentId || 0,
                tags: postTags.filter((tag) => tag.postId === post.postId).map((tag) => tag.dimTag),
            }
        })

        return {
            meta: {
                totalCount,
                tags: totalTags,
                searchParams: { q, tags, p, orderby },
            },
            results: postsWithData,
        }
    }
    return {
        meta: {
            totalCount: 0,
            tags: [],
            searchParams: { q, tags, p, orderby },
        },
        results: [],
    }
}