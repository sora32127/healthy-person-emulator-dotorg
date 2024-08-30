import { json } from "@remix-run/node";
import { NavLink, useLoaderData, useSearchParams } from "@remix-run/react";
import type { LoaderFunction, MetaFunction } from "@remix-run/node";
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

export const loader: LoaderFunction = async ({ request }) => {
    const url = new URL(request.url);
    const tab = url.searchParams.get("tab") || "trend";
    const mostRecentPosts = await getRecentPosts();
    const recentVotedPosts = await getRecentVotedPosts();
    const communityPosts = await getRecentPostsByTagId(986);
    const famedPosts = await getRecentPostsByTagId(575);
    const mostRecentComments = await getRecentComments();

    return json({
        tab,
        mostRecentPosts,
        recentVotedPosts,
        communityPosts,
        famedPosts,
        mostRecentComments,
    });
}

export default function Feed() {
    const { tab, mostRecentPosts, recentVotedPosts, communityPosts, famedPosts, mostRecentComments } = useLoaderData<typeof loader>();
    const [searchParams, setSearchParams] = useSearchParams();
    
    const handleTabChange = (newTab: string) => {
        setSearchParams({ tab: newTab });
    };

    return (
        <div className="mx-auto">
            <div role="tablist" className="tabs tabs-bordered sticky top-16 md:top-0 z-100">
                <input 
                    type="radio" 
                    name="top-tab" 
                    role="tab" 
                    className="tab tab-lg" 
                    aria-label="トレンド" 
                    checked={tab === "trend"}
                    onChange={() => handleTabChange("trend")}
                />
                <input 
                    type="radio" 
                    name="top-tab" 
                    role="tab" 
                    className="tab tab-lg" 
                    aria-label="固定"
                    checked={tab === "fixed"}
                    onChange={() => handleTabChange("fixed")}
                />
            </div>

            <div className="mt-6 px-4">
                <div role="tabpanel" className="tab-content" style={{ display: tab === "trend" ? "block" : "none" }}>
                    <PostSection title="最新の投稿" posts={mostRecentPosts} identifier="latest" />
                    <PostSection title="最近いいねされた投稿" posts={recentVotedPosts} identifier="voted" />
                    <CommentSection title="最近のコメント" comments={mostRecentComments} />
                </div>
                <div role="tabpanel" className="tab-content" style={{ display: tab === "fixed" ? "block" : "none" }}>
                    <PostSection title="殿堂入り" posts={famedPosts} identifier="famed" />
                    <PostSection title="コミュニティ選" posts={communityPosts} identifier="community" />
                </div>
            </div>
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