import type { PostCardData } from "~/modules/db.server";
import { H2 } from "./Headings";
import PostCard from "./PostCard";

type PostSectionProps = {
    title: string;
    posts: PostCardData[];
    identifier: string;
    children?: React.ReactNode;
};

export default function PostSection({ title, posts, identifier, children }: PostSectionProps) {
    return (
        <section className={`${identifier}-posts`}>
            <H2>{title}</H2>
                <div className="grid grid-cols-1 gap-4">
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