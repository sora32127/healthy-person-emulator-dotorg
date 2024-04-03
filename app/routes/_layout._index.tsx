import { MetaFunction, json } from "@remix-run/node";
import { prisma } from "~/modules/db.server";
import { NavLink, useLoaderData } from "@remix-run/react";
import PostCard from "~/components/PostCard";
import { H2 } from "~/components/Headings";


export const meta: MetaFunction = () => {
    return [
      { title: "トップページ" },
      { name: "description", content: "現実世界のために" },
    ];
  };

export async function loader() {
    const mostRecentPosts = await prisma.dimPosts.findMany({
        orderBy: { postDateJst: "desc" },
        take: 10,
        select: {
            postId: true,
            postTitle: true,
            postDateJst: true,
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

    const recentVotedPosts = await prisma.dimPosts.findMany({
        where: { postId: { in: recentVotedPostsAgg.map((post) => post.postId) } },
        select: {
            postId: true,
            postTitle: true,
            postDateJst: true,
            countLikes: true,
            countDislikes: true,
        },
    });

    const communityPostIds = await prisma.dimTags.findMany({
        where: { tagName: { equals : "コミュニティ選"}},
        select : { postId: true }
    })

    const communityPosts = await prisma.dimPosts.findMany({
        where : { postId : { in : communityPostIds.map((post) => post.postId)}},
        select : {
            postId: true,
            postTitle: true,
            postDateJst: true,
            countLikes: true,
            countDislikes: true,
        }
    })

    const famedPostIds = await prisma.dimTags.findMany({
        where : { tagName: { equals: "殿堂入り"}},
        select: { postId: true }
    })
        

    const famedPosts = await prisma.dimPosts.findMany({
        where : { postId : { in : famedPostIds.map((post) => post.postId)}},
        select : {
            postId: true,
            postTitle: true,
            postDateJst: true,
            countLikes: true,
            countDislikes: true,
        }
    })

    

    let allPostIds = mostRecentPosts.map((post) => post.postId);
    allPostIds = allPostIds.concat(recentVotedPosts.map((post) => post.postId));
    allPostIds = allPostIds.concat(communityPosts.map((post) => post.postId));
    allPostIds = allPostIds.concat(famedPosts.map((post) => post.postId));
    

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

    const communityPostsWithTags = communityPosts.map((post) => {
        const tagNames = allTagsNames
            .filter((tag) => tag.postId === post.postId)
            .map((tag) => tag.tagName);
        return { ...post, tagNames };
    }
    );

    const famedPostsWithTags = famedPosts.map((post) => {
        const tagNames = allTagsNames
            .filter((tag) => tag.postId === post.postId)
            .map((tag) => tag.tagName);
        return { ...post, tagNames };
    }
    );

    return json({
        mostRecentPosts: mostRecentPostsWithTags,
        recentVotedPosts: recentVotedPostsWithTags,
        communityPosts: communityPostsWithTags,
        famedPosts: famedPostsWithTags,
    });
}


export default function Feed() {
    const { mostRecentPosts, recentVotedPosts, communityPosts, famedPosts } = useLoaderData<typeof loader>();
    return (
        <>
        <H2>最新の投稿</H2>
        {mostRecentPosts.map((post) => (
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
        <NavLink
            to="/feed?p=2"
            className="rounded-md block w-full px-4 py-2 text-center text-white bg-blue-500 hover:bg-blue-600"
        >
        最新の投稿を見る
        </NavLink>
        <H2>最近いいねされた投稿</H2>
        {recentVotedPosts.map((post) => (
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
        <NavLink
            to="/feed?p=2&likeFrom=24&likeTo=0"
            className="rounded-md block w-full px-4 py-2 text-center text-white bg-blue-500 hover:bg-blue-600"
        >
        最近いいねされた投稿を見る
        </NavLink>
        <H2>コミュニティ選</H2>
        {communityPosts.map((post) => (
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

        <H2>殿堂入り</H2>
        {famedPosts.map((post) => (
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