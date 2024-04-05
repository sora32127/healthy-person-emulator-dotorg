import { MetaFunction, json } from "@remix-run/node";
import { prisma } from "~/modules/db.server";
import { NavLink, useLoaderData } from "@remix-run/react";
import PostCard from "~/components/PostCard";
import { H2 } from "~/components/Headings";
import CommentShowCard from "~/components/CommentShowCard";

interface PostCardProps {
    postId: number;
    postTitle: string;
    postDateJst: Date;
    tagNames: string[];
    countLikes: number;
    countDislikes: number;
}


export const meta: MetaFunction = () => {
    return [
      { title: "トップページ" },
      { name: "description", content: "現実世界のために" },
    ];
  };

export async function loader() {
    const mostRecentPostsRaw = await prisma.dimPosts.findMany({
        orderBy: { postDateJst: "desc" },
        take: 10,
        select: {
            postId: true,
            postTitle: true,
            postDateJst: true,
            countLikes: true,
            countDislikes: true,
            rel_post_tags: {
                select: {
                    dimTag: {
                        select: {
                            tagName: true,
                        },
                    },
                },
            },
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

    const recentVotedPostsRaw = await prisma.dimPosts.findMany({
        where: { postId: { in: recentVotedPostsAgg.map((post) => post.postId) } },
        select: {
            postId: true,
            postTitle: true,
            postDateJst: true,
            countLikes: true,
            countDislikes: true,
            rel_post_tags: {
                select: {
                    dimTag: {
                        select: {
                            tagName: true,
                        },
                    },
                },
            },
        },
    });

    const communityPostsRaw = await prisma.relPostTags.findMany({
        where: { tagId: { equals: 986 } }, // コミュニティ選のtag_id
        select : {
            dim_posts: {
                select : {
                    postId: true,
                    postTitle: true,
                    postDateJst: true,
                    countLikes: true,
                    countDislikes: true,
                    rel_post_tags: {
                    select: {
                    dimTag: {
                        select: {
                            tagName: true,
                        },
                    },
                },
            },
        },
    }}});

    const famedPostsRaw = await prisma.relPostTags.findMany({
        where: { tagId: { equals: 575 } }, // コミュニティ選のtag_id
        select : {
            dim_posts: {
                select : {
                    postId: true,
                    postTitle: true,
                    postDateJst: true,
                    countLikes: true,
                    countDislikes: true,
                    rel_post_tags: {
                    select: {
                    dimTag: {
                        select: {
                            tagName: true,
                        },
                    },
                },
            },
        },
    }}});

    const mostRecentPosts: PostCardProps[] = mostRecentPostsRaw.map((post) => {
        const tagNames = post.rel_post_tags.map((tag) => tag.dimTag.tagName);
        return { ...post, tagNames };
    });

    const recentVotedPosts: PostCardProps[] = recentVotedPostsRaw.map((post) => {
        const tagNames = post.rel_post_tags.map((tag) => tag.dimTag.tagName);
        return { ...post, tagNames };
    });

    const communityPosts: PostCardProps[] = communityPostsRaw.map((post) => {
        const tagNames = post.dim_posts.rel_post_tags.map((tag) => tag.dimTag.tagName);
        return { ...post.dim_posts, tagNames };
    });

    const famedPosts: PostCardProps[] = famedPostsRaw.map((post) => {
        const tagNames = post.dim_posts.rel_post_tags.map((tag) => tag.dimTag.tagName);
        return { ...post.dim_posts, tagNames };
    }
    );


    const mostRecentComments = await prisma.dimComments.findMany({
        orderBy: { commentDateJst: "desc" },
        take: 10,
        select: {
            commentId: true,
            postId: true,
            commentContent: true,
            commentDateJst: true,
            commentAuthor: true,
            dimPosts: {
                select: {
                    postTitle: true,
                },
            },
        },
    })

    return json({
        mostRecentPosts,
        recentVotedPosts,
        communityPosts,
        famedPosts,
        mostRecentComments,
    });
}


export default function Feed() {
    const { mostRecentPosts, recentVotedPosts, communityPosts, famedPosts, mostRecentComments } = useLoaderData<typeof loader>();
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
        <H2>最新のコメント</H2>
        {mostRecentComments.map((comment) => (
            <CommentShowCard
                key={comment.commentId}
                commentContent={comment.commentContent}
                commentDateJst={comment.commentDateJst}
                commentAuthor={comment.commentAuthor}
                postId={comment.postId}
                dimPosts={comment.dimPosts}
            />
        ))}
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