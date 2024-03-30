// CommentCard.tsx
import clockIcon from "~/src/assets/clock_icon.svg";

interface CommentCardProps {
    commentId: number;
    commentDateJst: string;
    commentAuthor: string;
    commentContent: string;
    commentParentId: number;
    level: number;
    onReplyClick: (commentId: number) => void;
}

export default function CommentCard(
    {
        commentId,
        commentDateJst,
        commentAuthor,
        commentContent,
        level,
        onReplyClick,
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
                <img src={clockIcon} alt="Comment Date" className="h-5 w-5 mr-2" />
                <p className="text-gray-600 text-sm">{formattedCommentDate}</p>
            </div>
            <p className="mt-2">{commentContent}</p>
            <button
                type="button"
                onClick={() => onReplyClick(commentId)}
                className="mt-4 text-blue-500 hover:underline"
            >
                返信
            </button>
        </div>
    );
}