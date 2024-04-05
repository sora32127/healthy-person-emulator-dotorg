import { NavLink } from "@remix-run/react";
import commentIcon from "~/src/assets/comment_icon.svg";
import articleIcon from "~/src/assets/article_icon.svg";

interface CommentShowCardProps {
   commentContent: string;
   commentDateJst: string;
   commentAuthor: string;
   postId: number;
   dimPosts: {
       postTitle: string;
   };
}

export default function CommentShowCard({
   commentContent,
   commentDateJst,
   commentAuthor,
   postId,
   dimPosts,
}: CommentShowCardProps) {
   const formattedCommentDate = new Date(commentDateJst).toLocaleString("ja-JP", {
       year: "numeric",
       month: "2-digit",
       day: "2-digit",
       hour: "2-digit",
       minute: "2-digit",
       second: "2-digit",
       hourCycle: "h23",
   }).replace(/\//g, "-");

   return (
       <div className="bg-white shadow-md rounded-md p-4 mb-4">
           <div className="flex justify-between items-center mb-2">
               <p className="text-gray-600 text-sm">{formattedCommentDate}</p>
               <span className="text-lg font-bold text-gray-800">{commentAuthor}</span>
           </div>
           <div className="flex mb-2">
               <img src={commentIcon} alt="Comment icon" className="h-5 w-5 inline-block mr-2" />
               <p className="text-gray-700">{commentContent}</p>
           </div>
           <div className="flex items-center">
               <img src={articleIcon} alt="Article icon" className="h-5 w-5 inline-block mr-2" />
               <NavLink to={`/archives/${postId}`} className="text-xl font-bold text-blue-600 underline underline-offset-4 decoration-blue-700">{dimPosts.postTitle}</NavLink>
           </div>
       </div>
   );
}
