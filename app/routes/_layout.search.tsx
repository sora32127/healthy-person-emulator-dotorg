import { Form, useLoaderData } from "@remix-run/react";
import { H1 } from "~/components/Headings";
import { ActionFunction, LoaderFunction, MetaFunction, json, redirect } from "@remix-run/node";
import { supabase } from "~/modules/supabase.server";
import { prisma } from "~/modules/db.server";
import PostCard from "~/components/PostCard";
import { useState } from "react";

interface HighlightedPostContent {
  highlightedcontent: string;
  postid: number;
  posttitle: string;
  postdategmt: string;
  countlikes: number;
  countdislikes: number;
}

interface Tag {
  tagName: string;
  count: number;
}

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const searchType = url.searchParams.get("t") as SearchType | null;
  const pageNumber = parseInt(url.searchParams.get("p") || "1");

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

  if (searchType === "tag") {
    const tagNamesBySpace = url.searchParams.get("tags")?.split(" ") || [];
    const tagNamesByComma = url.searchParams.get("tags")?.split(",") || [];
    const tagNames =
      tagNamesBySpace.length > tagNamesByComma.length ? tagNamesBySpace : tagNamesByComma;

    const relatedTags = await prisma.relPostTags.findMany({
      select: {
        postId: true,
        dimTag: { select: { tagName: true } },
      },
      where: { dimTag: { tagName: { in: tagNames } } },
    });

    const postIdTagsMap = relatedTags.reduce((acc, cur) => {
      const { postId, dimTag } = cur;
      acc[postId] ? acc[postId].push(dimTag.tagName) : (acc[postId] = [dimTag.tagName]);
      return acc;
    }, {} as Record<number, string[]>);

    const filteredPostIds = Object.entries(postIdTagsMap)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .filter(([_, postTags]) => tagNames.every((tag) => postTags.includes(tag)))
      .map(([postId]) => Number(postId));

    const totalCount = filteredPostIds.length;

    const searchResultsRaw = await prisma.dimPosts.findMany({
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
      where: { postId: { in: filteredPostIds } },
      orderBy: { postDateGmt: "desc" },
      skip: (pageNumber - 1) * 10,
      take: 10,
    });

    const searchResults = searchResultsRaw.map((post) => ({
      postId: post.postId,
      postTitle: post.postTitle,
      postDateGmt: post.postDateGmt,
      countLikes: post.countLikes,
      countDislikes: post.countDislikes,
      tagNames: post.rel_post_tags.map((rel) => rel.dimTag.tagName),
    }));

    return json({
      data: searchResults,
      allTagsForSearch,
      totalCount,
      pageNumber,
      searchType,
      tags: tagNames,
      title: null,
      query: null,
      url,
    });
  } else if (searchType === "title") {
    const title = url.searchParams.get("title") || "";
    const totalCount = await prisma.dimPosts.count({
      where: { postTitle: { contains: title } },
    });

    const searchResultsRaw = await prisma.dimPosts.findMany({
      where: { postTitle: { contains: title } },
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
      orderBy: { postDateGmt: "desc" },
      skip: (pageNumber - 1) * 10,
      take: 10,
    });

    const searchResults = searchResultsRaw.map((post) => ({
      postId: post.postId,
      postTitle: post.postTitle,
      postDateGmt: post.postDateGmt,
      countLikes: post.countLikes,
      countDislikes: post.countDislikes,
      tagNames: post.rel_post_tags.map((rel) => rel.dimTag.tagName),
    }));

    return json({
      data: searchResults,
      allTagsForSearch,
      totalCount,
      pageNumber,
      searchType,
      tags: null,
      title,
      query: null,
      url,
    });
  } else if (searchType === "fullText") {
    const query = url.searchParams.get("text") || "";
    const { data } = (await supabase.rpc("search_post_contents", {
      keyword: query,
    })) as { data: HighlightedPostContent[] };

    if (!data) {
      return json({
        data: [],
        allTagsForSearch,
        totalCount: 0,
        pageNumber: 1,
        searchType: null,
        query: "",
      });
    }

    const count = data.length;
    const styledData = data.slice((pageNumber - 1) * 10, pageNumber * 10).map((post) => ({
      postId: post.postid,
      postTitle: post.posttitle,
      postDateGmt: post.postdategmt,
      countLikes: post.countlikes,
      countDislikes: post.countdislikes,
      highlightedContent: makeReadableHighlightText(post.highlightedcontent),
    }));

    const allTags = await prisma.relPostTags.findMany({
      select: {
        postId: true,
        dimTag: { select: { tagName: true } },
      },
      where: { postId: { in: styledData.map((post) => post.postId) } },
    });

    const searchResultsWithTags = styledData.map((post) => ({
      ...post,
      tagNames: allTags
        .filter((tag) => tag.postId === post.postId)
        .map((tag) => tag.dimTag.tagName),
    }));

    return json({
      data: searchResultsWithTags,
      allTagsForSearch,
      totalCount: count,
      pageNumber,
      searchType,
      tags: null,
      title: null,
      query,
      url,
    });
  } else {
    return json({
      data: [],
      allTagsForSearch,
      totalCount: 0,
      pageNumber: 1,
      searchType: null,
      tags: null,
      title: null,
      query: null,
      url,
    });
  }
};

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const action = formData.get("action");
  const currentPage = parseInt(formData.get("currentPage") as string);
  const totalPages = parseInt(formData.get("totalPages") as string);
  const searchType = formData.get("searchType") as SearchType;
  const tags = formData.get("tags")?.toString().split("+") || [];
  const title = formData.get("title")?.toString() || "";
  const query = formData.get("query")?.toString() || "";

  const encodedQuery = encodeURIComponent(query);
  const encodedTitle = encodeURIComponent(title);
  const encodedTags = tags.map((tag) => encodeURIComponent(tag)).join("+");

  if (action === "firstSearch") {
    return redirect(
      `/search?t=${searchType}&p=1${
        searchType === "tag"
          ? `&tags=${encodedTags}`
          : searchType === "title"
          ? `&title=${encodedTitle}`
          : searchType === "fullText"
          ? `&text=${encodedQuery}`
          : ""
      }`
    );
  } else if (action === "firstPage") {
    return redirect(
      `/search?t=${searchType}&p=1${
        searchType === "tag"
          ? `&tags=${encodedTags}`
          : searchType === "title"
          ? `&title=${encodedTitle}`
          : searchType === "fullText"
          ? `&text=${encodedQuery}`
          : ""
      }`
    );
  } else if (action === "prevPage") {
    return redirect(
      `/search?t=${searchType}&p=${currentPage - 1}${
        searchType === "tag"
          ? `&tags=${encodedTags}`
          : searchType === "title"
          ? `&title=${encodedTitle}`
          : searchType === "fullText"
          ? `&text=${encodedQuery}`
          : ""
      }`
    );
  } else if (action === "nextPage") {
    return redirect(
      `/search?t=${searchType}&p=${currentPage + 1}${
        searchType === "tag"
          ? `&tags=${encodedTags}`
          : searchType === "title"
          ? `&title=${encodedTitle}`
          : searchType === "fullText"
          ? `&text=${encodedQuery}`
          : ""
      }`
    );
  } else if (action === "lastPage") {
    return redirect(
      `/search?t=${searchType}&p=${totalPages}${
        searchType === "tag"
          ? `&tags=${encodedTags}`
          : searchType === "title"
          ? `&title=${encodedTitle}`
          : searchType === "fullText"
          ? `&text=${encodedQuery}`
          : ""
      }`
    );
  } else {
    return redirect("/search");
  }
};

