import { useState } from "react";
import CommentInputBox from "./CommentInputBox";
import { useSubmit } from "@remix-run/react";
import ClockIcon from "./icons/ClockIcon";
import ThumbsUpIcon from "./icons/ThumbsUpIcon";
import ThumbsDownIcon from "./icons/ThumbsDownIcon";
import RelativeDate from "./RelativeDate";

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
        <p className="text-green-700 font-bold mr-1">{commentAuthor}</p>
        <div className="pr-0.5">
        <ClockIcon  />
        </div>
        <RelativeDate timestamp={commentDateGmt} />
      </div>
      <p className="whitespace-pre-wrap break-words">{commentContent}</p>
      <div className="flex items-center mt-4">
        <div className="tooltip" data-tip="このコメントを高評価する">
          <button
            className={`flex items-center mr-4 rounded-md px-2 py-2 bg-base-300 hover:bg-base-200 ${
              isLiked ? "text-blue-500 font-bold" : ""
            } comment-like-button`}
            onClick={() => {
              onCommentVote(commentId, "like");
              setIsCommentLikeButtonPushed(true);
            }}
            disabled={isCommentLikeButtonPushed || isLiked}
            type="button"
          >
            <ThumbsUpIcon />
            <p className="ml-2">
            {likesCount}
            </p>
          </button>
        </div>
        <div className="tooltip" data-tip="このコメントを低評価する">
          <button
            className={`flex items-center mr-4 rounded-md px-2 py-2 bg-base-300 hover:bg-base-200 ${
              isDisliked ? "text-red-500 font-bold" : ""
            } comment-dislike-button`}
            onClick={() => {
              onCommentVote(commentId, "dislike");
              setIsCommentDislikeButtonPushed(true);
            }}
            disabled={isCommentDislikeButtonPushed || isDisliked}
            type="button"
          >
            <ThumbsDownIcon />
            <p className="ml-2">
            {dislikesCount}
            </p>
          </button>
        </div>
      </div>
    <button
        className="mt-2 text-blue-500"
        onClick={() => setIsReplyBoxShown(!isReplyBoxShown)}
        type="button"
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
          type="button"
        >
          削除
        </button>
      )}
    </div>
  );
}

