import { NavLink } from "@remix-run/react";
import CommentIcon from "./icons/CommentIcon";
import ArticleIcon from "./icons/ArticleIcon";
import RelativeDate from "./RelativeDate";
import ClockIcon from "./icons/ClockIcon";
import ThumbsDownIcon from "./icons/ThumbsDownIcon";
import ThumbsUpIcon from "./icons/ThumbsUpIcon";
import type { CommentShowCardData } from "~/modules/db.server";


export default function CommentShowCard({
  commentContent,
  commentDateGmt,
  postId,
  postTitle,
  countLikes,
  countDislikes,
}: CommentShowCardData) {
  return (
      <div className="bg-base-100 border-b border-neutral p-4 mb-4">
        <div className="flex justify-between items-center mb-2">
            <div className="flex my-1">
                <div className="pr-2">
                    <ClockIcon/>
                </div>
                <RelativeDate targetDate={commentDateGmt} />
            </div>
            <div className="flex justify-between items-center gap-x-2">
                <div className="flex gap-x-1">
                    <ThumbsUpIcon />
                    <span>{countLikes}</span>
                </div>
                <div className="flex gap-x-1">
                    <ThumbsDownIcon />
                    <span>{countDislikes}</span>
                </div>
            </div>
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-2 mb-2 items-center">
            <div className="w-6 h-6">
                <CommentIcon />
            </div>
            <p className="text-base-content comment-content">{commentContent}</p>
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-2 items-center">
            <div className="w-6 h-6">
                <ArticleIcon />
            </div>
            <NavLink to={`/archives/${postId}`} className="text-xl font-bold post-title hover:underline hover:underline-offset-4">{postTitle}</NavLink>
        </div>

      </div>
  );
}