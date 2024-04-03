import { Form, useLoaderData } from "@remix-run/react";
import { H1 } from "~/components/Headings";
import { ActionFunctionArgs, LoaderFunctionArgs, json, redirect } from "@remix-run/node";
import { prisma } from "~/modules/db.server";
import PostCard from "~/components/PostCard";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const pagingNumber = parseInt(url.searchParams.get("p") || "1");
  const likeFromHour = url.searchParams.get("likeFrom");
  const likeToHour = url.searchParams.get("likeTo");
  let postData = [];
  let totalCount = 0;

  if (likeFromHour) {
    const likeFromHourInt = parseInt(likeFromHour);
    const likeToHourInt = parseInt(likeToHour || "0");
    let now;
    if (process.env.NODE_ENV === "development") {
      now = new Date("2024-03-11")
    }
    else{
      now = new Date();
    }

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

    const recentVotedPosts = await prisma.dimPosts.findMany({
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

    totalCount = await prisma.fctPostVoteHisotry.count({
        where: {
            voteDateGmt: {
            gte: gteDate,
            lte: lteDate,
            },
            voteTypeInt: { in: [1] },
        },
    });
  }
  else {
    const mostRecentPosts = await prisma.dimPosts.findMany({
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

      totalCount = await prisma.dimPosts.count();
  }
  
  return json({ 
    posts: postData, 
    currentPage: pagingNumber,
    totalCount,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const action = formData.get("action");
  const currentPage = parseInt(formData.get("currentPage") as string);
  const url = new URL(request.url);
  const likeFrom = url.searchParams.get("likeFrom");
  const likeTo = url.searchParams.get("likeTo");

  if (action === "sortByNew") {
    return redirect(`/feed?p=1`);
  } else if (action === "sortByLikes") {
    return redirect(`/feed?p=1&likeFrom=24&likeTo=0`);
  }

  if (!likeFrom && action === "firstPage") {
    return redirect(`/feed?p=1`);
  } else if (!likeFrom && action === "prevPage") {
    return redirect(`/feed?p=${currentPage - 1}`);
  } else if (!likeFrom && action === "nextPage") {
    return redirect(`/feed?p=${currentPage + 1}`);
  } else if (!likeFrom && action === "lastPage") {
    return redirect(`/feed?p=${formData.get("totalPages")}`);
  } else if (likeFrom && action === "firstPage") {
    return redirect(`/feed?likeFrom=${likeFrom}&likeTo=${likeTo}&p=1`);
  } else if (likeFrom && action === "prevPage") {
    return redirect(`/feed?likeFrom=${likeFrom}&likeTo=${likeTo}&p=${currentPage - 1}`);
  } else if (likeFrom && action === "nextPage") {
    return redirect(`/feed?likeFrom=${likeFrom}&likeTo=${likeTo}&p=${currentPage + 1}`);
  } else if (likeFrom && action === "lastPage") {
    return redirect(`/feed?likeFrom=${likeFrom}&likeTo=${likeTo}&p=${formData.get("totalPages")}`);
  }
  return null;
}

export default function Feed() {
  const { posts, currentPage, totalCount } = useLoaderData<typeof loader>();
  const totalPages = Math.ceil(totalCount / 10);
  const url = new URL(window.location.href);
  const likeFrom = url.searchParams.get("likeFrom");

  return (
    <div>
      <H1>フィード</H1>
      <Form method="post" className="mb-4">
        <div className="flex items-center">
          <button
            type="submit"
            name="action"
            value="sortByNew"
            className={`px-4 py-2 mr-2 ${
              !likeFrom
                ? "bg-blue-500 text-white"
                : "bg-white text-blue-500 border border-blue-500"
            } rounded`}
          >
            新着順
          </button>
          <button
            type="submit"
            name="action"
            value="sortByLikes"
            className={`px-4 py-2 ${
              likeFrom
                ? "bg-blue-500 text-white"
                : "bg-white text-blue-500 border border-blue-500"
            } rounded`}
          >
            いいね順
          </button>
        </div>
      </Form>
      {posts.map((post) => (
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
      <div className="flex justify-center mt-8">
        <Form method="post" className="flex items-center">
          <input type="hidden" name="currentPage" value={currentPage} />
          <input type="hidden" name="totalPages" value={totalPages} />
          <button
            type="submit"
            name="action"
            value="firstPage"
            disabled={currentPage === 1}
            className={`px-4 py-2 mx-1 ${
              currentPage === 1
                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                : "bg-blue-500 text-white"
            } rounded`}
          >
            最初
          </button>
          <button
            type="submit"
            name="action"
            value="prevPage"
            disabled={currentPage === 1}
            className={`px-4 py-2 mx-1 ${
              currentPage === 1
                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                : "bg-blue-500 text-white"
            } rounded`}
          >
            前へ
          </button>
          <span className="px-4 py-2 mx-1 bg-white text-blue-500 rounded">
            {currentPage} / {totalPages}
          </span>
          <button
            type="submit"
            name="action"
            value="nextPage"
            disabled={currentPage === totalPages}
            className={`px-4 py-2 mx-1 ${
              currentPage === totalPages
                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                : "bg-blue-500 text-white"
            } rounded`}
          >
            次へ
          </button>
          <button
            type="submit"
            name="action"
            value="lastPage"
            disabled={currentPage === totalPages}
            className={`px-4 py-2 mx-1 ${
              currentPage === totalPages
                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                : "bg-blue-500 text-white"
            } rounded`}
          >
            最後
          </button>
        </Form>
      </div>
    </div>
  );
}
