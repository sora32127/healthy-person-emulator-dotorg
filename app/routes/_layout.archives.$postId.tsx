import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import { useLoaderData, NavLink, useSubmit, Form, useFetcher } from "@remix-run/react";
import { prisma } from "~/modules/db.server";
import CommentCard from "~/components/CommentCard";
import parser from "html-react-parser";
import TagCard from "~/components/TagCard";
import clockIcon from "~/src/assets/clock_icon.svg";
import tagIcon from "~/src/assets/tag_icon.svg";
import { useState } from "react";
import { getClientIPAddress } from "remix-utils/get-client-ip-address";
import thumb_up from "~/src/assets/thumb_up.svg";
import thumb_down from "~/src/assets/thumb_down.svg";
import { commitSession, getSession } from "~/modules/session.server";
import { supabase } from "~/modules/supabase.server";
import { H2 } from "~/components/Headings";
import arrowForwardIcon from "~/src/assets/arrow_forward.svg";
import arrowBackIcon from "~/src/assets/arrow_back.svg";


export async function loader({ request }:LoaderFunctionArgs){
    const url = new URL(request.url);
    // Wordpress時代のURLと合わせるため、以下の形式のURLを想定する
    // https://healthy-person-emulator.org/archives/${postId}?q...
    const postId = url.pathname.split("/")[2];
    const postContent = await prisma.dimPosts.findFirst({
        where: {
          postId: Number(postId),
        },
        select: {
          postId: true,
          postTitle: true,
          postContent: true,
          postDateJst: true,
          countLikes: true,
          countDislikes: true,
          rel_post_tags: {
            select: {
              dimTag: {
                select: {
                  tagName: true,
                },
              },
            },
          },
        },
    });

    const comments = await prisma.dimComments.findMany({
        where: {
          postId: Number(postId),
        },
    });

    const commentVoteData = await prisma.fctCommentVoteHisotry.groupBy({
        by: ["commentId", "voteType" ],
        _count: { commentId: true },
        where: {
          commentId: { in: comments.map((comment) => comment.commentId) },
        },
    });
    const { data, error } = await supabase.rpc("search_similar_content", {
      query_post_id: Number(postId),
      match_threshold: 0,
      match_count: 10,
    });

    let similarPosts = [];
    if (error) {
      console.error("Failed to fetch similar posts", error);
    }else{
      similarPosts = data.slice(1,);
    }

    const session = await getSession(request.headers.get("Cookie"));
    const likedPages = session.get("likedPages") || [];
    const dislikedPages = session.get("dislikedPages") || [];
    const likedComments = session.get("likedComments") || [];
    const dislikedComments = session.get("dislikedComments") || [];

    const prevPost = await prisma.dimPosts.findFirst({
      where: {
        postDateJst: { lt: postContent?.postDateJst },
      },
      orderBy: {
        postDateJst: "desc",
      },
    });
    
    const nextPost = await prisma.dimPosts.findFirst({
      where: {
        postDateJst: { gt: postContent?.postDateJst },
      },
      orderBy: {
        postDateJst: "asc",
      },
    });

    return json({ postContent, comments, commentVoteData, likedPages, dislikedPages, likedComments, dislikedComments, similarPosts, prevPost, nextPost });
}

