import { useLoaderData } from "@remix-run/react";
import CommentShowCard from "~/components/CommentShowCard";
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
    
    const randomPostsRaw = await prisma.dimPosts.findMany({
        select: {
            postId: true,
            postTitle: true,
            postDateGmt: true,
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
        orderBy: { uuid : "asc"},
        skip: randomPostOffset,
        take: 10,
    })

    const randomPosts = randomPostsRaw.map((post) => {
        const tagNames = post.rel_post_tags.map((rel) => rel.dimTag.tagName);
        return { ...post, tagNames };
    });

    const commentCount = await prisma.dimComments.count();
    const randomCommentOffset = Math.max(
        Math.floor(Math.random() * commentCount) - 10,
        0
    );

    const randomComments = await prisma.dimComments.findMany({
        select: {
            commentId: true,
            commentContent: true,
            commentDateGmt: true,
            commentAuthor: true,
            postId: true,
            dimPosts: { select: { postTitle: true } },
        },
        orderBy: { uuid: "asc" },
        skip: randomCommentOffset,
        take: 10,
    });

    return { randomPosts, randomComments }
}

export default function Random() {
    const { randomPosts, randomComments } = useLoaderData<typeof loader>();
    return (
        <>
        <H1>ランダム記事</H1>
        {randomPosts.map((post) => (
            <PostCard
                key={post.postId}
                postId={post.postId}
                postTitle={post.postTitle}
                postDateGmt={post.postDateGmt}
                tagNames={post.tagNames}
                countLikes={post.countLikes}
                countDislikes={post.countDislikes}
            />
        ))}
        <H1>ランダムコメント</H1>
        {randomComments.map((comment) => (
            <CommentShowCard
                key={comment.commentId}
                commentContent={comment.commentContent}
                commentDateGmt={comment.commentDateGmt}
                commentAuthor={comment.commentAuthor}
                postId={comment.postId}
                dimPosts={comment.dimPosts}
            />
        ))}
        </>
    );
}
