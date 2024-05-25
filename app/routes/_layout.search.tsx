import { Form, useLoaderData } from "@remix-run/react";
import { H1 } from "~/components/Headings";
import { ActionFunction, LoaderFunction, MetaFunction, json, redirect } from "@remix-run/node";
import { prisma } from "~/modules/db.server";
import PostCard from "~/components/PostCard";
import { useState } from "react";
import TagSelectionBox from "~/components/SubmitFormComponents/TagSelectionBox";

interface Tag {
  tagName: string;
  count: number;
}

type OrderBy = "timeDesc" | "like";

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const pageNumber = parseInt(url.searchParams.get("p") || "1");
  const orderBy = url.searchParams.get("orderBy") as OrderBy || "timeDesc";
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
    orderBy: orderBy === "timeDesc" ? { postDateGmt: "desc" } : { countLikes: "desc" },
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
    orderBy: orderBy || "timeDesc",
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
  const orderBy = formData.get("orderBy") as OrderBy;

  const encodedQueryString = query && query != '' ? `&q=${encodeURIComponent(query)}` : "";
  const encodedTagsString =  tags && tags.filter(tag => tag !== '').length > 0 ? `&tags=${tags.map(tag => encodeURIComponent(tag)).join("+")}` : "";

  if (action === "firstSearch" || action === "firstPage") {
    return redirect(
      `/search?p=1&orderBy=${orderBy}${encodedQueryString}${encodedTagsString}`
    );
  } else if (action === "prevPage") {
    return redirect(
      `/search?p=${currentPage - 1}&orderBy=${orderBy}${encodedQueryString}${encodedTagsString}`
    );
  } else if (action === "nextPage") {
    return redirect(
      `/search?p=${currentPage + 1}&orderBy=${orderBy}${encodedQueryString}${encodedTagsString}`
    );
  } else if (action === "lastPage") {
    return redirect(
      `/search?p=${totalPages}&orderBy=${orderBy}${encodedQueryString}${encodedTagsString}`
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
    orderBy,
  } = useLoaderData<typeof loader>();

  const [selectedTags, setSelectedTags] = useState<string[]>(tags ?? []);
  const [queryText, setQueryText] = useState<string>(query ?? "");
  const [currentOrderBy, setCurrentOrderBy] = useState<OrderBy>(orderBy || "timeDesc");
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
        <div className="mx-8 pl-4 pr-16 pt-4">
          <TagSelectionBox
            onTagsSelected={(tags) => setSelectedTags(tags)}
            parentComponentStateValues={selectedTags}
            allTagsOnlyForSearch={allTagsForSearch}
          />
        </div>
        <select
          id="orderBy"
          className="select select-bordered m-2"
          name="orderBy"
          value={currentOrderBy}
          onChange={(e) => setCurrentOrderBy(e.target.value as OrderBy)}
        >
          <option value="timeDesc">投稿日時順</option>
          <option value="like">いいね数順</option>
        </select>
        <input type="hidden" name="orderBy" value={currentOrderBy} />
        <input type="hidden" name="tags" value={selectedTags.join("+")} />
        <input type="hidden" name="query" value={queryText} />
    </Form>

    {data && data.length > 0 ? (
    <>
    <div className="search-results">
      {data.map((post: any) => (
        <PostCard
          key={post.postId}
          postId={post.postId}
          postTitle={post.postTitle}
          postDateGmt={post.postDateGmt}
          tagNames={post.tagNames}
          countLikes={post.countLikes}
          countDislikes={post.countDislikes}
          highLightedText={post.highlightedContent}
        />
      ))}
    </div>
    <div className="flex justify-center mt-8">
    <Form method="post" className="flex items-center">
      <input type="hidden" name="currentPage" value={pageNumber} />
      <input type="hidden" name="totalPages" value={totalPages} />
      <input type="hidden" name="tags" value={tags?.join("+")} />
      <input type="hidden" name="query" value={query} />
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
  return { title: "Loading..." };
  }

  const { tags, query } = data;
  let pageTitle;
  pageTitle = query ? `「${query}」の検索結果` : "検索結果";
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