import { LoaderFunctionArgs, json } from "@remix-run/node";
import { useLoaderData, NavLink } from "@remix-run/react";
import { prisma } from "~/modules/db.server";
import CommentCard from "~/components/CommentCard";
import parser from "html-react-parser";
import TagCard from "~/components/TagCard";

export async function loader({ request }:LoaderFunctionArgs){
    const url = new URL(request.url);
    // Wordpress時代のURLと合わせるため、以下の形式のURLを想定する
    // https://healthy-person-emulator.org/archives/${postId}?q...
    const postId = url.pathname.split("/")[2];
    const postContent = await prisma.userPostContent.findFirst({
        where: {
          postId: Number(postId),
        },
        orderBy: {
          postRevisionNumber: 'desc',
        },
      });
    
    const tagNames = await prisma.dimTags.findMany({
        select: {
          tagName: true,
        },
        where: {
          postId: Number(postId),
        },
    });

    const comments = await prisma.dimComments.findMany({
        where: {
          postId: Number(postId),
        },
    });
    
    return json({ postContent, tagNames, comments });
}

export default function Component() {
  const { postContent, tagNames, comments } = useLoaderData<typeof loader>();

  const renderComments = (parentId: number = 0, level: number = 0) => {
      return comments
          .filter((comment) => comment.commentParent === parentId)
          .map((comment) => (
              <div key={comment.commentId}>
                  <CommentCard
                      commentId={comment.commentId}
                      commentContent={comment.commentContent}
                      commentDateJst={comment.commentDateJst}
                      commentAuthor={comment.commentAuthor}
                      commentParentId={comment.commentParent}
                      level={level}
                  />
                  {renderComments(comment.commentId, level + 1)}
              </div>
          ));
  };

  return (
      <div>
        <h1>{postContent && postContent.postTitle}</h1>
        <p className="flex my-1">
            <img src="/src/assets/clock_icon.svg" alt="Post date" className="h-5 w-5 mr-2 mt-0.5" />
            {postContent && new Date(postContent.postDateJst).toLocaleString("ja-JP", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hourCycle: "h23",
            }).replace(/\//g, "-")}
        </p>
        <div className="flex justify-start items-center mb-2">
          <img src="/src/assets/tag_icon.svg" alt="Tag icon" className="h-5 w-5 mr-2" />
          <div>
              {tagNames.map((tag) => (
                  <span key={tag.tagName} className="inline-block mt-3 text-sm font-semibold text-gray-500 mr-2">
                      <TagCard tagName={tag.tagName} />
                  </span>
                  
              ))}
          </div>
        </div>
        <div className="postContent">
            {postContent && parser(postContent.postContent)}
        </div>
        <div>
          <NavLink
            to={`/archives/${postContent?.postId}/edit`}
            className="bg-blue-500 text-white rounded px-4 py-2 mx-1 my-20"
          >
            編集する
          </NavLink>
        </div>
        <div>
            {renderComments()}
        </div>
      </div>
  );
}
