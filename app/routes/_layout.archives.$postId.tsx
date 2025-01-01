import { json } from "@remix-run/node";
import { useLoaderData, NavLink,useFetcher } from "@remix-run/react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import type { MetaFunction } from "@remix-run/react";
import parser from "html-react-parser";
import { Turnstile } from "@marsidev/react-turnstile";
import { prisma, ArchiveDataEntry } from "~/modules/db.server";
import CommentCard from "~/components/CommentCard";
import TagCard from "~/components/TagCard";
import { useEffect, useState } from "react";
import { commitSession, getSession, getUserActivityData, isUserValid } from "~/modules/session.server";
import { H1, H2 } from "~/components/Headings";
import CommentInputBox, { type CommentFormInputs } from "~/components/CommentInputBox";
import ShareButtons from "~/components/ShareButtons";
import ArrowBackIcon from "~/components/icons/ArrowBackIcon";
import ClockIcon from "~/components/icons/ClockIcon";
import TagIcon from "~/components/icons/TagIcon";
import ArrowForwardIcon from "~/components/icons/ArrowForwardIcon";
import RelativeDate from "~/components/RelativeDate";
import { commonMetaFunction } from "~/utils/commonMetafunction";
import { getHashedUserIPAddress, getTurnStileSiteKey, validateRequest } from "~/modules/security.server";
import { z } from "zod";
import { UserWarningMessage } from "~/components/UserWarningMessage";
import { TurnstileModal } from "~/components/TurnstileModal";
import toast, { Toaster } from "react-hot-toast";
import { VoteButton } from "~/components/VoteButton";
import { SNSLinks } from "~/components/SNSLinks";

export const commentVoteSchema = z.object({
  commentId: z.number(),
  voteType: z.enum(["like", "dislike"]),
});
export type CommentVoteSchema = z.infer<typeof commentVoteSchema>;

export const postVoteSchema = z.object({
  voteType: z.enum(["like", "dislike"]),
});
export type PostVoteSchema = z.infer<typeof postVoteSchema>;


export async function loader({ request }:LoaderFunctionArgs){
    const url = new URL(request.url);
    const postId = Number(url.pathname.split("/")[2]);
    const data = await ArchiveDataEntry.getData(postId);
    const { likedPages, dislikedPages, likedComments, dislikedComments } = await getUserActivityData(request);
    const CF_TURNSTILE_SITEKEY = await getTurnStileSiteKey();

    return json({ data, likedPages, dislikedPages, likedComments, dislikedComments, CF_TURNSTILE_SITEKEY });
}

