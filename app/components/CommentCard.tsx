// CommentCard.tsx
import clockIcon from "~/src/assets/clock_icon.svg";
import thumb_up from "~/src/assets/thumb_up.svg";
import thumb_down from "~/src/assets/thumb_down.svg";

interface CommentCardProps {
  commentId: number;
  commentDateJst: string;
  commentAuthor: string;
  commentContent: string;
  level: number;
  onCommentVote: (commentId: number, voteType: "like" | "dislike") => void;
  likedComments: number[];
  dislikedComments: number[];
  likesCount: number;
  dislikesCount: number;
}

export default function CommentCard({
  commentId,
  commentDateJst,
  commentAuthor,
  commentContent,
  level,
  onCommentVote,
  likedComments,
  dislikedComments,
  likesCount,
  dislikesCount,
}: CommentCardProps) {

  const formattedCommentDate = new Date(commentDateJst).toLocaleString(
    "ja-JP",
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }
  ).replace(/\//g, "-");

  const marginLeft = `${level * 2}rem`;
  const isLiked = likedComments.includes(commentId);
  const isDisliked = dislikedComments.includes(commentId);

  return (
    <div className="bg-white p-4 mb-4" style={{ marginLeft }}>
      <div className="flex items-center">
        <p className="text-green-900 font-bold mr-4">{commentAuthor}</p>
        <img src={clockIcon} alt="Comment Date" className="h-5 w-5 mr-2" />
        <p className="text-gray-600 text-sm">{formattedCommentDate}</p>
      </div>
      <p className="mt-2">{commentContent}</p>
      <div className="flex items-center mt-4">
        <button
          className={`flex items-center mr-4 bg-gray-200 rounded-md px-2 py-2 ${
            isLiked ? "text-blue-500" : ""
          }`}
          onClick={() => onCommentVote(commentId, "like")}
          disabled={isLiked}
        >
          <img src={thumb_up} alt="Like" className="h-5 w-5 mr-2" />
          {likesCount}
        </button>
        <button
          className={`flex items-center bg-gray-200 rounded-md px-2 py-2 ${
            isDisliked ? "text-red-500" : ""
          }`}
          onClick={() => onCommentVote(commentId, "dislike")}
          disabled={isDisliked}
        >
          <img src={thumb_down} alt="Dislike" className="h-5 w-5 mr-2" />
          {dislikesCount}
        </button>
      </div>
    </div>
  );
}

