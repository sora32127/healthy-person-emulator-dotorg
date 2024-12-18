import { json } from "@remix-run/node";
import { useLoaderData, NavLink, useSubmit, useFetcher, useNavigate, Form } from "@remix-run/react";
import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import parser from "html-react-parser";
import { getClientIPAddress } from "remix-utils/get-client-ip-address";
import { Turnstile } from "@marsidev/react-turnstile";
import { prisma, ArchiveDataEntry } from "~/modules/db.server";
import CommentCard from "~/components/CommentCard";
import TagCard from "~/components/TagCard";
import { useState } from "react";
import { commitSession, getSession, getUserActivityData } from "~/modules/session.server";
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
import { commonMetaFunction } from "~/utils/commonMetafunction";
import { validateRequest } from "~/modules/security.server";

export async function loader({ request }:LoaderFunctionArgs){
    const url = new URL(request.url);
    const postId = Number(url.pathname.split("/")[2]);
    const data = await ArchiveDataEntry.getData(postId);
    const { likedPages, dislikedPages, likedComments, dislikedComments } = await getUserActivityData(request);

    const CF_TURNSTILE_SITEKEY = process.env.CF_TURNSTILE_SITEKEY

    return json({ data, likedPages, dislikedPages, likedComments, dislikedComments, CF_TURNSTILE_SITEKEY });
}

