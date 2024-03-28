import { LoaderFunctionArgs, json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { prisma } from "~/modules/db.server";
import CommentCard from "~/components/CommentCard";
import parser from "html-react-parser";

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
          <div>
              {tagNames.map((tag) => (
                  <span key={tag.tagName}>{tag.tagName}</span>
              ))}
          </div>
          <div className="postContent">
              {postContent && parser(postContent.postContent)}
          </div>
          <div>
              {renderComments()}
          </div>
      </div>
  );
}
