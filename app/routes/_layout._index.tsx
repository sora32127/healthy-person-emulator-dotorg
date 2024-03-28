import { MetaFunction, json } from "@remix-run/node";
import { prisma } from "~/modules/db.server";
import { NavLink, useLoaderData } from "@remix-run/react";
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

    const recentVotedPostsAgg = await prisma.fctPostVoteHisotry.groupBy({
        by: ["postId"],
        where: { 
            voteDateGmt : { 
                gte: new Date("2024-03-12"),
                lte: new Date("2024-03-13")
            },
            voteTypeInt : { in : [1]}
        },
        _count: { voteUserIpHash: true },
        orderBy: { _count: { voteUserIpHash: "desc" } },
        take: 10,
    });

    const recentVotedPosts = await prisma.userPostContent.findMany({
        where: { postId: { in: recentVotedPostsAgg.map((post) => post.postId) } },
        select: {
            postId: true,
            postTitle: true,
            postDateJst: true,
            postUrl: true,
            countLikes: true,
            countDislikes: true,
        },
    });

    let allPostIds = mostRecentPosts.map((post) => post.postId);
    allPostIds = allPostIds.concat(recentVotedPosts.map((post) => post.postId));

    const allTagsNames = await prisma.dimTags.findMany({
        select: {
            postId: true,
            tagName: true,
        },
        where: { postId: { in: allPostIds } },
    });

    const mostRecentPostsWithTags = mostRecentPosts.map((post) => {
        const tagNames = allTagsNames
            .filter((tag) => tag.postId === post.postId)
            .map((tag) => tag.tagName);
        return { ...post, tagNames };
    }
    );

    const recentVotedPostsWithTags = recentVotedPosts.map((post) => {
        const tagNames = allTagsNames
            .filter((tag) => tag.postId === post.postId)
            .map((tag) => tag.tagName);
        return { ...post, tagNames };
    }
    );


    return json({
        mostRecentPosts: mostRecentPostsWithTags,
        recentVotedPosts: recentVotedPostsWithTags
    });
}


export default function Feed() {
    const { mostRecentPosts, recentVotedPosts } = useLoaderData<typeof loader>();
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
        <NavLink to="/feed?p=2">次へ</NavLink>
        <H2>最近いいねされた投稿</H2>
        {recentVotedPosts.map((post) => (
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