import { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction, json } from "@remix-run/node";
import { useLoaderData, NavLink, useSubmit, useFetcher } from "@remix-run/react";
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
import { commitSession, getSession, isAdminLogin } from "~/modules/session.server";
import { supabase } from "~/modules/supabase.server";
import { H1, H2 } from "~/components/Headings";
import arrowForwardIcon from "~/src/assets/arrow_forward.svg";
import arrowBackIcon from "~/src/assets/arrow_back.svg";
import CommentInputBox from "~/components/CommentInputBox";
import ShareButtons from "~/components/ShareButtons";


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
        postDateGmt: { lt: postContent?.postDateGmt },
      },
      orderBy: {
        postDateGmt: "desc",
      },
    });
    
    const nextPost = await prisma.dimPosts.findFirst({
      where: {
        postDateGmt: { gt: postContent?.postDateGmt },
      },
      orderBy: {
        postDateGmt: "asc",
      },
    });

    const isAdmin = await isAdminLogin(request);
    const tagNames = postContent.rel_post_tags.map((rel) => rel.dimTag.tagName); // MetaFuctionで使用するため、ここで定義

    return json({ postContent, comments, commentVoteData, likedPages, dislikedPages, likedComments, dislikedComments, similarPosts, prevPost, nextPost, isAdmin, tagNames });
}

export default function Component() {
  const { postContent, comments, likedPages, dislikedPages, commentVoteData, likedComments, dislikedComments, similarPosts, prevPost, nextPost, isAdmin } = useLoaderData<typeof loader>();

  const [commentAuthor, setCommentAuthor] = useState("Anonymous");
  const [commentContent, setCommentContent] = useState("");

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

    await submit(formData, {
      method: "post",
      action: `/api/create/comment`,
    });

    setCommentAuthor("Anonymous");
    setCommentContent("");
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

    await submit(formData, {
      method: "post",
      action: "/api/delete/post",
    });
  };

  const isCommentOpen = postContent?.commentStatus === "open";

  const handleCommentStatus = async () => {
    const formData = new FormData();
    formData.append("postId", postContent?.postId.toString() || "");

    await submit(formData, {
      method: "post",
      action: `/api/update/commentstatus`,
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
      <div>
        <H1>{postContent && postContent.postTitle}</H1>
        {isAdmin && (
        <div className="my-6">
          <button
            onClick={handleDeletePost}
            className="bg-red-500 text-white rounded px-4 py-2 mx-1 my-1 w-full"
          >
            記事を削除する
          </button>
          <button
            onClick={handleCommentStatus}
            className="bg-purple-500 text-white rounded px-4 py-2 mx-1 my-1 w-full"
          >
            コメントステータスを変更
          </button>

        </div>
        )}
        <p className="flex my-1">
            <img src={clockIcon} alt="Post date" className="h-5 w-5 mr-2 mt-0.5" />
            {postContent && new Date(postContent.postDateGmt).toLocaleString("ja-JP", {
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
            {similarPosts.map((post: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
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
        <div className="my-6">
          <NavLink
            to={`/archives/edit/${postContent?.postId}`}
            className="bg-blue-500 text-white rounded px-4 py-2 mx-1 my-20"
          >
            編集する
          </NavLink>
        </div>
        <div className="my-4">
        <ShareButtons />
        </div>
        <div className="mb-8">
        <h2 className="text-xl font-bold mb-4">コメントを投稿する</h2>
        <CommentInputBox
          commentAuthor={commentAuthor}
          commentContent={commentContent}
          onCommentAuthorChange={setCommentAuthor}
          onCommentContentChange={setCommentContent}
          onSubmit={handleCommentSubmit}
          isCommentOpen={isCommentOpen}
        />
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

  if (commentId) {
    await prisma.$transaction(async (prisma) => {
        await prisma.fctCommentVoteHisotry.create({
            data: {
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

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data){
    return { title: "Loading..." };
  }
  const title = data.postContent?.postTitle || "";
  const description = data.tagNames?.join(", ") || "";
  const ogLocale = "ja_JP";
  const ogSiteName = "健常者エミュレータ事例集";
  const ogType = "article";
  const ogTitle = title;
  const ogDescription = description;
  const ogUrl = `https://healthy-person-emulator.org/archives/${data.postContent?.postId}`;
  const twitterCard = "summary"
  const twitterSite = "@helthypersonemu"
  const twitterTitle = title
  const twitterDescription = description
  const twitterCreator = "@helthypersonemu"
  const twitterImage = "https://qc5axegmnv2rtzzi.public.blob.vercel-storage.com/favicon-CvNSnEUuNa4esEDkKMIefPO7B1pnip.png"

  return [
    { title },
    { description },
    { property: "og:title", content: ogTitle },
    { property: "og:description", content: ogDescription },
    { property: "og:locale", content: ogLocale },
    { property: "og:site_name", content: ogSiteName },
    { property: "og:type", content: ogType },
    { property: "og:url", content: ogUrl },
    { name: "twitter:card", content: twitterCard },
    { name: "twitter:site", content: twitterSite },
    { name: "twitter:title", content: twitterTitle },
    { name: "twitter:description", content: twitterDescription },
    { name: "twitter:creator", content: twitterCreator },
    { name: "twitter:image", content: twitterImage },
  ];
};
