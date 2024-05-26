import { Form, useLoaderData } from "@remix-run/react";
import { H1, H2 } from "~/components/Headings";
import { ActionFunction, LoaderFunction, MetaFunction, json, redirect } from "@remix-run/node";
import { prisma } from "~/modules/db.server";
import PostCard, { PostCardProps }  from "~/components/PostCard";
import { useState } from "react";
import TagSelectionBox from "~/components/SubmitFormComponents/TagSelectionBox";

interface Tag {
  tagName: string;
  count: number;
}


export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const pageNumber = parseInt(url.searchParams.get("p") || "1");
  const orderby = url.searchParams.get("orderby") || "timeDesc";
  const searchQuery = url.searchParams.get("q") || null;
  const searchTags = url.searchParams.get("tags")?.split(" ") || null;
  
  const tags = await prisma.dimTags.findMany({
    select: {
      tagName: true,
      _count: {
        select: { relPostTags: true },
      },
    },
    orderBy: {
      relPostTags: {
        _count: "desc",
      },
    },
  });

  const allTagsForSearch: Tag[] = tags.map((tag) => ({
    tagName: tag.tagName,
    count: tag._count.relPostTags,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whereConditions: any = {}

  if (searchQuery) {
    whereConditions.OR = [
      { postTitle: { contains: searchQuery } },
      { postContent: { contains: searchQuery } },
    ];
  }

  if (searchTags && searchTags.length > 0) {
    whereConditions.AND = searchTags.map(tag => ({
      rel_post_tags: {
        some: {
          dimTag: {
            tagName: tag,
          },
        },
      },
    }));
  }
  
  if (!searchQuery && !searchTags) {
    whereConditions.postId = -1;
  }

  const totalCount = await prisma.dimPosts.count({
    where: whereConditions,
  });

  const searchResultRaw = await prisma.dimPosts.findMany({
    select : {
      postId: true,
      postTitle: true,
      postDateGmt: true,
      postContent: true,
      rel_post_tags: {
        select: {
          dimTag: {
            select: {
              tagName: true,
            },
          },
        },
      },
      countLikes: true,
      countDislikes: true,
    },
    where: whereConditions,
    orderBy: orderby === "timeDesc" ? { postDateGmt: "desc" } : { countLikes: "desc" },
    skip: (pageNumber - 1) * 10,
    take: 10,
  });

  const searchResult = searchResultRaw.map((post) => {
    const tagNames = post.rel_post_tags.map((relPostTag) => relPostTag.dimTag.tagName);
    return {
      postId: post.postId,
      postTitle: post.postTitle,
      postDateGmt: post.postDateGmt,
      tagNames,
      countLikes: post.countLikes,
      countDislikes: post.countDislikes,
    };
  });

  return json({
    data: searchResult,
    allTagsForSearch,
    pageNumber,
    tags: searchTags,
    query: searchQuery,
    orderby: orderby ?? "timeDesc",
    totalCount,
  });
};

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const action = formData.get("action");
  const currentPage = parseInt(formData.get("currentPage") as string);
  const totalPages = parseInt(formData.get("totalPages") as string);
  const tags = formData.get("tags")?.toString().split("+") ?? null;
  const query = formData.get("query")?.toString() ?? null;
  const orderby = formData.get("orderby") ?? "timeDesc";

  const encodedQueryString = query && query != '' ? `&q=${encodeURIComponent(query)}` : "";
  const encodedTagsString =  tags && tags.filter(tag => tag !== '').length > 0 ? `&tags=${tags.map(tag => encodeURIComponent(tag)).join("+")}` : "";

  if (action === "firstSearch" || action === "firstPage") {
    return redirect(
      `/search?p=1&orderby=${orderby}${encodedQueryString}${encodedTagsString}`
    );
  } else if (action === "prevPage") {
    return redirect(
      `/search?p=${currentPage - 1}&orderby=${orderby}${encodedQueryString}${encodedTagsString}`
    );
  } else if (action === "nextPage") {
    return redirect(
      `/search?p=${currentPage + 1}&orderby=${orderby}${encodedQueryString}${encodedTagsString}`
    );
  } else if (action === "lastPage") {
    return redirect(
      `/search?p=${totalPages}&orderby=${orderby}${encodedQueryString}${encodedTagsString}`
    );
  } else {
    return redirect("/search");
  }
};

export default function SearchPage() {
  const {
    data,
    allTagsForSearch,
    totalCount,
    pageNumber,
    tags,
    query,
    orderby,
  } = useLoaderData<typeof loader>();

  const [selectedTags, setSelectedTags] = useState<string[]>(tags ?? []);
  const [queryText, setQueryText] = useState<string>(query ?? "");
  const [currentOrderBy] = useState<string>(orderby || "timeDesc");
  const totalPages = Math.ceil(totalCount / 10);

  return (
    <div className="container mx-auto px-4">
      <H1>検索</H1>
      <Form action="/search" method="post" className="mb-8" id="searchForm">
        <input
          type="text"
          name="q"
          defaultValue={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          className="input input-bordered px-4 py-2 w-full  mb-2 md:mb-0 md:w-5/6 placeholder-slate-500 border-secondary"
          placeholder="検索キーワードを入力"
        />
        <button
          type="submit"
          className="btn btn-primary px-6 py-2 rounded mt-2 md:mt-0 md:ml-2 w-full md:w-auto"
          name="action"
          value="firstSearch"
        >
          検索
        </button>
        <div className="pt-4">
          <TagSelectionBox
            onTagsSelected={(tags) => setSelectedTags(tags)}
            parentComponentStateValues={selectedTags}
            allTagsOnlyForSearch={allTagsForSearch}
          />
        </div>
        <input type="hidden" name="tags" value={selectedTags.join("+")} />
        <input type="hidden" name="query" value={queryText} />
        <input type="hidden" name="orderby" value={currentOrderBy} />
    </Form>

    {data && data.length > 0 ? (
    <>
    <div>
      <H2>検索結果</H2>
      <p>合計{totalCount}件中 {pageNumber * 10 - 9} - {Math.min(pageNumber * 10, totalCount)} 件を表示</p>
      {query && (
        <p>キーワード: {query}</p>
      )}
      {tags && tags.length > 0 && (
        <p>タグ: {tags.join(", ")}</p>
      )}
    </div>
    <Form action="/search" method="post" id="orderbyForm" preventScrollReset>
      <div className="bg-base-100 max-w-xs flex flex-col items-start rounded-lg my-4">
        <p className="mb-2">並び替え</p>
        <div className="flex space-x-4">
          <button type="submit" name="orderby" value="timeDesc" className="btn btn-outline">
            投稿日時順
          </button>
          <button type="submit" name="orderby" value="like" className="btn btn-outline">
            いいね数順
          </button>
        </div>
      </div>
      <input type="hidden" name="currentPage" value="1" />
      <input type="hidden" name="tags" value={selectedTags.join("+")} />
      <input type="hidden" name="query" value={queryText} />
      <input type="hidden" name="action" value="firstSearch" />
      <input type="hidden" name="orderby" value={currentOrderBy} />
      <button type="submit" name="action" value="firstSearch" style={{ display: 'none' }}></button>
    </Form>

    <div className="search-results">
      {data.map((post: PostCardProps) => (
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
    <div className="flex justify-center mt-8">
    <Form method="post" className="flex items-center">
      <input type="hidden" name="currentPage" value={pageNumber} />
      <input type="hidden" name="totalPages" value={totalPages} />
      <input type="hidden" name="tags" value={tags?.join("+")} />
      <input type="hidden" name="query" value={query} />
      <input type="hidden" name="orderby" value={orderby} />
      <button
        type="submit"
        name="action"
        value="firstPage"
        disabled={pageNumber === 1}
        className={`px-2 py-2 mx-1 ${pageNumber === 1?
          "bg-gray-200 text-gray-500 cursor-not-allowed":
          "bg-primary text-white"}
          rounded search-go-to-first-page`}
        >
        最初
      </button>
      <button
        type="submit"
        name="action"
        value="prevPage"
        disabled={pageNumber === 1}
        className={`px-2 py-2 mx-1 ${pageNumber === 1?
        "bg-gray-200 text-gray-500 cursor-not-allowed":
        "bg-primary text-white"}
        rounded search-go-to-previous-page`}
        >
        前へ
      </button>
      <span className="px-4 py-2 mx-1">
      {pageNumber} / {totalPages}
      </span>
      <button
      type="submit"
      name="action"
      value="nextPage"
      disabled={pageNumber === totalPages}
      className={`px-2 py-2 mx-1 ${pageNumber === totalPages? "bg-gray-200 text-gray-500 cursor-not-allowed":
      "bg-primary text-white"}
      rounded search-go-to-next-page`}
        >
        次へ
      </button>
      <button
      type="submit"
      name="action"
      value="lastPage"
      disabled={pageNumber === totalPages}
      className={`px-2 py-2 mx-1 ${pageNumber === totalPages? "bg-gray-200 text-gray-500 cursor-not-allowed":
      "bg-primary text-white"}
      rounded search-go-to-last-page`}
        >
        最後
      </button>
    </Form>
  </div>
  </>
  ) : (
  <p>検索結果がありません。</p>
  )}
  </div>
  );
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) {
  return [{ title: "Loading..." }];
  }

  const { tags, query } = data;
  let pageTitle = "検索結果";
  if (query) {
    pageTitle += ` キーワード: ${query}`;
  }
  if (tags && tags.length > 0) {
    pageTitle += " タグ"
    pageTitle += `: ${tags.join(", ")}`;
  }

  const description = "検索";

  const ogLocale = "ja_JP";
  const ogSiteName = "健常者エミュレータ事例集";
  const ogType = "article";
  const ogTitle = pageTitle;
  const ogDescription = description;
  const ogUrl = data.url;

  const twitterCard = "summary";
  const twitterSite = "@helthypersonemu";
  const twitterTitle = pageTitle;
  const twitterDescription = description;
  const twitterCreator = "@helthypersonemu";
  const twitterImage =
  "https://qc5axegmnv2rtzzi.public.blob.vercel-storage.com/favicon-CvNSnEUuNa4esEDkKMIefPO7B1pnip.png";

  return [
  { title: pageTitle },
  { name: "description", content: description },
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