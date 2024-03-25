import { json } from "@remix-run/node";
import { prisma } from "~/modules/db.server";
import { useLoaderData } from "@remix-run/react";
import PostCard from "~/components/PostCard";

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
        <h1>Feed</h1>
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