import type{ CommentShowCardData } from "~/modules/db.server";
import CommentShowCard from "./CommentShowCard";
import { H2 } from "./Headings";

type CommentSectionProps = {
    title: string;
    comments: CommentShowCardData[];
    children?: React.ReactNode;
};

export default function CommentSection({ title, comments, children }: CommentSectionProps) {
    return (
        <section className="recent-comments">
            <H2>{title}</H2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {comments.map((comment) => (
                    <CommentShowCard
                        key={comment.commentId}
                        commentId={comment.commentId}
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