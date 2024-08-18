import { json } from "@remix-run/node";
import { NavLink, useLoaderData } from "@remix-run/react";
import type { MetaFunction } from "@remix-run/node";
import { getRecentComments, getRecentPosts, getRecentPostsByTagId, getRecentVotedPosts } from "~/modules/db.server";
import PostCard from "~/components/PostCard";
import { H2 } from "~/components/Headings";
import CommentShowCard from "~/components/CommentShowCard";


export const meta: MetaFunction = () => {
    return [
      { title: "トップページ" },
      { name: "description", content: "現実世界のために" },
    ];
  };

export async function loader() {
    const mostRecentPosts = await getRecentPosts();
    const recentVotedPosts = await getRecentVotedPosts();
    const communityPosts = await getRecentPostsByTagId(986);
    const famedPosts = await getRecentPostsByTagId(575);
    const mostRecentComments = await getRecentComments();

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
        <div>
            <div className="latest-posts">
                <H2>最新の投稿</H2>
                {mostRecentPosts.map((post) => (
                    <PostCard
                        key={post.postId}
                        postId={post.postId}
                        postTitle={post.postTitle}
                        postDateGmt={post.postDateGmt}
                        tagNames={post.tags.map((tag) => tag.tagName)}
                        countLikes={post.countLikes}
                        countDislikes={post.countDislikes}
                        countComments={post.countComments}
                        identifier="latest"
                    />
                ))}
                <NavLink
                    to="/feed?p=2&type=timeDesc"
                    className="rounded-md block w-full px-4 py-2 text-center btn-secondary my-4"
                >
                最新の投稿を見る
                </NavLink>
            </div>
            <div className="recent-voted-posts">
            <H2>最近いいねされた投稿</H2>
                {recentVotedPosts.map((post) => (
                    <PostCard
                        key={post.postId}
                        postId={post.postId}
                        postTitle={post.postTitle}
                        postDateGmt={post.postDateGmt}
                        tagNames={post.tags.map((tag) => tag.tagName)}
                        countLikes={post.countLikes}
                        countDislikes={post.countDislikes}
                        countComments={post.countComments}
                        identifier="voted"
                    />
                ))}
                <NavLink
                    to="/feed?p=2&likeFrom=24&likeTo=0&type=like"
                    className="rounded-md block w-full px-4 py-2 text-center btn-secondary my-4"
                >
                最近いいねされた投稿を見る
                </NavLink>
            </div>
            <div className="recent-comments">
                <H2>最新のコメント</H2>
                {mostRecentComments.map((comment) => (
                    <CommentShowCard
                        key={comment.commentId}
                        commentContent={comment.commentContent}
                        commentDateGmt={comment.commentDateGmt}
                        commentAuthor={comment.commentAuthor}
                        postId={comment.postId}
                        dimPosts={comment.dimPosts}
                    />
                ))}
            </div>
            <div className="community-posts">
                <H2>コミュニティ選</H2>
                {communityPosts.map((post) => (
                    <PostCard
                        key={post.postId}
                        postId={post.postId}
                        postTitle={post.postTitle}
                        postDateGmt={post.postDateGmt}
                        tagNames={post.tags.map((tag) => tag.tagName)}
                        countLikes={post.countLikes}
                        countDislikes={post.countDislikes}
                        countComments={post.countComments}
                        identifier="community"
                    />
                ))}
            </div>
            <div className="famed-posts">
                <H2>殿堂入り</H2>
                {famedPosts.map((post) => (
                    <PostCard
                        key={post.postId}
                        postId={post.postId}
                        postTitle={post.postTitle}
                        postDateGmt={post.postDateGmt}
                        tagNames={post.tags.map((tag) => tag.tagName)}
                        countLikes={post.countLikes}
                        countDislikes={post.countDislikes}
                        countComments={post.countComments}
                        identifier="famed"
                    />
                ))}
            </div>
        </div>
    </>
    );
}