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
            postTitle: true,
            postDateJst: true,
            postUrl: true,
            tagIds: true,
            countLikes: true,
            countDislikes: true,
        },
    });

    const allTagIds = [...new Set(mostRecentPosts.flatMap(post => post.tagIds))];

    const tags = await prisma.dimTags.findMany({
        where: {
            tagId: { in: allTagIds },
        },
    });

    const tagDictionary: { [key: number]: string } = tags.reduce((acc, tag) => ({
        ...acc,
        [tag.tagId]: tag.tagName,
    }), {});

    const postsWithTags = mostRecentPosts.map(post => ({
        ...post,
        tagNames: post.tagIds.map(tagId => tagDictionary[tagId])
    }));

    return json(postsWithTags);
}


export default function Feed() {
    const mostRecentPosts = useLoaderData<typeof loader>();
    return (
        <>
        <H1>フィード</H1>
        <H2>最新の投稿</H2>
        {mostRecentPosts.map((post) => (
            <PostCard
                key={post.postUrl}
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