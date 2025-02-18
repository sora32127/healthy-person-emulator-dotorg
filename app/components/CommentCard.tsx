import { useState, useRef } from "react";
import CommentInputBox from "./CommentInputBox";
import ClockIcon from "./icons/ClockIcon";
import { VoteButton } from "./VoteButton";
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
  commentDateGmt: Date;
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
  const [isCommentLikeAnimating, setIsCommentLikeAnimating] = useState(false);
  const [isCommentDislikeAnimating, setIsCommentDislikeAnimating] = useState(false);
  
  const { setValue, getValues } = useForm<CommentVoteSchema>({
    resolver: zodResolver(commentVoteSchema),
  });

  const nodeRef = useRef(null);

  const handleCommentVote = async (voteType: "like" | "dislike") => {
    setValue("voteType", voteType);
    setValue("commentId", commentId);
    
    if (voteType === "like") {
      setIsCommentLikeAnimating(true);
      setTimeout(() => {
        setIsCommentLikeButtonPushed(true);
        setIsCommentLikeAnimating(false);
      }, 1000);
    }
    if (voteType === "dislike") {
      setIsCommentDislikeAnimating(true);
      setTimeout(() => {
        setIsCommentDislikeButtonPushed(true);
        setIsCommentDislikeAnimating(false);
      }, 1000);
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
        <RelativeDate targetDate={commentDateGmt} />
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
        <VoteButton
          type="like"
          count={likesCount}
          isAnimating={isCommentLikeAnimating}
          isVoted={isLiked}
          disabled={isCommentLikeButtonPushed || isLiked || isCommentLikeAnimating}
          onClick={() => handleCommentVote("like")}
        />
        <VoteButton
          type="dislike"
          count={dislikesCount}
          isAnimating={isCommentDislikeAnimating}
          isVoted={isDisliked}
          disabled={isCommentDislikeButtonPushed || isDisliked || isCommentDislikeAnimating}
          onClick={() => handleCommentVote("dislike")}
        />
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