export default function Component() {
  const { data, likedPages, dislikedPages, likedComments, dislikedComments, CF_TURNSTILE_SITEKEY } = useLoaderData<typeof loader>();
  const [isPageLikeButtonPushed, setIsPageLikeButtonPushed] = useState(false);
  const [isPageDislikeButtonPushed, setIsPageDislikeButtonPushed] = useState(false);
  const [isLikeAnimating, setIsLikeAnimating] = useState(false);
  const [isDislikeAnimating, setIsDislikeAnimating] = useState(false);

  const POSTID = data.postId;
  const isLiked = likedPages.includes(POSTID);
  const isDisliked = dislikedPages.includes(POSTID);

  // URLが変わってほしいわけではないので、以降のハンドラではfetcherを使用する
  // https://remix.run/docs/ja/main/discussion/form-vs-fetcher
  
  const postVoteFetcher = useFetcher();
  const handlePostVote = async (data: PostVoteSchema) => {
    setIsValificationFailed(false);
    const voteType = data.voteType;
    const formData = new FormData();

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

    formData.append("postId", POSTID.toString() || "");
    formData.append("action", "votePost");
    formData.append("voteType", voteType);
    postVoteFetcher.submit(formData, {
      method: "post",
      action: `/archives/${POSTID}`,
    });
    
    setIsPageLikeButtonPushed(false);
    setIsPageDislikeButtonPushed(false);
  };
  
  useEffect(() => {
    const data = postVoteFetcher.data as { success: boolean; message: string } | null;
    if (data?.success === true && data.message) {
      toast.success(data.message);
    }
    if (data?.success === false && data.message) {
      toast.error(data.message);
    }
  }, [postVoteFetcher.data]);

  const commentSubmitFetcher = useFetcher();
  const handleCommentSubmit = async (data: CommentFormInputs) => {
    setIsValificationFailed(false);
    const formData = new FormData();
    if (POSTID === undefined) {
      throw new Error("postId is required");
    }
    formData.append("action", "submitComment");
    formData.append("postId", POSTID.toString());
    formData.append("commentParentId", data.commentParentId?.toString() ?? "0");
    for (const [key, value] of Object.entries(data)) {
      formData.append(key, String(value));
    }

    commentSubmitFetcher.submit(formData, {
      method: "post",
      action: `/archives/${POSTID}`,
    });
  };
  
  const commentVoteFetcher = useFetcher();
  const handleCommentVote = async (data: CommentVoteSchema) => {
    const formData = new FormData();
    formData.append("postId", POSTID.toString() || "");
    formData.append("action", "voteComment");
    
    for (const [key, value] of Object.entries(data)) {
      formData.append(key, String(value));
    }

    commentVoteFetcher.submit(formData, {
        method: "post",
        action: `/archives/${POSTID}`,
    });
  };

  const isCommentOpen = data.commentStatus === "open";

  const renderComments = (parentId = 0, level = 0) => {
    return data.comments
      .filter((comment) => comment.commentParent === parentId)
      .map((comment) => (
        <div key={comment.commentId} id={`comment-${comment.commentId}`}>
          <CommentCard
            commentId={comment.commentId}
            postId={POSTID}
            commentContent={comment.commentContent}
            commentDateGmt={comment.commentDateGmt}
            commentAuthor={comment.commentAuthor}
            level={level}
            onCommentVote={handleCommentVote}
            onCommentSubmit={handleCommentSubmit}
            likedComments={likedComments}
            dislikedComments={dislikedComments}
            likesCount={comment.likesCount}
            dislikesCount={comment.dislikesCount}
            isCommentOpen={isCommentOpen}
            postTitle={data.postTitle}
          />
          {renderComments(comment.commentId, level + 1)}
        </div>
      ));
  };

  const turnstileFetcher = useFetcher();
  const handleTurnstileSuccess = async (token: string) => {
    const formData = new FormData();
    formData.append("token", token);
    formData.append("action", "setTurnstileToken");
    turnstileFetcher.submit(formData, {
      method: "post",
      action: `/archives/${POSTID}`,
    });
  }

  const [showTurnstileModal, setShowTurnstileModal] = useState(false);
  const [isValificationFailed, setIsValificationFailed] = useState(false);

  useEffect(() => {
    if ((turnstileFetcher.data as { error: string })?.error === "INVALID_USER" && isValificationFailed === false) {
      setShowTurnstileModal(true);
      setIsValificationFailed(true);
    }
  }, [turnstileFetcher.data, isValificationFailed]);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const commentId = hash.replace("#comment-", "");
      const commentElement = document.getElementById(`comment-${commentId}`);
      if (commentElement) {
        commentElement.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, []);
  // コメントIDをURLに含めると、そのコメントにスクロールするための機能
  // http://localhost:3000/archives/46783#comment-32944

  return (
    <>
      <div className="overflow-x-hidden max-w-full">
        <Toaster />
        <TurnstileModal
          isOpen={showTurnstileModal}
          onClose={() => setShowTurnstileModal(false)}
          siteKey={CF_TURNSTILE_SITEKEY}
          onSuccess={handleTurnstileSuccess}
        />
        <Turnstile
          siteKey={CF_TURNSTILE_SITEKEY}
          onSuccess={handleTurnstileSuccess}
          options={{ size: "invisible" }}
        />
        <div className="px-4">
          <UserWarningMessage isWelcomed={data.isWelcomed ?? true} isWelcomedExplanation={data.isWelcomedExplanation ?? ''} />
        </div>
        <div>
          <H1>{data.postTitle}</H1>
        </div>
        <div>
          <div className="flex items-start gap-2 my-1">
            <div className="w-6 h-6"><ClockIcon /></div>
            <RelativeDate timestamp={data.postDateGmt} />
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-2 mb-2 items-center">
            <div className="w-6 h-6">
              <TagIcon />
            </div>
            <div className="flex flex-wrap gap-y-3 my-2">
              {data.tags?.map((tag) => (
                <span key={tag.tagName} className="inline-block text-sm font-semibold text-gray-500 mr-1">
                  <TagCard tagName={tag.tagName} />
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="postContent">
            {parser(data.postContent)}
        </div>
        <div className="flex justify">
          <div className="flex items-center p-2 rounded">
            <VoteButton
              type="like"
              count={data.countLikes}
              isAnimating={isLikeAnimating}
              isVoted={isLiked}
              disabled={isPageLikeButtonPushed || isLiked || isLikeAnimating}
              onClick={() => handlePostVote({ voteType: "like" })}
            />
            <VoteButton
              type="dislike"
              count={data.countDislikes}
              isAnimating={isDislikeAnimating}
              isVoted={isDisliked}
              disabled={isPageDislikeButtonPushed || isDisliked || isDislikeAnimating}
              onClick={() => handlePostVote({ voteType: "dislike" })}
            />
          </div>
      </div>
        <div className="my-6">
          <NavLink
            to={`/archives/edit/${POSTID}`}
            className="btn-primary rounded px-4 py-2 mx-1 my-20"
          >
            編集する
          </NavLink>
        </div>
        <H2>関連記事</H2>
        <div>
          <ul className="list-disc list-outside mb-4 ml-4">
            {data.similarPosts.map((post) => (
              <li key={post.postId} className="my-2">
                <NavLink
                  to={`/archives/${post.postId}`}
                  className="text-info underline underline-offset-4"
                >
                  {post.postTitle}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col md:flex-row justify-between items-center my-20">
          {data.nextPost ? (
            <div className="flex items-center mb-4 md:mb-0">
              <ArrowForwardIcon />
              <NavLink
                to={`/archives/${data.nextPost.postId}`}
                className="text-info underline underline-offset-4"
              >
                {data.nextPost.postTitle}
              </NavLink>
            </div>
          ): (<div/>)}
          {data.previousPost ? (
            <div className="flex items-center">
              <NavLink
                to={`/archives/${data.previousPost.postId}`}
                className="text-info underline underline-offset-4 mr-2"
              >
                {data.previousPost.postTitle}
              </NavLink>
              <ArrowBackIcon  />
            </div>
          ): <div/>}
        </div>
        <div className="my-8">
            <ShareButtons
              currentURL={data.postURL}
              postTitle={data.postTitle}
            />
        </div>
        <div>
          <SNSLinks
            tweetIdOfFirstTweet={data.tweetIdOfFirstTweet}
            blueskyPostUriOfFirstPost={data.blueskyPostUriOfFirstPost}
            misskeyNoteIdOfFirstNote={data.misskeyNoteIdOfFirstNote}
          />
        </div>
        <br/>
        <div className="mb-8">
        <h2 className="text-xl font-bold mb-4">コメントを投稿する</h2>
        <CommentInputBox
          onSubmit={handleCommentSubmit}
          isCommentOpen={isCommentOpen}
          commentParentId={0}
        />
      </div>
      <div>
        {renderComments()}
      </div>
    </div>
  </>
  );
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const action = formData.get("action");
  const postId = Number(formData.get("postId"));
  const ipAddress = await getHashedUserIPAddress(request);
  const userIpHashString = await getHashedUserIPAddress(request);
  const isValidUser = await isUserValid(request);
  console.log("isValidUser is : ", isValidUser);
  console.log("action is : ", action);
  if (!isValidUser && action !== "setTurnstileToken") {
    console.log("Invalid User has been detected, action is : ", action);
    return json(
      { 
        error: "INVALID_USER",
        message: "ユーザー認証が必要です",
        requiresUserValidation: true 
      },
      { status: 401 }
    );
  }
  switch (action) {
    case "setTurnstileToken":
      return handleSetTurnstileToken(formData, request, ipAddress);
    case "votePost":
      return handleVotePost(formData, postId, userIpHashString, request);
    case "voteComment":
      return handleVoteComment(formData, postId, userIpHashString, request);
    case "submitComment":
      return handleSubmitComment(formData, postId, userIpHashString);
    default:
      return json({ error: "Invalid action" }, { status: 400 });
  }
}

async function handleSetTurnstileToken(formData: FormData, request: Request, ipAddress: string) {
  const token = formData.get("token")?.toString() || "";
  const isValidRequest = await validateRequest(token, ipAddress);
  if (!isValidRequest) {
    console.log("User validation failed");
    return json({ message: "ユーザー検証に失敗しました", success: false }, { status: 400 });
  }
  const session = await getSession(request.headers.get("Cookie"));
  session.set("isValidUser", true);
  console.log("User validation succeeded");
  return json(
    { message: "ユーザー検証が完了しました", success: true },
    {
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    }
  );
}


async function handleVotePost(
  formData: FormData,
  postId: number,
  userIpHashString: string,
  request: Request
) {
  try {
    const voteType = formData.get("voteType")?.toString();
    if (voteType !== "like" && voteType !== "dislike") {
      return json({ message: "Invalid vote type", success: false }, { status: 400 });
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
      { message: "投稿を評価しました", success: true },
      {
        headers: {
          "Set-Cookie": await commitSession(session),
        },
      }
    );
  } catch (error) {
    console.error(error);
    return json({ message: "Internal Server Error", success: false }, { status: 500 });
  }
}

async function handleVoteComment(
  formData: FormData,
  postId: number,
  userIpHashString: string,
  request: Request
) {
  try {
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
      { message: "コメントを評価しました", success: true },
      {
        headers: {
          "Set-Cookie": await commitSession(session),
        },
      }
    );
  } catch (error) {
    console.error(error);
    return json({ message: "Internal Server Error", success: false }, { status: 500 });
  }
}

async function handleSubmitComment(formData: FormData, postId: number, userIpHashString: string) {
  try {
    const commentAuthor = formData.get("commentAuthor")?.toString();
    const commentContent = formData.get("commentContent")?.toString() || "";
    const commentParent = Number(formData.get("commentParentId")) || 0;
    await prisma.dimComments.create({
      data: {
        postId: Number(postId),
        commentAuthor,
        commentContent,
        commentParent,
        commentAuthorIpHash: userIpHashString
      },
    });
    return json({ message: "コメントを投稿しました", success: true });
  }
  catch (e) {
    console.error(e);
    return json({ message: "Internal Server Error", success: false }, { status: 500 });
  }
}


export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data){
    return [{ title: "Loading..." }];
  }
  const title = data.data.postTitle;
  const postDescription = data.data.tags.map((tag) => tag.tagName).join(", ");
  const url = `https://healthy-person-emulator.org/archives/${data.data.postId}`;
  const image = data.data.ogpImageUrl;

  const commonMeta = commonMetaFunction({
    title,
    description: postDescription,
    url,
    image
  });

  return commonMeta;
};