export default function Component() {
  const { data, likedPages, dislikedPages, likedComments, dislikedComments, CF_TURNSTILE_SITEKEY } = useLoaderData<typeof loader>();
  const [commentAuthor, setCommentAuthor] = useState("Anonymous");
  const [commentContent, setCommentContent] = useState("");
  const [isPageLikeButtonPushed, setIsPageLikeButtonPushed] = useState(false);
  const [isPageDislikeButtonPushed, setIsPageDislikeButtonPushed] = useState(false);
  const [isLikeAnimating, setIsLikeAnimating] = useState(false);
  const [isDislikeAnimating, setIsDislikeAnimating] = useState(false);
  const [isValidUser, setIsValidUser] = useState(false);

  const submit = useSubmit();
  const fetcher = useFetcher();
  const navigate = useNavigate();

  const isLiked = likedPages.includes(data.postId);
  const isDisliked = dislikedPages.includes(data.postId);

  if (!CF_TURNSTILE_SITEKEY){
    return navigate("/")
  }

  const handleVoteSubmit = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const button = event.currentTarget;
    const voteType = button.value as "like" | "dislike";
    const form = button.closest('form') as HTMLFormElement;
    const formData = new FormData(form);
    const cfTurnstileResponse = formData.get("cf-turnstile-response") as string;

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

    formData.append("postId", data.postId.toString() || "");
    formData.append("action", "votePost");
    formData.append("cf-turnstile-response", cfTurnstileResponse);
    formData.append("voteType", voteType);

    fetcher.submit(formData, {
      method: "post",
      action: `/archives/${data.postId}`,
    });
  };


  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append("postId", data.postId.toString() || "");
    formData.append("commentAuthor", commentAuthor);
    formData.append("commentContent", commentContent);
    formData.append("action", "submitComment")

    await submit(formData, {
      method: "post",
      action: `/archives/${data.postId}`,
    });

    setCommentAuthor("Anonymous");
    setCommentContent("");
  };
  
  const handleCommentVote = async (commentId: number, voteType: "like" | "dislike") => {
    const formData = new FormData();
    formData.append("postId", data.postId.toString() || "");
    formData.append("commentId", commentId.toString());
    formData.append("voteType", voteType);
    formData.append("action", "voteComment");

    fetcher.submit(formData, {
        method: "post",
        action: `/archives/${data.postId}`,
    });
  };

  const isCommentOpen = data.commentStatus === "open";

  const renderComments = (parentId = 0, level = 0) => {
    return data.comments
      .filter((comment) => comment.commentParent === parentId)
      .map((comment) => (
        <div key={comment.commentId}>
          <CommentCard
            commentId={comment.commentId}
            postId={data.postId}
            commentContent={comment.commentContent}
            commentDateGmt={comment.commentDateGmt}
            commentAuthor={comment.commentAuthor}
            level={level}
            onCommentVote={handleCommentVote}
            likedComments={likedComments}
            dislikedComments={dislikedComments}
            likesCount={comment.likesCount}
            dislikesCount={comment.dislikesCount}
            isCommentOpen={isCommentOpen}
          />
          {renderComments(comment.commentId, level + 1)}
        </div>
      ));
  };

  const sortedTagNames = data.tags.sort((a, b) => {
    if (a.tagName > b.tagName) {
      return 1;
    }
    if (a.tagName < b.tagName) {
      return -1;
    }
    return 0;
  })

  const VoteButton = ({ type, count, isAnimating, isVoted, disabled, onClick }: { type: "like" | "dislike", count: number, isAnimating: boolean, isVoted: boolean, disabled: boolean, onClick: (event: React.MouseEvent<HTMLButtonElement>) => void }) => (
    <div className="tooltip" data-tip={`この記事を${type === 'like' ? '高' : '低'}評価する`}>
      <button
        type="submit"
        name="voteType"
        value={type}
        className={`flex items-center rounded-md px-2 py-2 mx-1 transition-all duration-500 ${
          !isValidUser
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed relative'
            : isAnimating
            ? 'animate-voteSpin bg-base-300'
            : isVoted
            ? `text-${type === 'like' ? 'blue' : 'red'}-500 font-bold bg-base-300`
            : 'bg-base-300 hover:bg-base-200'
        }`}
        disabled={disabled}
        onClick={onClick}
      >
        {!isValidUser && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-500"/>
          </div>
        )}
        {type === 'like' ? <ThumbsUpIcon /> : <ThumbsDownIcon />}
        <p className="ml-2">
          {count}
        </p>
      </button>
    </div>
  );

  return (
    <>
      <div>
        <H1>{data.postTitle}</H1>
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
              {sortedTagNames?.map((tag) => (
                <span key={tag.tagName} className="inline-block text-sm font-semibold text-gray-500 mr-1">
                  <TagCard tagName={tag.tagName} />
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify">
        <Form method="post" className="flex items-center p-2 rounded">
          <input type="hidden" name="postId" value={data.postId.toString() || ""} />
          <input type="hidden" name="action" value="votePost" />
          <Turnstile
            siteKey={CF_TURNSTILE_SITEKEY}
            options={{"size":"invisible"}}
            onSuccess={() => setIsValidUser(true)}
          />
          <VoteButton
            type="like"
            count={data.countLikes}
            isAnimating={isLikeAnimating}
            isVoted={isLiked}
            disabled={isPageLikeButtonPushed || isLiked || isLikeAnimating || !isValidUser}
            onClick={handleVoteSubmit}
          />
          <VoteButton
            type="dislike"
            count={data.countDislikes}
            isAnimating={isDislikeAnimating}
            isVoted={isDisliked}
            disabled={isPageDislikeButtonPushed || isDisliked || isDislikeAnimating || !isValidUser}
            onClick={handleVoteSubmit}
          />
        </Form>
      </div>
        <div className="postContent">
            {parser(data.postContent)}
        </div>
        <div className="my-6">
          <NavLink
            to={`/archives/edit/${data.postId}`}
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
        <br/>
        <div className="mb-8">
        <h2 className="text-xl font-bold mb-4">コメントを投稿する</h2>
        <CommentInputBox
          commentAuthor={commentAuthor}
          commentContent={commentContent}
          onSubmit={handleCommentSubmit}
          isCommentOpen={isCommentOpen}
          commentParentId={0}
          CF_TURNSTILE_SITE_KEY={CF_TURNSTILE_SITEKEY}
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
  const token = formData.get("cf-turnstile-response") as string;

  const url = new URL(request.url);
  const origin = url.origin;

  const ip = getClientIPAddress(request) || "";
  const userIpHashString = await getUserIpHashString(ip);

  switch (action) {
    case "votePost":
      {
        const isValidRequest = await validateRequest(token, origin);
        if (!isValidRequest) {
        return json({ success: false, message : "Invalid Request" });
      }
      return handleVotePost(formData, postId, userIpHashString, request);
    }
    case "voteComment":
      return handleVoteComment(formData, postId, userIpHashString, request);
    case "submitComment":
      return handleSubmitComment(formData, postId);
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


export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data){
    return [{ title: "Loading..." }];
  }
  const title = data.data.postTitle;
  const description = data.data.tags.map((tag) => tag.tagName).join(", ");
  const url = `https://healthy-person-emulator.org/archives/${data.data.postId}`;
  const image = data.data.ogpImageUrl;

  const commonMeta = commonMetaFunction({
    title,
    description,
    url,
    image
  });

  return commonMeta;
};
