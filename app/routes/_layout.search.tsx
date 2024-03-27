import { Form, useLoaderData, useSearchParams } from "@remix-run/react";
import { H1, H2 } from "~/components/Headings";
import { ActionFunctionArgs, LoaderFunctionArgs, json, redirect } from "@remix-run/node";
import { supabase } from "~/modules/supabase.server";
import { prisma } from "~/modules/db.server";
import PostCard from "~/components/PostCard";

interface UserPostContentSearchResult {
  highlightedcontent: string;
  postid: number;
  posttitle: string;
  posturl: string;
  postdatejst: string;
  countlikes: number;
  countdislikes: number;
}


export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const query = url.searchParams.get("q");
  if (!query) {
    return json({ results: [], query: "" });
  }

  let { data } = await supabase.rpc("search_post_contents", { keyword : query }) as { data: UserPostContentSearchResult[] };
  data = data.map((post) => {
    return {
      ...post,
      highlightedcontent: MakeReadbleHighlightText(post.highlightedcontent)
    };
  });

  const allTags = await prisma.dimTags.findMany({
    select: {
      postId: true,
      tagName: true,
    },
    where : { postId: { in: data.map((post) => post.postid) } },
  });

  data = data.map((post) => {
    const tagNames = allTags
      .filter((tag) => tag.postId === post.postid)
      .map((tag) => tag.tagName);
    return { ...post, tagNames };
  });


  return json({ data, query });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const query = formData.get("q") || "";

  const encodedQuery = encodeURIComponent(query.toString());
  
  return redirect(`/search?q=${encodedQuery}`);
};

function MakeReadbleHighlightText(htmlString: string): string {
  const highlightedText = htmlString.replace(/<span class=\\"keyword\\">(.*?)<\/span>/g, '<mark>$1</mark>');
  return highlightedText.slice(2, -2);
}

export default function Component() {
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, query } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();

  return (
    <div className="container mx-auto px-4">
      <H1>検索</H1>
      <Form action="/search" method="post" className="mb-8">
        <div className="flex items-center">
            <input
                type="text"
                name="q"
                defaultValue={searchParams.get("q") ?? ''}
                className="border border-gray-300 rounded-l px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="検索キーワードを入力"
            />
            <button
                type="submit"
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-r"
            >
                検索
            </button>
        </div>
      </Form>
      {data && data.length > 0 ? (
        data.map((post: any) => (
            <PostCard
              postId={post.postid}
              postTitle={post.posttitle}
              postDateJst={post.postdatejst}
              postUrl={post.posturl}
              tagNames={post.tagNames}
              countLikes={post.countlikes}
              countDislikes={post.countdislikes}
              highLightedText={post.highlightedcontent}
              key={post.posturl}
            />
          ))
      ) : query ? (
        <p>検索結果がありません。</p>
      ) : null}
    </div>
  );
}
