// CommentCard.tsx
interface CommentCardProps {
    commentId: number;
    commentDateJst: string;
    commentAuthor: string;
    commentContent: string;
    commentParentId: number;
    level: number;
}

export default function CommentCard(
    {
        commentId,
        commentDateJst,
        commentAuthor,
        commentContent,
        commentParentId,
        level,
    }: CommentCardProps
) {
    const formattedCommentDate = new Date(commentDateJst).toLocaleString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
    }).replace(/\//g, "-");

    const marginLeft = `${level * 2}rem`;

    return (
        <div className="bg-white shadow-md rounded-md p-4 mb-4" style={{ marginLeft }}>
            <div className="flex justify-between items-center mb-2">
                <p className="text-gray-600 text-sm">{formattedCommentDate}</p>
                <p className="text-gray-600 text-sm">{commentAuthor}</p>
            </div>
            <p className="text-gray-600 text-sm mt-2">{commentContent}</p>
        </div>
    );
}