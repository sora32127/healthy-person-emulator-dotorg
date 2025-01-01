import { useState, useRef } from "react";
import CommentInputBox from "./CommentInputBox";
import ClockIcon from "./icons/ClockIcon";
import ThumbsUpIcon from "./icons/ThumbsUpIcon";
import ThumbsDownIcon from "./icons/ThumbsDownIcon";
import RelativeDate from "./RelativeDate";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { CommentFormInputs } from "./CommentInputBox";
import { Share } from 'lucide-react';
import { CSSTransition } from 'react-transition-group';


const commentVoteSchema = z.object({
  commentId: z.number(),
  voteType: z.enum(["like", "dislike"]),
});

export type CommentVoteSchema = z.infer<typeof commentVoteSchema>;


interface CommentCardProps {
  commentId: number;
  commentDateGmt: string;
  commentAuthor: string;
  commentContent: string;
  level: number;
  onCommentVote: (data: CommentVoteSchema) => void;
  onCommentSubmit: (data: CommentFormInputs) => void;
  likedComments: number[];
  dislikedComments: number[];
  likesCount: number;
  dislikesCount: number;
  postId: number;
  isCommentOpen: boolean;
  postTitle: string;
}

export default function CommentCard({
  commentId,
  commentDateGmt,
  commentAuthor,
  commentContent,
  level,
  onCommentVote,
  onCommentSubmit,
  likedComments,
  dislikedComments,
  likesCount,
  dislikesCount,
  postId,
  isCommentOpen,
  postTitle,
}: CommentCardProps) {

  const marginLeft = `${level * 2}rem`;
  const isLiked = likedComments?.includes(commentId);
  const isDisliked = dislikedComments?.includes(commentId);

  const [isReplyBoxShown, setIsReplyBoxShown] = useState(false);

  const [isCommentLikeButtonPushed, setIsCommentLikeButtonPushed] = useState(false);
  const [isCommentDislikeButtonPushed, setIsCommentDislikeButtonPushed] = useState(false);
  
  const { setValue, getValues } = useForm<CommentVoteSchema>({
    resolver: zodResolver(commentVoteSchema),
  });

  const nodeRef = useRef(null);

  const handleCommentVote = async (voteType: "like" | "dislike") => {
    setValue("voteType", voteType);
    setValue("commentId", commentId);
    
    if (voteType === "like") {
      setIsCommentLikeButtonPushed(true);
    }
    if (voteType === "dislike") {
      setIsCommentDislikeButtonPushed(true);
    }
    onCommentVote(getValues());
  };

  const handleReplyCommentSubmit = async (data: CommentFormInputs) => {
    onCommentSubmit(data);
    setIsReplyBoxShown(false);
  }

  const invokeShareAPI = async () => {
    const currentURL = `${window.location.href.split("#")[0]}#comment-${commentId}`;
    const shareTitle = `${commentAuthor}のコメント ${postTitle} - 健常者エミュレータ事例集`;
    try {
        await navigator.share({ url: currentURL, title: shareTitle });
    } catch (error) {
        console.error("シェアAPIが使えませんでした", error);
    }
}
  

  return (
    <div className="bg-base-100 p-4 mb-4" style={{ marginLeft }}>
      <div className="flex items-center">
        <p className="text-green-700 font-bold mr-1">{commentAuthor}</p>
        <div className="pr-0.5">
          <ClockIcon  />
        </div>
        <RelativeDate timestamp={commentDateGmt} />
        <div>
          <button
            type="button"
            className="btn btn-circle btn-sm btn-ghost"
            onClick={() => invokeShareAPI()}
          >
            <Share className="fill-none stroke-current w-4 h-4" />
          </button>
        </div>
      </div>
      <p className="whitespace-pre-wrap break-words">{commentContent}</p>
      <div className="flex items-center mt-4">　　　　　　
        <div>
          <button
            className={`flex items-center mr-4 rounded-md px-2 py-2 bg-base-300 hover:bg-base-200 ${
              isLiked ? "text-blue-500 font-bold" : ""
            } comment-like-button`}
            onClick={() => {
              handleCommentVote("like");
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
        <div>
          <button
            className={`flex items-center mr-4 rounded-md px-2 py-2 bg-base-300 hover:bg-base-200 ${
              isDisliked ? "text-red-500 font-bold" : ""}
              comment-dislike-button`}
            onClick={() => {
              handleCommentVote("dislike");
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
        <CSSTransition
          in={isReplyBoxShown}
          nodeRef={nodeRef}
          timeout={300}
          classNames="reply-box"
          unmountOnExit
        >
          <div ref={nodeRef}>
            <CommentInputBox
              onSubmit={handleReplyCommentSubmit}
              isCommentOpen={isCommentOpen}
              commentParentId={commentId}
            />
          </div>
        </CSSTransition>
        </div>
    </div>
  );
}

