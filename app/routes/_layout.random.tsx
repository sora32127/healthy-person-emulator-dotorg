import { useLoaderData } from "@remix-run/react";
import { H1 } from "~/components/Headings";
import PostCard from "~/components/PostCard";
import { prisma } from "~/modules/db.server";

export async function loader(){
    /*
    prisma.dimPosts.findManyRandomを利用してもランダムな記事を取得することは可能であるが、タイムアウトしてしまうため、インデックスを作成したuuidを使って疑似的にランダムな記事を取得している
    */
    const postCount = await prisma.dimPosts.count();
    const randomPostOffset = Math.max(
        Math.floor(Math.random() * postCount) - 10,
        0
        );
    const randomPosts = await prisma.dimPosts.findMany({
        select : {
            postId: true,
            postTitle: true,
            postDateJst: true,
            countLikes: true,
            countDislikes: true,
        },
        orderBy: { uuid : "asc"},
        skip: randomPostOffset,
        take: 10,
    })

    const allTags = await prisma.relPostTags.findMany({
        select: {
            postId: true,
            dimTag: { select: { tagName: true } }
        },
        where : { postId : { in : randomPosts.map((post) => post.postId)}}
    })

    const randomPostsWithTags = randomPosts.map((post) => {
        const tagNames = allTags
            .filter((tag) => tag.postId === post.postId)
            .map((tag) => tag.dimTag.tagName);
        return { ...post, tagNames };
    }
    );

    return { randomPosts: randomPostsWithTags }
}

export default function Random() {
    const { randomPosts } = useLoaderData<typeof loader>();
    return (
        <>
        <H1>ランダム記事</H1>
        {randomPosts.map((post) => (
            <PostCard
                key={post.postId}
                postId={post.postId}
                postTitle={post.postTitle}
                postDateJst={post.postDateJst}
                tagNames={post.tagNames}
                countLikes={post.countLikes}
                countDislikes={post.countDislikes}
            />
        ))}
        </>
    );
}
