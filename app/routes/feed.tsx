import { json } from "@remix-run/node";
import { prisma } from "~/modules/db.server";
import { useLoaderData } from "@remix-run/react";
import PostCard from "~/components/PostCard";
import { H1, H2 } from "~/components/Headings";

export async function loader() {
    const mostRecentPosts = await prisma.userPostContent.findMany({
        orderBy: { postDateJst: "desc" },
        take: 10,
        select: {
            postTitle: true,
            postDateJst: true,
            postUrl: true,
        },
    });

    return json(mostRecentPosts);
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
            />
        ))}
        </>

    );
}