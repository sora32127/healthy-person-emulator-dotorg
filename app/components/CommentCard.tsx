import { useState } from "react";
import CommentInputBox from "./CommentInputBox";
import { useSubmit } from "@remix-run/react";
import ClockIcon from "./icons/ClockIcon";
import ThumbsUpIcon from "./icons/ThumbsUpIcon";
import ThumbsDownIcon from "./icons/ThumbsDownIcon";

interface CommentCardProps {
  commentId: number;
  commentDateGmt: string;
  commentAuthor: string;
  commentContent: string;
  level: number;
  onCommentVote: (commentId: number, voteType: "like" | "dislike") => void;
  likedComments: number[];
  dislikedComments: number[];
  likesCount: number;
  dislikesCount: number;
  postId: number;
  isAdmin: boolean;
  isCommentOpen: boolean;
}

export default function CommentCard({
  commentId,
  commentDateGmt,
  commentAuthor,
  commentContent,
  level,
  onCommentVote,
  likedComments,
  dislikedComments,
  likesCount,
  dislikesCount,
  postId,
  isAdmin,
  isCommentOpen,
}: CommentCardProps) {

  const formattedCommentDate = new Date(commentDateGmt).toLocaleString(
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

  const [isReplyBoxShown, setIsReplyBoxShown] = useState(false);
  const [replyAuthor, setReplyAuthor] = useState("Anonymous");
  const [replyContent, setReplyContent] = useState("");

  const [isCommentLikeButtonPushed, setIsCommentLikeButtonPushed] = useState(false);
  const [isCommentDislikeButtonPushed, setIsCommentDislikeButtonPushed] = useState(false);

  const submit = useSubmit();

  const handleReplyCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append("postId", postId.toString());
    formData.append("commentAuthor", replyAuthor);
    formData.append("commentContent", replyContent);
    formData.append("commentParentId", commentId.toString());
    formData.append("action", "submitComment")

    await submit(formData, {
      method: "post",
      action: `/archives/${postId}`,
    });

    setReplyAuthor("");
    setReplyContent("");
    setIsReplyBoxShown(false);
  };

  const handleCommentDelete = async () => {
    const formData = new FormData();
    formData.append("commentId", commentId.toString());
    formData.append("postId", postId.toString());
    formData.append("action", "deleteComment");
    await submit(formData, {
      method: "post",
      action: `/archives/${postId}`,
    });
  }

  return (
    <div className="bg-base-100 p-4 mb-4" style={{ marginLeft }}>
      <div className="flex items-center">
        <p className="text-green-700 font-bold mr-4">{commentAuthor}</p>
        <ClockIcon  />
        <p className="text-sm ml-2">{formattedCommentDate}</p>
      </div>
      <p className="mt-2 whitespace-pre-wrap">{commentContent}</p>
      <div className="flex items-center mt-4">
        <button
          className={`flex items-center mr-4 bg-inherit rounded-md px-2 py-2 border ${
            isLiked ? "text-blue-500 fonr-bold" : ""
          }`}
          onClick={() => (onCommentVote(commentId, "like"), setIsCommentLikeButtonPushed(true))}
          disabled={isCommentLikeButtonPushed || isLiked}
        >
          <ThumbsUpIcon />
          <p className="ml-2">
          {likesCount}
          </p>
        </button>
        <button
          className={`flex items-center bg-inherit rounded-md px-2 py-2 border ${
            isDisliked ? "text-red-500 font-bold" : ""
          }`}
          onClick={() => (onCommentVote(commentId, "dislike"), setIsCommentDislikeButtonPushed(true))}
          disabled={isCommentDislikeButtonPushed || isDisliked}
        >
          <ThumbsDownIcon />
          <p className="ml-2">
          {dislikesCount}
          </p>
        </button>
      </div>
    <button
        className="mt-2 text-blue-500"
        onClick={() => setIsReplyBoxShown(!isReplyBoxShown)}
    >
        {isReplyBoxShown ? "キャンセル" : "返信"}
    </button>
        <div className="ml-2">
        {isReplyBoxShown && (
            <CommentInputBox
                commentAuthor={replyAuthor}
                commentContent={replyContent}
                onCommentAuthorChange={setReplyAuthor}
                onCommentContentChange={setReplyContent}
                onSubmit={handleReplyCommentSubmit}
                isCommentOpen={isCommentOpen}
                commentParentId={commentId}
            />
        )}
        </div>
      {isAdmin && (
        <button
          className="mt-2 text-red-500"
          onClick={handleCommentDelete}
        >
          削除
        </button>
      )}
    </div>
  );
}

