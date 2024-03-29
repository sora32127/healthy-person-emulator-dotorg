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
        commentDateJst,
        commentAuthor,
        commentContent,
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
        <div className="bg-white p-4 mb-4" style={{ marginLeft }}>
            <div className="flex items-center">
                <p className="text-green-900 font-bold mr-4">{commentAuthor}</p>
                <img src="/src/assets/clock_icon.svg" alt="Comment Date" className="h-5 w-5 mr-2" />
                <p className="text-gray-600 text-sm">{formattedCommentDate}</p>
            </div>
            <p className="mt-2">{commentContent}</p>
        </div>
    );
}
