import { LoaderFunctionArgs, json, redirect, ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, Form } from "@remix-run/react";
import { prisma } from "~/modules/db.server";
import PostCard from "~/components/PostCard";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const pagingNumber = parseInt(url.searchParams.get("p") || "1");
  const likeFromHour = url.searchParams.get("likeFrom");
  const likeToHour = url.searchParams.get("likeTo");
  let postData = [];

  if (likeFromHour) {
    const likeFromHourInt = parseInt(likeFromHour);
    const likeToHourInt = parseInt(likeToHour || "0");
    const now = new Date();
    const gteDate = new Date(now.getTime() - likeFromHourInt * 60 * 60 * 1000);
    const lteDate = new Date(now.getTime() - likeToHourInt * 60 * 60 * 1000);

    const recentVotedPostsAgg = await prisma.fctPostVoteHisotry.groupBy({
        by: ["postId"],
        where: {
            voteDateGmt: {
            gte: gteDate,
            lte: lteDate,
            },
            voteTypeInt: { in: [1] },
        },
        _count: { voteUserIpHash: true },
        orderBy: { _count: { voteUserIpHash: "desc" } },
        take: 10,
        skip: (pagingNumber - 1) * 10,
    });

    const recentVotedPosts = await prisma.userPostContent.findMany({
        where: { postId: { in: recentVotedPostsAgg.map((post) => post.postId) } },
        select: {
            postId: true,
            postTitle: true,
            postDateJst: true,
            postUrl: true,
            countLikes: true,
            countDislikes: true,
        },
    });

    const allTagNames = await prisma.dimTags.findMany({
        select: {
            postId: true,
            tagName: true,
        },
        where: { postId: { in: recentVotedPosts.map((post) => post.postId) } },
    });

    postData = recentVotedPosts.map((post) => {
        const tagNames = allTagNames
        .filter((tag) => tag.postId === post.postId)
        .map((tag) => tag.tagName);
        return { ...post, tagNames };
    });
  }
  else {
    const mostRecentPosts = await prisma.userPostContent.findMany({
        orderBy: { postDateJst: "desc" },
        skip: (pagingNumber - 1) * 10,
        take: 10,
        select: {
          postId: true,
          postTitle: true,
          postDateJst: true,
          postUrl: true,
          countLikes: true,
          countDislikes: true,
        },
      });

      const allTagNames = await prisma.dimTags.findMany({
        select: {
          postId: true,
          tagName: true,
        },
        where: { postId: { in: mostRecentPosts.map((post) => post.postId) } },
      });
    
      postData = mostRecentPosts.map((post) => {
        const tagNames = allTagNames
          .filter((tag) => tag.postId === post.postId)
          .map((tag) => tag.tagName);
        return { ...post, tagNames };
      });
  }
  
  return json({ mostRecentPosts: postData, currentPage: pagingNumber });
}

export async function action({ request }: ActionFunctionArgs) {
    const formData = await request.formData();
    const action = formData.get("action");
    const sort = formData.get("sort");
    const currentPage = parseInt(formData.get("currentPage") as string);
    const url = new URL(request.url);
    const likeFrom = url.searchParams.get("likeFrom");
    const likeTo = url.searchParams.get("likeTo");
  
    if (sort === "likes") {
      return redirect(`/feed?p=1&likeFrom=24&likeTo=0`);
    } else if (sort === "new") {
      return redirect(`/feed?p=1`);
    }
  
    if (!likeFrom && action === "prevPage") {
      return redirect(`/feed?p=${currentPage - 1}`);
    } else if (!likeFrom && action === "nextPage") {
      return redirect(`/feed?p=${currentPage + 1}`);
    } else if (likeFrom && action === "prevPage") {
      return redirect(`/feed?likeFrom=${likeFrom}&likeTo=${likeTo}&p=${currentPage - 1}`);
    } else if (likeFrom && action === "nextPage") {
      return redirect(`/feed?likeFrom=${likeFrom}&likeTo=${likeTo}&p=${currentPage + 1}`);
    }
    return null;
}

export default function Feed() {
  const { mostRecentPosts, currentPage } = useLoaderData<typeof loader>();

  return (
    <div>
      <h1>Feed</h1>
      <Form method="post" className="mb-4">
        <div className="flex items-center">
          <label htmlFor="sort-likes" className="mr-2">
            <input
              type="radio"
              id="sort-likes"
              name="sort"
              value="likes"
              className="mr-1"
            />
            いいね順
          </label>
          <label htmlFor="sort-new">
            <input
              type="radio"
              id="sort-new"
              name="sort"
              value="new"
              defaultChecked
              className="mr-1"
            />
            新着順
          </label>
          <button
            type="submit"
            className="ml-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            適用
          </button>
        </div>
      </Form>
      {mostRecentPosts.map((post) => (
        <PostCard
          key={post.postId}
          postId={post.postId}
          postTitle={post.postTitle}
          postDateJst={post.postDateJst}
          postUrl={post.postUrl}
          tagNames={post.tagNames}
          countLikes={post.countLikes}
          countDislikes={post.countDislikes}
        />
      ))}
      <Form method="post" className="flex justify-between mt-4">
        <input type="hidden" name="currentPage" value={currentPage} />
        <button
          type="submit"
          name="action"
          value="prevPage"
          disabled={currentPage === 1}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          前のページ
        </button>
        <button
          type="submit"
          name="action"
          value="nextPage"
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          次のページ
        </button>
      </Form>
    </div>
  );
}