export default function Component() {
  const { postContent, comments, likedPages, dislikedPages, commentVoteData, likedComments, dislikedComments, similarPosts, prevPost, nextPost } = useLoaderData<typeof loader>();

  const [commentAuthor, setCommentAuthor] = useState("Anonymous");
  const [commentContent, setCommentContent] = useState("");
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const submit = useSubmit();
  const fetcher = useFetcher();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [userVote, setUserVote] = useState<"like" | "dislike" | null>(null);

  const isLiked = likedPages.includes(postContent?.postId);
  const isDisliked = dislikedPages.includes(postContent?.postId);

  const handleVote = async (voteType: "like" | "dislike") => {
    if (isLiked && isDisliked) {
      return;
    }

    const formData = new FormData();
    formData.append("postId", postContent?.postId.toString() || "");
    formData.append("voteType", voteType);

    fetcher.submit(formData, {
      method: "post",
      action: `/archives/${postContent?.postId}`,
    });

    setUserVote(voteType);
  };


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
  
  const handleCommentVote = async (commentId: number, voteType: "like" | "dislike") => {
    const formData = new FormData();
    formData.append("postId", postContent?.postId.toString() || "");
    formData.append("commentId", commentId.toString());
    formData.append("voteType", voteType);

    fetcher.submit(formData, {
        method: "post",
        action: `/archives/${postContent?.postId}`,
    });
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
                    onCommentVote={handleCommentVote}
                    likedComments={likedComments}
                    dislikedComments={dislikedComments}
                    likesCount={commentVoteData.find((data) => data.commentId === comment.commentId && data.voteType === 1)?._count.commentId || 0}
                    dislikesCount={commentVoteData.find((data) => data.commentId === comment.commentId && data.voteType === -1)?._count.commentId || 0}
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
  const sortedTagNames = postContent?.rel_post_tags.sort((a, b) => {
    if (a.dimTag.tagName > b.dimTag.tagName) {
      return 1;
    }
    if (a.dimTag.tagName < b.dimTag.tagName) {
      return -1;
    }
    return 0;
  })


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
              {sortedTagNames && sortedTagNames.map((tag) => (
                  <span key={tag.dimTag.tagName} className="inline-block text-sm font-semibold text-gray-500 mr-1">
                      <TagCard tagName={tag.dimTag.tagName} />
                  </span>
                  
              ))}
          </div>
        </div>
        <div className="flex items-center p-2 rounded">
          <button
            className={`flex items-center mr-4 bg-gray-200 rounded-md px-2 py-2 ${
              isLiked ? "text-blue-500" : ""
            }`}
            onClick={() => handleVote("like")}
            disabled={isLiked}
          >
            <img src={thumb_up} alt="Like" className="h-5 w-5 mr-2" />
            {postContent?.countLikes}
          </button>
          <button
            className={`flex items-center bg-gray-200 rounded-md px-2 py-2 ${
              isDisliked ? "text-red-500" : ""
            }`}
            onClick={() => handleVote("dislike")}
            disabled={isDisliked}
          >
            <img src={thumb_down} alt="Dislike" className="h-5 w-5 mr-2" />
            {postContent?.countDislikes}
          </button>
        </div>
        <div className="postContent">
            {postContent && parser(postContent.postContent)}
        </div>
        <H2>関連記事</H2>
        <div>
          <ul className="list-disc list-outside mb-4 ml-4">
            {similarPosts.map((post: any) => (
              <li key={post.post_id} className="my-2">
                <NavLink
                  to={`/archives/${post.post_id}`}
                  className="text-blue-700 underline underline-offset-4"
                >
                  {post.post_title}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col md:flex-row justify-between items-center">
          {nextPost && (
            <div className="flex items-center mb-4 md:mb-0">
              <img src={arrowForwardIcon} alt="Next post" className="h-5 w-5 mr-2" />
              <NavLink
                to={`/archives/${nextPost.postId}`}
                className="text-blue-700 underline underline-offset-4"
              >
                {nextPost.postTitle}
              </NavLink>
            </div>
          )}
          {prevPost && (
            <div className="flex items-center">
              <NavLink
                to={`/archives/${prevPost.postId}`}
                className="text-blue-700 underline underline-offset-4 mr-2"
              >
                {prevPost.postTitle}
              </NavLink>
              <img src={arrowBackIcon} alt="Previous post" className="h-5 w-5" />
            </div>
          )}
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
  const voteType = formData.get("voteType")?.toString();
  const commentId = Number(formData.get("commentId"));

  const ip = getClientIPAddress(request) || "";
  const voteUserIpHash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(ip)
  );
  const hashArray = Array.from(new Uint8Array(voteUserIpHash));
  const voteUserIpHashString = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const localDate = new Date();
  const utcDate = new Date(localDate.getTime() + localDate.getTimezoneOffset() * 60000);

  if (commentId) {
    console.log(localDate, voteUserIpHashString, commentId, postId, voteType);
    await prisma.$transaction(async (prisma) => {
        await prisma.fctCommentVoteHisotry.create({
            data: {
                commentVoteDateJst: localDate,
                voteUserIpHash: voteUserIpHashString,
                commentId,
                postId,
                voteType: voteType === "like" ? 1 : -1,
            },
        });
    });

    const session = await getSession(request.headers.get("Cookie"));
    if (voteType === "like") {
        session.set("likedComments", [...(session.get("likedComments") || []), commentId]);
    } else if (voteType === "dislike") {
        session.set("dislikedComments", [...(session.get("dislikedComments") || []), commentId]);
    }

    return json(
        { success: true },
        {
            headers: {
                "Set-Cookie": await commitSession(session),
            },
        }
    );
  }

  if (voteType !== "like" && voteType !== "dislike") {
    return json({ error: "無効な投票タイプです。" }, { status: 400 });
  }

  await prisma.$transaction(async (prisma) => {
    await prisma.fctPostVoteHisotry.create({
      data: {
        voteDateGmt: utcDate,
        voteUserIpHash: voteUserIpHashString,
        postId,
        voteTypeInt: voteType === "like" ? 1 : -1,
      },
    });

    if (voteType === "like") {
      await prisma.dimPosts.update({
        where: { postId },
        data: { countLikes: { increment: 1 } },
      });
    } else {
      await prisma.dimPosts.update({
        where: { postId },
        data: { countDislikes: { increment: 1 } },
      });
    }
  });

  const session = await getSession(request.headers.get("Cookie"));
  if (voteType === "like") {
    session.set("likedPages", [...(session.get("likedPages") || []), postId]);
  } else if (voteType === "dislike") {
    session.set("dislikedPages", [...(session.get("dislikedPages") || []), postId]);
  }

  return json(
    { success: true },
    {
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    }
  );
}