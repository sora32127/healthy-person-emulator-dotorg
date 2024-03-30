import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import { useLoaderData, NavLink, useSubmit, Form } from "@remix-run/react";
import { prisma } from "~/modules/db.server";
import CommentCard from "~/components/CommentCard";
import parser from "html-react-parser";
import TagCard from "~/components/TagCard";
import clockIcon from "~/src/assets/clock_icon.svg";
import tagIcon from "~/src/assets/tag_icon.svg";
import { useState } from "react";
import { getClientIPAddress } from "remix-utils/get-client-ip-address";


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
  const [commentAuthor, setCommentAuthor] = useState("Anonymous");
  const [commentContent, setCommentContent] = useState("");
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const submit = useSubmit();

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append("postId", postContent?.postId.toString() || "");
    formData.append("commentAuthor", commentAuthor);
    formData.append("commentContent", commentContent);
    formData.append("commentParent", replyTo ? replyTo.toString() : "0");

    await submit(formData, {
      method: "post",
      action: `/archives/${postContent?.postId}`,
    });
  };

  const handleReplyClick = (commentId: number) => {
    setReplyTo(commentId);
  };
  

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
                    onReplyClick={handleReplyClick}
                />
                {replyTo === comment.commentId && (
                  <div className="ml-8">
                    <Form onSubmit={handleCommentSubmit}>
                      <div className="mb-4">
                        <label htmlFor="replyAuthor" className="block mb-2">
                          名前
                        </label>
                        <input
                          type="text"
                          id="replyAuthor"
                          value={commentAuthor}
                          onChange={(e) => setCommentAuthor(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="mb-4">
                        <label htmlFor="replyContent" className="block mb-2">
                          返信
                        </label>
                        <textarea
                          id="replyContent"
                          value={commentContent}
                          onChange={(e) => setCommentContent(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows={4}
                        ></textarea>
                      </div>
                      <button
                        type="submit"
                        className="px-4 py-2 text-white bg-blue-500 rounded-md hover:bg-blue-600"
                      >
                        返信を投稿
                      </button>
                    </Form>
                  </div>
                )}
                {renderComments(comment.commentId, level + 1)}
            </div>
        ));
};

  return (
      <div>
        <h1>{postContent && postContent.postTitle}</h1>
        <p className="flex my-1">
            <img src={clockIcon} alt="Post date" className="h-5 w-5 mr-2 mt-0.5" />
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
          <img src={tagIcon} alt="Tag icon" className="h-5 w-5 mr-2" />
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
            to={`/archives/edit/${postContent?.postId}`}
            className="bg-blue-500 text-white rounded px-4 py-2 mx-1 my-20"
          >
            編集する
          </NavLink>
        </div>
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">コメントを投稿する</h2>
          <Form onSubmit={handleCommentSubmit}>
            <div className="mb-4">
              <label htmlFor="commentAuthor" className="block mb-2">
                名前
              </label>
              <input
                type="text"
                id="commentAuthor"
                value={commentAuthor}
                onChange={(e) => setCommentAuthor(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
              <label htmlFor="commentContent" className="block mb-2">
                コメント
              </label>
              <textarea
                id="commentContent"
                value={commentContent}
                onChange={(e) => setCommentContent(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={4}
              ></textarea>
              <button
                type="submit"
                className="px-4 py-2 text-white bg-blue-500 rounded-md hover:bg-blue-600"
              >
                コメントを投稿
              </button>
            </Form>
          </div>
        <div>
            {renderComments()}
        </div>
      </div>
  );
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const postId = Number(formData.get("postId"));
  const commentAuthor = formData.get("commentAuthor")?.toString() || "Anonymous";
  const commentContent = formData.get("commentContent")?.toString() || "";
  const commentParent = Number(formData.get("commentParent"));

  const ip = getClientIPAddress(request) || "";

  // IPアドレスをハッシュ化する
  const commentAuthorIpHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip))
  const hashArray = Array.from(new Uint8Array(commentAuthorIpHash));
  const commentAuthorIpHashString = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  const localDate = new Date();
  const utcDate = new Date(localDate.getTime() + localDate.getTimezoneOffset() * 60000);
  const newComment = await prisma.dimComments.create({
    data: {
      postId,
      commentAuthor,
      commentAuthorIpHash: commentAuthorIpHashString,
      commentDateJst: localDate,
      commentDateGmt: utcDate,
      commentContent,
      commentParent,
    },
  });

  return json(newComment);
}
