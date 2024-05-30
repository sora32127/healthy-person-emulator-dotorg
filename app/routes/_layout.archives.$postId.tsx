import { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction, json, redirect } from "@remix-run/node";
import { useLoaderData, NavLink, useSubmit, useFetcher } from "@remix-run/react";
import { prisma } from "~/modules/db.server";
import CommentCard from "~/components/CommentCard";
import parser from "html-react-parser";
import TagCard from "~/components/TagCard";
import { useState } from "react";
import { getClientIPAddress } from "remix-utils/get-client-ip-address";
import { commitSession, getSession, isAdminLogin } from "~/modules/session.server";
import { supabase } from "~/modules/supabase.server";
import { H1, H2 } from "~/components/Headings";
import CommentInputBox from "~/components/CommentInputBox";
import ShareButtons from "~/components/ShareButtons";
import ArrowBackIcon from "~/components/icons/ArrowBackIcon";
import ClockIcon from "~/components/icons/ClockIcon";
import TagIcon from "~/components/icons/TagIcon";
import ThumbsUpIcon from "~/components/icons/ThumbsUpIcon";
import ThumbsDownIcon from "~/components/icons/ThumbsDownIcon";
import ArrowForwardIcon from "~/components/icons/ArrowForwardIcon";
import RelativeDate from "~/components/RelativeDate";


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
          postDateGmt: true,
          countLikes: true,
          countDislikes: true,
          commentStatus: true,
          ogpImageUrl: true,
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

    if (!postContent) {
      throw new Response("Post not found", {
        status: 404,
      })
    }

    const comments = await prisma.dimComments.findMany({
        where: {
          postId: Number(postId),
        },
        orderBy: {
          commentDateJst: "desc",
        },
    });

    const commentVoteData = await prisma.fctCommentVoteHistory.groupBy({
        by: ["commentId", "voteType" ],
        _count: { commentId: true },
        where: {
          commentId: { in: comments.map((comment) => comment.commentId) },
        },
    });
    const { data, error } = await supabase.rpc("search_similar_content", {
      query_post_id: Number(postId),
      match_threshold: 0,
      match_count: 16,
    });

    let similarPosts = [];
    if (error) {
      console.error(error.code, error.message);
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
        postDateGmt: { lt: postContent?.postDateGmt },
      },
      orderBy: {
        postDateGmt: "desc",
      },
    });
    
    const nextPost = await prisma.dimPosts.findFirst({
      where: {
        postDateGmt: { gt: postContent?.postDateGmt },
        postId: { not: postContent?.postId }, // 同じ記事が表示されないようにする
      },
      orderBy: {
        postDateGmt: "asc",
      },
    });

    const isAdmin = await isAdminLogin(request);
    const tagNames = postContent.rel_post_tags.map((rel) => rel.dimTag.tagName); // MetaFunctionで使用するため、ここで定義

    return json({ postContent, comments, commentVoteData, likedPages, dislikedPages, likedComments, dislikedComments, similarPosts, prevPost, nextPost, isAdmin, tagNames });
}

