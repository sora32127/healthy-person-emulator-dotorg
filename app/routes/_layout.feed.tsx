import { Form, useLoaderData } from "@remix-run/react";
import { H1 } from "~/components/Headings";
import { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction, json, redirect } from "@remix-run/node";
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

    const recentVotedPostsRaw = await prisma.dimPosts.findMany({
        where: { postId: { in: recentVotedPostsAgg.map((post) => post.postId) } },
        select: {
            postId: true,
            postTitle: true,
            postDateGmt: true,
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

    postData = recentVotedPostsRaw.map((post) => {
        const tagNames = post.rel_post_tags.map((rel) => rel.dimTag.tagName);
        return { ...post, tagNames };
    });

    const voteData = await prisma.fctPostVoteHisotry.findMany({
        where: {
            voteDateGmt: {
            gte: gteDate,
            lte: lteDate,
            },
            voteTypeInt: { in: [1] },
        },
        select: {
            postId: true,
        },
    });

    totalCount = new Set(voteData.map((post) => post.postId)).size;
  }
  else {
    const mostRecentPosts = await prisma.dimPosts.findMany({
        orderBy: { postDateGmt: "desc" },
        skip: (pagingNumber - 1) * 10,
        take: 10,
        select: {
          postId: true,
          postTitle: true,
          postDateGmt: true,
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
          }
      });

      postData = mostRecentPosts.map((post) => {
          const tagNames = post.rel_post_tags.map((rel) => rel.dimTag.tagName);
          return { ...post, tagNames };
      })

      totalCount = await prisma.dimPosts.count();
  }
  
  return json({ 
    posts: postData, 
    currentPage: pagingNumber,
    totalCount,
    likeFromHour,
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
  const { posts, currentPage, totalCount, likeFromHour } = useLoaderData<typeof loader>();
  const totalPages = Math.ceil(totalCount / 10);

  return (
    <div>
      <H1>フィード</H1>
      <div className="feed-type-select">
        <Form method="post" className="mb-4">
          <div className="flex items-center">
            <button
              type="submit"
              name="action"
              value="sortByNew"
              className={`px-4 py-2 mr-2 ${
                !likeFromHour
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
                likeFromHour
                  ? "bg-blue-500 text-white"
                  : "bg-white text-blue-500 border border-blue-500"
              } rounded`}
            >
              いいね順
            </button>
          </div>
        </Form>
      </div>
      <div className="feed-posts">
      {posts.map((post) => (
        <PostCard
          key={post.postId}
          postId={post.postId}
          postTitle={post.postTitle}
          postDateGmt={post.postDateGmt}
          tagNames={post.tagNames}
          countLikes={post.countLikes}
          countDislikes={post.countDislikes}
        />
      ))}
      </div>
      <div className="flex justify-center mt-8 feed-navigation">
        <Form method="post" className="flex items-center">
          <input type="hidden" name="currentPage" value={currentPage} />
          <input type="hidden" name="totalPages" value={totalPages} />
          <button
            type="submit"
            name="action"
            value="firstPage"
            disabled={currentPage === 1}
            className={`px-2 py-2 mx-1 ${
              currentPage === 1
                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                : "bg-blue-500 text-white"
            } rounded feed-goto-first-page`}
          >
            最初
          </button>
          <button
            type="submit"
            name="action"
            value="prevPage"
            disabled={currentPage === 1}
            className={`px-2 py-2 mx-1 ${
              currentPage === 1
                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                : "bg-blue-500 text-white"
            } rounded feed-goto-back-page`}
          >
            前へ
          </button>
          <span className="px-2 py-2 mx-1 bg-white text-blue-500 rounded">
            {currentPage} / {totalPages}
          </span>
          <button
            type="submit"
            name="action"
            value="nextPage"
            disabled={currentPage === totalPages}
            className={`px-2 py-2 mx-1 ${
              currentPage === totalPages
                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                : "bg-blue-500 text-white"
            } rounded feed-goto-next-page`}
          >
            次へ
          </button>
          <button
            type="submit"
            name="action"
            value="lastPage"
            disabled={currentPage === totalPages}
            className={`px-2 py-2 mx-1 ${
              currentPage === totalPages
                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                : "bg-blue-500 text-white"
            } rounded feed-goto-last-page`}
          >
            最後
          </button>
        </Form>
      </div>
    </div>
  );
}

export const meta: MetaFunction = ({ location }) => {
  if (!location){
    return { title: "Loading..." };
  }
  //https://localhost:5173/feed?likeFrom=24&likeTo=0&p=2

  const searchQuery = new URLSearchParams(location.search);
  const pageNumber = searchQuery.get("p")
  const likeFrom = searchQuery.get("likeFrom")
  const likeTo = searchQuery.get("likeTo")
  
  let title

  if (!likeFrom){
    title = pageNumber ? `フィード - ページ${pageNumber}` : "フィード"
  }else {
    title = `いいね順 - ${likeFrom}時間前～${likeTo}時間前`
  }

  const description = "フィード"

  const ogLocale = "ja_JP";
  const ogSiteName = "健常者エミュレータ事例集";
  const ogType = "article";
  const ogTitle = title;
  const ogDescription = description;
  let ogUrl
  if (likeFrom){
    ogUrl = `https://healthy-person-emulator.org/feed?likeFrom=${likeFrom}&likeTo=${likeTo}&p=${pageNumber}`;
  } else {
    ogUrl = `https://healthy-person-emulator.org/feed?p=${pageNumber}`;
  }

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
