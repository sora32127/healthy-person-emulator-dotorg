import { LoaderFunctionArgs, json, redirect, ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSearchParams, Form } from "@remix-run/react";
import { prisma } from "~/modules/db.server";
import PostCard from "~/components/PostCard";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const pagingNumber = parseInt(url.searchParams.get("p") || "1");

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

  const postData = mostRecentPosts.map((post) => {
    const tagNames = allTagNames
      .filter((tag) => tag.postId === post.postId)
      .map((tag) => tag.tagName);
    return { ...post, tagNames };
  });

  return json({ mostRecentPosts: postData, currentPage: pagingNumber });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const action = formData.get("action");
  const currentPage = parseInt(formData.get("currentPage") as string);

  if (action === "prevPage") {
    return redirect(`/feed?p=${currentPage - 1}`);
  } else if (action === "nextPage") {
    return redirect(`/feed?p=${currentPage + 1}`);
  }
  return null;
}

export default function Feed() {
  const { mostRecentPosts, currentPage } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();

  return (
    <div>
      <h1>Feed</h1>
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