export default function Component() {
  const { postContent, comments, likedPages, dislikedPages, commentVoteData, likedComments, dislikedComments, similarPosts, prevPost, nextPost, isAdmin } = useLoaderData<typeof loader>();
  const [commentAuthor, setCommentAuthor] = useState("Anonymous");
  const [commentContent, setCommentContent] = useState("");
  const submit = useSubmit();
  const fetcher = useFetcher();

  const isLiked = likedPages.includes(postContent?.postId);
  const isDisliked = dislikedPages.includes(postContent?.postId);
  const [isPageLikeButtonPushed, setIsPageLikeButtonPushed] = useState(false);
  const [isPageDislikeButtonPushed, setIsPageDislikeButtonPushed] = useState(false);
  const [isLikeAnimating, setIsLikeAnimating] = useState(false);
  const [isDislikeAnimating, setIsDislikeAnimating] = useState(false);

  const handleVoteOnClient = async (voteType: "like" | "dislike") => {
    if (voteType === "like") {
      setIsLikeAnimating(true);
      setTimeout(() => {
        setIsPageLikeButtonPushed(true);
        setIsLikeAnimating(false);
      }, 1000);
    } else if (voteType === "dislike") {
      setIsDislikeAnimating(true);
      setTimeout(() => {
        setIsPageDislikeButtonPushed(true);
        setIsDislikeAnimating(false);
      }, 1000);
    }
    const formData = new FormData();
    formData.append("postId", postContent?.postId.toString() || "");
    formData.append("voteType", voteType);
    formData.append("action", "votePost");

    fetcher.submit(formData, {
      method: "post",
      action: `/archives/${postContent?.postId}`,
    });
  };


  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append("postId", postContent?.postId.toString() || "");
    formData.append("commentAuthor", commentAuthor);
    formData.append("commentContent", commentContent);
    formData.append("action", "submitComment")

    await submit(formData, {
      method: "post",
      action: `/archives/${postContent?.postId}`,
    });

    setCommentAuthor("Anonymous");
    setCommentContent("");
  };
  
  const handleCommentVote = async (commentId: number, voteType: "like" | "dislike") => {
    const formData = new FormData();
    formData.append("postId", postContent?.postId.toString() || "");
    formData.append("commentId", commentId.toString());
    formData.append("voteType", voteType);
    formData.append("action", "voteComment");

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
            postId={postContent?.postId || 0}
            commentContent={comment.commentContent}
            commentDateGmt={comment.commentDateGmt}
            commentAuthor={comment.commentAuthor}
            level={level}
            onCommentVote={handleCommentVote}
            likedComments={likedComments}
            dislikedComments={dislikedComments}
            likesCount={commentVoteData.find((data) => data.commentId === comment.commentId && data.voteType === 1)?._count.commentId || 0}
            dislikesCount={commentVoteData.find((data) => data.commentId === comment.commentId && data.voteType === -1)?._count.commentId || 0}
            isAdmin={isAdmin}
            isCommentOpen={isCommentOpen}
          />
          {renderComments(comment.commentId, level + 1)}
        </div>
      ));
  };

  const handleDeletePost = async () => {
    const formData = new FormData();
    formData.append("postId", postContent?.postId.toString() || "");
    formData.append("action", "deletePost");

    await submit(formData, {
      method: "post",
      action: `/archives/${postContent?.postId}`,
    });
  };

  const isCommentOpen = postContent?.commentStatus === "open";

  const handleCommentStatus = async () => {
    const formData = new FormData();
    formData.append("postId", postContent?.postId.toString() || "");
    formData.append("action", "changeCommentStatus");

    await submit(formData, {
      method: "post",
      action: `/archives/${postContent?.postId}`,
    });
  }

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
    <>
      <div>
        <H1>{postContent && postContent.postTitle}</H1>
        <div>
          <div className="grid grid-cols-[auto_1fr] gap-2 my-1 items-center">
            <div className="w-6 h-6">
              <ClockIcon />
            </div>
            <p>
              <RelativeDate timestamp={postContent?.postDateGmt} />
            </p>
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-2 mb-2 items-center">
            <div className="w-6 h-6">
              <TagIcon />
            </div>
            <div>
              {sortedTagNames && sortedTagNames.map((tag) => (
                <span key={tag.dimTag.tagName} className="inline-block text-sm font-semibold text-gray-500 mr-1">
                  <TagCard tagName={tag.dimTag.tagName} />
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center p-2 rounded">
        <div className="tooltip" data-tip ="この記事を高評価する">
          <button
            className={`flex items-center mr-4 bg-inherit rounded-md px-2 py-2 border ${
              isLikeAnimating ? 'animate-spin' : isLiked ? "text-blue-500 font-bold" : ""
            }`}
            onClick={() => handleVoteOnClient("like")}
            disabled={isPageLikeButtonPushed || isLiked || isLikeAnimating}
          >
            <ThumbsUpIcon />
            <p className="ml-2">
              {postContent?.countLikes}
            </p>
          </button>
        </div>
        <div className="tooltip" data-tip ="この記事を低評価する">
          <button
            className={`flex items-center bg-inherit rounded-md px-2 py-2 border ${
              isDislikeAnimating ? 'animate-spin' : isDisliked ? "text-red-500 font-bold" : ""
            }`}
            onClick={() => handleVoteOnClient("dislike")}
            disabled={isPageDislikeButtonPushed || isDisliked || isDislikeAnimating}
          >
            <ThumbsDownIcon />
            <p className="ml-2">
              {postContent?.countDislikes}
            </p>
          </button>
        </div>
      </div>
        <div className="postContent">
            {postContent && parser(postContent.postContent)}
        </div>
        <div className="my-6">
          <NavLink
            to={`/archives/edit/${postContent?.postId}`}
            className="bg-primary text-white rounded px-4 py-2 mx-1 my-20"
          >
            編集する
          </NavLink>
        </div>
        <H2>関連記事</H2>
        <div>
          <ul className="list-disc list-outside mb-4 ml-4">
            {similarPosts.map((post: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
              <li key={post.post_id} className="my-2">
                <NavLink
                  to={`/archives/${post.post_id}`}
                  className="text-info underline underline-offset-4"
                >
                  {post.post_title}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col md:flex-row justify-between items-center my-20">
          {nextPost ? (
            <div className="flex items-center mb-4 md:mb-0">
              <ArrowForwardIcon />
              <NavLink
                to={`/archives/${nextPost.postId}`}
                className="text-info underline underline-offset-4"
              >
                {nextPost.postTitle}
              </NavLink>
            </div>
          ): (<div></div>)}
          {prevPost ? (
            <div className="flex items-center">
              <NavLink
                to={`/archives/${prevPost.postId}`}
                className="text-info underline underline-offset-4 mr-2"
              >
                {prevPost.postTitle}
              </NavLink>
              <ArrowBackIcon  />
            </div>
          ): <div></div>}
        </div>
        <div className="my-8">
            <ShareButtons
              currentURL={`https://healthy-person-emulator.org/archives/${postContent?.postId}`}
              postTitle={postContent?.postTitle || ""}
            />
        </div>
        <br></br>
        <div className="mb-8">
        <h2 className="text-xl font-bold mb-4">コメントを投稿する</h2>
        <CommentInputBox
          commentAuthor={commentAuthor}
          commentContent={commentContent}
          onCommentAuthorChange={setCommentAuthor}
          onCommentContentChange={setCommentContent}
          onSubmit={handleCommentSubmit}
          isCommentOpen={isCommentOpen}
          commentParentId={0}
        />
      </div>
      <div>
        {renderComments()}
      </div>
      {isAdmin && (
        <div className="my-40">
          <button
            onClick={handleDeletePost}
            className="bg-red-500 text-white rounded px-4 py-2 mx-1 my-1 w-full"
            type="submit"
            name="action"
            value="deletePost"
          >
            記事を削除する
          </button>
          <button
            onClick={handleCommentStatus}
            className="bg-purple-500 text-white rounded px-4 py-2 mx-1 my-1 w-full"
            type="submit"
            name="action"
            value="changeCommentStatus"
          >
            コメントステータスを変更
          </button>

        </div>
        )}
    </div>
  </>
  );
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const action = formData.get("action");
  const postId = Number(formData.get("postId"));
  const ip = getClientIPAddress(request) || "";
  const userIpHashString = await getUserIpHashString(ip);

  switch (action) {
    case "votePost":
      return handleVotePost(formData, postId, userIpHashString, request);
    case "voteComment":
      return handleVoteComment(formData, postId, userIpHashString, request);
    case "submitComment":
      return handleSubmitComment(formData, postId);
    case "deletePost":
      return handleDeletePost(postId, request);
    case "changeCommentStatus":
      return handleChangeCommentStatus(postId, request);
    case "deleteComment":
      return handleDeleteComment(formData, postId, request);
    default:
      return json({ error: "Invalid action" }, { status: 400 });
  }
}

async function getUserIpHashString(ip: string) {
  const userIpHash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(ip)
  );
  const hashArray = Array.from(new Uint8Array(userIpHash));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function handleVotePost(
  formData: FormData,
  postId: number,
  userIpHashString: string,
  request: Request
) {
  const voteType = formData.get("voteType")?.toString();
  if (voteType !== "like" && voteType !== "dislike") {
    return json({ error: "Invalid vote type" }, { status: 400 });
  }

  await prisma.$transaction(async (prisma) => {
    await prisma.fctPostVoteHistory.create({
      data: {
        voteUserIpHash: userIpHashString,
        postId,
        voteTypeInt: voteType === "like" ? 1 : -1,
      },
    });
    const updateData = voteType === "like" 
      ? { countLikes: { increment: 1 } }
      : { countDislikes: { increment: 1 } };
    await prisma.dimPosts.update({
      where: { postId },
      data: updateData,
    });
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

async function handleVoteComment(
  formData: FormData,
  postId: number,
  userIpHashString: string,
  request: Request
) {
  const voteType = formData.get("voteType")?.toString();
  const commentId = Number(formData.get("commentId"));
  await prisma.$transaction(async (prisma) => {
    await prisma.fctCommentVoteHistory.create({
      data: {
        voteUserIpHash: userIpHashString,
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

async function handleSubmitComment(formData: FormData, postId: number) {
  const commentAuthor = formData.get("commentAuthor")?.toString();
  const commentContent = formData.get("commentContent")?.toString() || "";
  const commentParent = Number(formData.get("commentParentId")) || 0;

  try {
    await prisma.dimComments.create({
      data: {
        postId: Number(postId),
        commentAuthor,
        commentContent,
        commentParent
      },
    });
    return json({ success: true });
  }
  catch (e) {
    console.error(e);
    return json({ error: "Internal Server Error" }, { status: 500 });
  }
}

async function handleDeletePost(postId: number, request: Request) {
  const isAdmin = await isAdminLogin(request);
  if (!isAdmin) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    await prisma.dimPosts.delete({ where: { postId } });
    return redirect("/");
  } catch (e) {
    console.error(e);
    return json({ error: "Internal Server Error" }, { status: 500 });
  }
}

async function handleChangeCommentStatus(postId: number, request: Request) {
  const isAdmin = await isAdminLogin(request);
  if (!isAdmin) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const nowCommentStatus = await prisma.dimPosts.findFirst({
      where: { postId },
      select: { commentStatus: true },
    });
    if (!nowCommentStatus) {
      return new Response("Not Found", { status: 404 });
    }
    const newCommentStatus = nowCommentStatus.commentStatus === "open" ? "closed" : "open";
    await prisma.dimPosts.update({
      where: { postId },
      data: { commentStatus: newCommentStatus },
    });
    return json({ success: true });
  } catch (e) {
    console.error(e);
    return json({ error: "Internal Server Error" }, { status: 500 });
  }
}

async function handleDeleteComment(formData: FormData, postId: number, request: Request) {
  const isAdmin = await isAdminLogin(request);
  if (!isAdmin) {
    return new Response("Unauthorized", { status: 401 });
  }
  const commentId = Number(formData.get("commentId"));

  try {
    await prisma.dimComments.update({
      where: { commentId },
      data: { commentContent: "(このコメントは管理者により削除されました)" },
    });
    return json({ success: true });
  } catch (e) {
    console.error(e);
    return new Response("Internal Server Error", { status: 500 });
  }
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data){
    return [{ title: "Loading..." }];
  }
  const title = data.postContent?.postTitle || "";
  const description = data.tagNames?.join(", ") || "";
  const ogLocale = "ja_JP";
  const ogSiteName = "健常者エミュレータ事例集";
  const ogType = "article";
  const ogTitle = title;
  const ogDescription = description;
  const ogUrl = `https://healthy-person-emulator.org/archives/${data.postContent?.postId}`;
  const twitterCard = "summary_large_image"
  const twitterSite = "@helthypersonemu"
  const twitterTitle = title
  const twitterDescription = description
  const twitterCreator = "@helthypersonemu"
  const twitterImage = data.postContent?.ogpImageUrl || "https://qc5axegmnv2rtzzi.public.blob.vercel-storage.com/favicon-CvNSnEUuNa4esEDkKMIefPO7B1pnip.png"

  return [
    { title },
    { description },
    { property: "og:title", content: ogTitle },
    { property: "og:description", content: ogDescription },
    { property: "og:locale", content: ogLocale },
    { property: "og:site_name", content: ogSiteName },
    { property: "og:type", content: ogType },
    { property: "og:url", content: ogUrl },
    { property: "og:image", content: twitterImage},
    { name: "twitter:card", content: twitterCard },
    { name: "twitter:site", content: twitterSite },
    { name: "twitter:title", content: twitterTitle },
    { name: "twitter:description", content: twitterDescription },
    { name: "twitter:creator", content: twitterCreator },
    { name: "twitter:image", content: twitterImage },
  ];
};
