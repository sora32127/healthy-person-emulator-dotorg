import { prisma } from "./db.server"

export async function getRecentPostTitlesForTest(): Promise<string[]> {
    const posts = await prisma.dimPosts.findMany({
        select: {
            postTitle: true,
        },
        orderBy: { postDateGmt: "desc" },
        take: 20,
    })
    return posts.map((post) => post.postTitle)
}

export async function getMostLikedPostTitlesForTest(): Promise<string[]>{
    const posts = await prisma.dimPosts.findMany({
        select: {
            postTitle: true
        },
        orderBy: { countLikes: "desc"},
        take: 20
    })
    return posts.map((post) => post.postTitle)
}

export async function getMostRecentKeywardPostIdsForTest(): Promise<number[]> {
    const postIds = await prisma.$queryRaw`
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
        select post_id from post_id_union
        order by post_date_gmt desc limit 20;
    ` as { post_id: number }[]
    return postIds.map((post) => post.post_id)
}

export async function getMostLikedKeywardPostIdsForTest(): Promise<number[]> {
    const postIds = await prisma.$queryRaw`
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
        select post_id from post_id_union
        order by count_likes desc, post_date_gmt desc limit 20;
    ` as { post_id: number }[]
    return postIds.map((post) => post.post_id)
}

export async function getOldestTagPostIdsForTest(): Promise<number[]> {
    const postIds = await prisma.$queryRaw`
    with post_ids as (
        select post_id
        from rel_post_tags
        where tag_id in (5, 17)
        group by post_id
        having count(*) = 2
        )
    select post_id from dim_posts
    where post_id in (select post_id from post_ids)
    order by post_date_gmt asc limit 20;
    ` as { post_id: number }[]
    return postIds.map((post) => post.post_id)
}

export async function getMostRecentTagPostIdsForTest(): Promise<number[]> {
    const postIds = await prisma.$queryRaw`
    with post_ids as (
        select post_id
        from rel_post_tags
        where tag_id in (5, 17)
        group by post_id
        having count(*) = 2
        )
    select post_id from dim_posts
    where post_id in (select post_id from post_ids)
    order by post_date_gmt desc limit 20;
    ` as { post_id: number }[]
    return postIds.map((post) => post.post_id)
}

export async function getMostLikedTagPostIdsForTest(): Promise<number[]> {
    const postIds = await prisma.$queryRaw`
    with post_ids as (
        select post_id
        from rel_post_tags
        where tag_id in (5, 17)
        group by post_id
        having count(*) = 2
        )
    select post_id from dim_posts
    where post_id in (select post_id from post_ids)
    order by count_likes desc, post_date_gmt desc limit 20;
    ` as { post_id: number }[]
    return postIds.map((post) => post.post_id)
}

export async function getOldestKeywardPostIdsForTest(): Promise<number[]> {
    const postIds = await prisma.$queryRaw`
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
    select post_id from keyward_tag_intersection
    order by post_date_gmt asc limit 20;
    ` as { post_id: number }[]
    return postIds.map((post) => post.post_id)
}

export async function getLatestKeywardTagPostIdsForTest(): Promise<number[]>{
    const postIds = await prisma.$queryRaw`
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
    select post_id from keyward_tag_intersection
    order by post_date_gmt desc limit 20;
    ` as { post_id: number }[]
    return postIds.map((post) => post.post_id)
}

export async function getMostLikedKeywardTagPostIdsForTest(): Promise<number[]>{
    const postIds = await prisma.$queryRaw`
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
    select post_id from keyward_tag_intersection
    order by count_likes desc, post_date_gmt desc limit 20;
    ` as { post_id: number }[]
    return postIds.map((post) => post.post_id)
}