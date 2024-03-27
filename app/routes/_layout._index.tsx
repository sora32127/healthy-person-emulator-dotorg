import { MetaFunction, json } from "@remix-run/node";
import { prisma } from "~/modules/db.server";
import { useLoaderData } from "@remix-run/react";
import PostCard from "~/components/PostCard";
import { H1, H2 } from "~/components/Headings";

export const meta: MetaFunction = () => {
    return [
      { title: "フィード" },
      { name: "description", content: "Welcome to Remix!" },
    ];
  };

export async function loader() {
    const mostRecentPosts = await prisma.userPostContent.findMany({
        orderBy: { postDateJst: "desc" },
        take: 10,
        select: {
            postId: true,
            postTitle: true,
            postDateJst: true,
            postUrl: true,
            countLikes: true,
            countDislikes: true,
        },
    });

    const allTagNames = await prisma.dimTags.findMany({
        select: {
            postId: true,
            tagName: true,
        },
        where : { postId: { in: mostRecentPosts.map((post) => post.postId) } },
    });

    const postData = mostRecentPosts.map((post) => {
        const tagNames = allTagNames
            .filter((tag) => tag.postId === post.postId)
            .map((tag) => tag.tagName);
        return { ...post, tagNames };
    });

    return json({ mostRecentPosts: postData });
}


export default function Feed() {
    const { mostRecentPosts } = useLoaderData<typeof loader>();
    return (
        <>
        <H1>フィード</H1>
        <H2>最新の投稿</H2>
        {mostRecentPosts.map((post) => (
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