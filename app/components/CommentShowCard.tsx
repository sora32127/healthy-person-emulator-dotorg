import { NavLink } from "@remix-run/react";
import CommentIcon from "./icons/CommentIcon";
import ArticleIcon from "./icons/ArticleIcon";
import RelativeDate from "./RelativeDate";

interface CommentShowCardProps {
  commentContent: string;
  commentDateGmt: string;
  commentAuthor: string;
  postId: number;
  dimPosts: {
      postTitle: string;
  };
}

export default function CommentShowCard({
  commentContent,
  commentDateGmt,
  commentAuthor,
  postId,
  dimPosts,
}: CommentShowCardProps) {

  return (
      <div className="bg-base-100 border-2 rounded-lg p-4 mb-4">
          <div className="flex justify-between items-center mb-2">
              <RelativeDate timestamp={commentDateGmt} />
              <span className="text-lg font-bold text-base-content comment-author">{commentAuthor}</span>
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
              <NavLink to={`/archives/${postId}`} className="text-xl font-bold text-info underline underline-offset-4 post-title">{dimPosts.postTitle}</NavLink>
          </div>
      </div>
  );
}