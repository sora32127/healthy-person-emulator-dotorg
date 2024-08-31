import { json } from "@remix-run/node";
import { NavLink, useLoaderData, useSearchParams } from "@remix-run/react";
import type { LoaderFunction, MetaFunction } from "@remix-run/node";
import { getRandomComments, getRandomPosts, getRecentComments, getRecentPosts, getRecentPostsByTagId, getRecentVotedPosts } from "~/modules/db.server";
import PostCard from "~/components/PostCard";
import { H2 } from "~/components/Headings";
import CommentShowCard from "~/components/CommentShowCard";
import ReloadButton from "~/components/ReloadButton";
import { useEffect, useState } from "react";

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
    postTitle: string;
    countLikes: number;
    countDislikes: number;
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
    children?: React.ReactNode;
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
    const randomPosts = await getRandomPosts();
    const randomComments = await getRandomComments();
    return json({
        tab,
        mostRecentPosts,
        recentVotedPosts,
        communityPosts,
        famedPosts,
        mostRecentComments,
        randomPosts,
        randomComments,
    });
}

export default function Feed() {
    const { tab, mostRecentPosts, recentVotedPosts, communityPosts, famedPosts, mostRecentComments, randomPosts, randomComments } = useLoaderData<typeof loader>();
    const [searchParams, setSearchParams] = useSearchParams();
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    
    const handleTabChange = (newTab: string) => {
        setSearchParams({ tab: newTab });
    };

    useEffect(() => {
        /*
        - _layout.tsxに定義されているスマートフォンメニュー用のドロワーが開かれている場合、ページ上部にあるタブリストのstickyを解除するための処理である
        - ドロワーでもstickyが利用されているため、この処理がないとドロワーを開いた際にタブリストがドロワーの上に来てしまう
        */
        const drawerToggle = document.getElementById("drawer-toggle") as HTMLInputElement;
        const handleDrawerToggle = () => {
            if (drawerToggle.checked) {
                // ドロワーが開かれる場合の処理
                setIsDrawerOpen(drawerToggle.checked);
            }
            if (!drawerToggle.checked) {
                // ドロワーが閉じる場合の処理
                // ドロワーの閉じるアニメーションと同じタイミングで処理するため、100msの遅延を設けている
                setTimeout(() => {
                    setIsDrawerOpen(drawerToggle.checked);
                }, 100);
            }
        }
        drawerToggle.addEventListener("change", handleDrawerToggle);
        return () => {
            drawerToggle.removeEventListener("change", handleDrawerToggle);
        }
    }, []);

    return (
        <div>
            <div role="tablist" className={`transition min-w-max tabs tabs-bordered mt-16 md:mt-0 bg-base-100 z-40 min-h-[4rem] ${isDrawerOpen ? "" : "sticky top-0"}`}>
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
                <input
                    type="radio"
                    name="top-tab"
                    role="tab"
                    className="tab tab-lg"
                    aria-label="ランダム"
                    checked={tab === "random"}
                    onChange={() => handleTabChange("random")}
                />
            </div>
            <div>
                <div role="tabpanel" className="tab-content" style={{ display: tab === "trend" ? "block" : "none" }}>
                    <PostSection title="最近いいねされた投稿" posts={recentVotedPosts} identifier="voted">
                        <button className="rounded-md block w-full max-w-[400px] px-4 py-2 text-center my-4 bg-base-200 mx-auto hover:bg-base-300" type="button">
                            <NavLink to="/feed?p=2&likeFrom=48&likeTo=0&type=likes" className="block w-full h-full">
                                最近いいねされた投稿を見る
                            </NavLink>
                        </button>
                    </PostSection>
                    <CommentSection title="最近のコメント" comments={mostRecentComments} />
                    <PostSection title="最新の投稿" posts={mostRecentPosts} identifier="latest">
                        <button className="rounded-md block w-full max-w-[800px] px-10 py-2 text-center my-4 bg-base-200 hover:bg-base-300 mx-auto" type="button">
                            <NavLink to="/feed?p=2&type=timeDesc" className="block w-full h-full">
                                最新の投稿を見る
                            </NavLink>
                        </button>
                    </PostSection>
                </div>
                <div role="tabpanel" className="tab-content" style={{ display: tab === "fixed" ? "block" : "none" }}>
                    <PostSection title="殿堂入り" posts={famedPosts} identifier="famed" />
                    <PostSection title="コミュニティ選" posts={communityPosts} identifier="community" />
                </div>
                <div role="tabpanel" className="tab-content" style={{ display: tab === "random" ? "block" : "none" }}>
                    <PostSection title="ランダム" posts={randomPosts} identifier="random">
                        <div className="flex justify-center">
                            <ReloadButton />
                        </div>
                    </PostSection>
                    <CommentSection title="ランダム" comments={randomComments}>
                        <div className="flex justify-center">
                            <ReloadButton />
                        </div>
                    </CommentSection>
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

function CommentSection({ title, comments, children }: CommentSectionProps) {
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
                        postTitle={comment.postTitle}
                        countLikes={comment.countLikes}
                        countDislikes={comment.countDislikes}
                    />
                ))}
            </div>
            {children}
        </section>
    );
}