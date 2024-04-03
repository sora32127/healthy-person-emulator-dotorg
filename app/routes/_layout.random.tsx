import { useLoaderData } from "@remix-run/react";
import { H1 } from "~/components/Headings";
import PostCard from "~/components/PostCard";
import { prisma } from "~/modules/db.server";

export async function loader(){
    const randomPosts = await prisma.userPostContent.findManyRandom(10, {
        select : {
            postId: true,
            postTitle: true,
            postDateJst: true,
            postUrl: true,
            countLikes: true,
            countDislikes: true,
        },
        custom_uniqueKey: "postId"
    })

    const allTags = await prisma.dimTags.findMany({
        select: {
            tagName: true,
            postId: true
        },
        where : { postId : { in : randomPosts.map((post) => post.postId)}}
    })

    const randomPostsWithTags = randomPosts.map((post) => {
        const tagNames = allTags
            .filter((tag) => tag.postId === post.postId)
            .map((tag) => tag.tagName);
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
                key={post.postUrl}
                postId={post.postId}
                postTitle={post.postTitle}
                postDateJst={post.postDateJst}
                postUrl={post.postUrl}
                tagNames={post.tagNames}
                countLikes={post.countLikes}
                countDislikes={post.countDislikes}
            />
        ))}
        </>
    );
}