function makeReadableHighlightText(htmlString: string): string {
  if (!htmlString) {
    return "";
  }
  const highlightedText = htmlString.replace(
    /<span class=\\"keyword\\">(.*?)<\/span>/g,
    "<mark>$1</mark>"
  );
  return highlightedText.slice(2, -2);
}

type SearchType = "tag" | "fullText" | "title";

export default function SearchPage() {
  const {
    data,
    allTagsForSearch,
    totalCount,
    pageNumber,
    searchType,
    tags,
    title,
    query,
  } = useLoaderData<typeof loader>();

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagInputValue, setTagInputValue] = useState<string>("");
  const [tagSuggestions, setTagSuggestions] = useState<Tag[]>([]);
  const [currentSearchType, setCurrentSearchType] = useState<SearchType>(searchType || "tag");

  const [queryText, setQueryText] = useState<string>("");
  const [titleText, setTitleText] = useState<string>("");

  const totalPages = Math.ceil(totalCount / 10);

  const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTagInputValue(value);

    if (value.length > 0) {
      const filteredSuggestions = allTagsForSearch.filter((tag: Tag) =>
        tag.tagName.includes(value)
      );
      setTagSuggestions(filteredSuggestions);
    } else {
      setTagSuggestions([]);
    }
  };

  const handleTagSelect = (tagName: string) => {
    if (!selectedTags.includes(tagName)) {
      setSelectedTags([...selectedTags, tagName]);
      setTagInputValue("");
      setTagSuggestions([]);
    }
  };

  const handleTagRemove = (tagName: string) => {
    setSelectedTags(selectedTags.filter((tag) => tag !== tagName));
  };

  const searchResultTitle = () => {
    if (searchType === "tag") {
      return tags ? `タグ検索: ${tags.join(", ")}` : null;
    } else if (searchType === "title") {
      return `タイトル検索: ${title}`;
    } else if (searchType === "fullText") {
      return `全文検索: ${query}`;
    } else {
      return null;
    }
  };

  return (
    <div className="container mx-auto px-4">
      <H1>検索</H1>
      <Form action="/search" method="post" className="mb-8">
        <input type="hidden" name="searchType" value={currentSearchType} />
        <div className="flex flex-col md:flex-row items-center">
          <select
            value={currentSearchType}
            onChange={(e) => setCurrentSearchType(e.target.value as SearchType)}
            className=" rounded px-4 py-2 mb-4 md:mb-0 md:mr-4 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-auto"
          >
            <option value="tag">タグ検索</option>
            <option value="fullText">全文検索</option>
            <option value="title">タイトル検索</option>
          </select>
          {currentSearchType === "tag" && (
            <div className="w-full md:flex-row">
              <input
                type="text"
                value={tagInputValue}
                onChange={handleTagInputChange}
                className="placeholder-slate-500 rounded px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2 md:mb-0 md:w-5/6"
                placeholder="タグを入力"
              />
              <button
                type="submit"
                className="bg-primary text-white px-6 py-2 rounded mt-2 md:mt-0 md:ml-2 w-full md:w-auto"
                name="action"
                value="firstSearch"
              >
                検索
              </button>
              <input type="hidden" name="tags" value={selectedTags.join("+")} />
            </div>
          )}
          {currentSearchType === "fullText" && (
            <div className="w-full md:flex-1">
              <input
                type="text"
                name="q"
                defaultValue={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                className="rounded px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2 md:mb-0 md:w-5/6 placeholder-slate-500"
                placeholder="検索キーワードを入力"
              />
              <button
              type="submit"
              className="bg-primary text-white px-6 py-2 rounded mt-2 md:mt-0 md:ml-2 w-full md:w-auto"
              name="action"
              value="firstSearch"
              >
              検索
              </button>
              <input type="hidden" name="query" value={queryText} />
            </div>
        )}
        {currentSearchType === "title" && (
          <div className="w-full md:flex-1">
            <input
            type="text"
            name="title"
            defaultValue={titleText}
            onChange={(e) => setTitleText(e.target.value)}
            className="placeholder-slate-500 rounded px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2 md:mb-0 md:w-5/6"
            placeholder="タイトルを入力"
            />
            <button
              type="submit"
              className="bg-primary text-white px-6 py-2 rounded mt-2 md:mt-0 md:ml-2 w-full md:w-auto"
              name="action"
              value="firstSearch"
            >
            検索
            </button>
            <input type="hidden" name="title" value={titleText} />
          </div>
        )}
        </div>
        {currentSearchType === "tag" && (
          <div className="mt-4">
          {tagSuggestions.length > 0 && (
            <ul className="mt-2 border border-gray-300 rounded">
            {tagSuggestions.map((tag) => (
              <li
              key={tag.tagName+tag.count}
              className="px-4 py-2 hover:border-2 hover:border-info tag-select"
              onClick={() => handleTagSelect(tag.tagName)}
              >
              {tag.tagName} ({tag.count})
              </li>
            ))}
            </ul>
          )}
          <div className="mt-2">
          {selectedTags.map((tag) => (
            <span key={tag} className="bg-blue-500 text-white px-2 py-1 rounded-full mr-2">
              <input type="hidden" name="tags" value={tag} />
              {tag}
                <button type="button" onClick={() => handleTagRemove(tag)} className="ml-2">
                x
                </button>
            </span>
          ))}
          </div>
        </div>
      )}
    </Form>
    <p className="text-lg mb-4 font-bold">{searchResultTitle()}</p>
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
      <input type="hidden" name="searchType" value={searchType} />
      <input type="hidden" name="tags" value={tags?.join("+")} />
      <input type="hidden" name="title" value={title} />
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

  const { searchType, tags, title, query } = data;
  let pageTitle;

  if (searchType === "tag") {
    pageTitle = `タグ検索: ${tags?.join(", ")}`;
  } else if (searchType === "title") {
    pageTitle = `タイトル検索: ${title}`;
  } else if (searchType === "fullText") {
    pageTitle = `全文検索: ${query}`;
  } else {
    pageTitle = "検索";
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