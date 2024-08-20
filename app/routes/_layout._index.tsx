import { json } from "@remix-run/node";
import { NavLink, useLoaderData } from "@remix-run/react";
import type { MetaFunction } from "@remix-run/node";
import { getRecentComments, getRecentPosts, getRecentPostsByTagId, getRecentVotedPosts } from "~/modules/db.server";
import PostCard from "~/components/PostCard";
import { H2 } from "~/components/Headings";
import CommentShowCard from "~/components/CommentShowCard";

type Post = {
    postId: number;
    postTitle: string;
    postDateGmt: string;
    tags: { tagName: string }[];
    countLikes: number;
    countDislikes: number;
    countComments: number;
};
  
type Comment = {
    commentId: number;
    commentContent: string;
    commentDateGmt: string;
    commentAuthor: string;
    postId: number;
    dimPosts: boolean;
};

type PostSectionProps = {
    title: string;
    posts: Post[];
    identifier: string;
    children?: React.ReactNode;
};

type CommentSectionProps = {
    title: string;
    comments: Comment[];
};

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
        <div className="container mx-auto">
            <PostSection title="最新の投稿" posts={mostRecentPosts} identifier="latest">
                <button className="rounded-md block w-full max-w-[800px] px-10 py-2 text-center btn-secondary my-4 bg-base-200 mx-auto" type="button">
                    <NavLink to="/feed?p=2&type=timeDesc" className="block w-full h-full">
                        最新の投稿を見る
                    </NavLink>
                </button>
            </PostSection>

            <PostSection title="最近いいねされた投稿" posts={recentVotedPosts} identifier="voted">
                <button className="rounded-md block w-full max-w-[400px] px-4 py-2 text-center btn-secondary my-4 bg-base-200 mx-auto" type="button">
                    <NavLink to="/feed?p=2&likeFrom=24&likeTo=0&type=like" className="block w-full h-full">
                        最近いいねされた投稿を見る
                    </NavLink>
                </button>
            </PostSection>

            <CommentSection title="最新のコメント" comments={mostRecentComments} />
            <PostSection title="コミュニティ選" posts={communityPosts} identifier="community" />
            <PostSection title="殿堂入り" posts={famedPosts} identifier="famed" />
        </div>
    );
}

function PostSection({ title, posts, identifier, children }: PostSectionProps) {
    return (
        <section className={`${identifier}-posts`}>
            <H2>{title}</H2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {posts.map((post) => (
                    <PostCard
                        key={`${identifier}-${post.postId}`}
                        postId={post.postId}
                        postTitle={post.postTitle}
                        postDateGmt={post.postDateGmt}
                        tagNames={post.tags.map((tag) => tag.tagName)}
                        countLikes={post.countLikes}
                        countDislikes={post.countDislikes}
                        countComments={post.countComments}
                        identifier={identifier}
                    />
                ))}
            </div>
            {children}
        </section>
    );
}

function CommentSection({ title, comments }: CommentSectionProps) {
    return (
        <section className="recent-comments">
            <H2>{title}</H2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {comments.map((comment) => (
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
        </section>
    );
}