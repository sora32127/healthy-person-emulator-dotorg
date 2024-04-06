import { Form, useLoaderData, NavLink } from "@remix-run/react";
import { H1 } from "~/components/Headings";
import { ActionFunctionArgs, LoaderFunctionArgs, json, redirect } from "@remix-run/node";
import { supabase } from "~/modules/supabase.server";
import { prisma } from "~/modules/db.server";
import PostCard from "~/components/PostCard";
import { useState } from "react";

interface DimPostContentSearchResult {
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


export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const searchType = url.searchParams.get("t")
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
  const allTagsOnlyForSearch: Tag[] = tags.map((tag) => {
    return { tagName: tag.tagName, count: tag._count.relPostTags };
  });


  if (searchType === "tag") {
    const tags = url.searchParams.get("tags")?.split(" ") || [];
    const totalCount = await prisma.relPostTags.count({
      where: { dimTag: { tagName: { in: tags } } },
    });

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
      where: { rel_post_tags: { some: { dimTag: { tagName: { in: tags } } } } },
      orderBy: { postDateGmt: "desc" },
      skip: (pageNumber - 1) * 10,
      take: 10,
    });

    const searchResults = searchResultsRaw.map((post) => {
      const tagNames = post.rel_post_tags.map((rel) => rel.dimTag.tagName);
      return {
        postId: post.postId,
        postTitle: post.postTitle,
        postDateGmt: post.postDateGmt,
        countLikes: post.countLikes,
        countDislikes: post.countDislikes,
        tagNames,
      };
    });

    return json({
      data: searchResults,
      allTagsOnlyForSearch,
      totalCount,
      pageNumber,
      searchType,
      tags: tags,
      title: null,
      query: null,
      url,
    });

  }
  else if (searchType === "title") {
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
      },
      orderBy: { postDateGmt: "desc" },
      skip: (pageNumber - 1) * 10,
      take: 10,
    });

    const searchResults = searchResultsRaw.map((post) => {
      const tagNames = post.rel_post_tags.map((rel) => rel.dimTag.tagName);
      return {
        postId: post.postId,
        postTitle: post.postTitle,
        postDateGmt: post.postDateGmt,
        countLikes: post.countLikes,
        countDislikes: post.countDislikes,
        tagNames,
      };
    });

    return json({
      data: searchResults,
      allTagsOnlyForSearch,
      totalCount,
      pageNumber,
      searchType,
      tags: null,
      title,
      query: null,
      url,
    });
  }
  else if (searchType === "fullText") {
    const query = url.searchParams.get("text") || "";
    const { data } = await supabase.rpc("search_post_contents", { keyword: query }) as { data: DimPostContentSearchResult[]};
    if (!data) {
      return json({ data: [], allTagsOnlyForSearch, totalCount: 0, pageNumber: 1, searchType: null, query: "" });
    }
    const count = data.length;
    const styledData = data.slice((pageNumber - 1) * 10, pageNumber * 10).map((post) => {
      return {
        postId: post.postid,
        postTitle: post.posttitle,
        postDateGmt: post.postdategmt,
        countLikes: post.countlikes,
        countDislikes: post.countdislikes,
        highlightedContent: MakeReadbleHighlightText(post.highlightedcontent)
      };
    });
    
    const allTags = await prisma.relPostTags.findMany({
      select: {
          postId: true,
          dimTag: { select: { tagName: true } }
      },
      where : { postId : { in : styledData.map((post) => post.postId)}}
    })

    const searchResultsWithTags = styledData.map((post) => {
      const tagNames = allTags
        .filter((tag) => tag.postId === post.postId)
        .map((tag) => tag.dimTag.tagName);
      return {
        postId: post.postId,
        postTitle: post.postTitle,
        postDateGmt: post.postDateGmt,
        countLikes: post.countLikes,
        countDislikes: post.countDislikes,
        tagNames,
        highlightedContent: post.highlightedContent
      };
    });

    return json({
      data: searchResultsWithTags,
      allTagsOnlyForSearch,
      totalCount: count,
      pageNumber,
      searchType,
      tags: null,
      title: null,
      query,
      url,
    });
  }
  else {
    return json({
      data: [],
      allTagsOnlyForSearch,
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

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const searchType = formData.get("searchType") as SearchType;
  const query = formData.get("q") || "";
  const title = formData.get("title") || "";
  const tags = formData.getAll("tags") as string[];
  const pageNumber = formData.get("p") || "1";

  const encodedQuery = encodeURIComponent(query.toString());
  const encodedTitle = encodeURIComponent(title.toString());
  const encodedTags = tags.map((tag) => encodeURIComponent(tag)).join('+');

  if (searchType === "tag" && tags.length > 0) {
    return redirect(`/search?t=tag&tags=${encodedTags}&p=${pageNumber}`);
  }
  else if (searchType === "fullText" && query !== "") {
    return redirect(`/search?t=fullText&text=${encodedQuery}&p=${pageNumber}`);
  }
  else if (searchType === "title" && title !== "") {
    return redirect(`/search?t=title&title=${encodedTitle}&p=${pageNumber}`);
  }
  else {
    return redirect("/search");
  }
};

function MakeReadbleHighlightText(htmlString: string): string {
  const highlightedText = htmlString.replace(/<span class=\\"keyword\\">(.*?)<\/span>/g, '<mark>$1</mark>');
  return highlightedText.slice(2, -2);
}

type SearchType = "tag" | "fullText" | "title";


export default function Component() {
  const { data, allTagsOnlyForSearch, totalCount, pageNumber, searchType, tags, title, query } = useLoaderData<typeof loader>();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagInputValue, setTagInputValue] = useState<string>("");
  const [tagSearchSuggestions, setTagSearchSuggestions] = useState<Tag[]>([]);
  const [currentSearchType, setCurrentSearchType] = useState<SearchType>(searchType || "tag");

  const totalPages = Math.ceil(totalCount / 10);

  const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTagInputValue(value);

    if (value.length > 0){
      const filteredTagSearchSuggestions = allTagsOnlyForSearch.filter((tag: Tag) => tag.tagName.includes(value));
      setTagSearchSuggestions(filteredTagSearchSuggestions);
    }else{
      setTagSearchSuggestions([]);
    }
  }

  const handleTagSelect = (tagName: string) => {
    if (!selectedTags.includes(tagName)){
      setSelectedTags([...selectedTags, tagName]);
      setTagInputValue("");
      setTagSearchSuggestions([]);
    }
  }

  const handleTagRemove = (tagName: string) => {
    setSelectedTags(selectedTags.filter((tag) => tag !== tagName));
  }

  const getPaginationLink = (page: number) => {
    return `/search?t=${searchType}&p=${page}${
      searchType === "tag"
        ? `&tags=${tags}`
        : searchType === "title"
        ? `&title=${encodeURIComponent(title)}`
        : `&text=${encodeURIComponent(query)}`
    }`;
  };
  

  return (
    <div className="container mx-auto px-4">
      <H1>検索</H1>
      <Form action="/search" method="post" className="mb-8">
        <input type="hidden" name="searchType" value={currentSearchType} />
        <div className="flex items-center">
          <select
            value={currentSearchType}
            onChange={(e) => setCurrentSearchType(e.target.value as SearchType)}
            className="border border-gray-300 rounded px-4 py-2 mr-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="tag">タグ検索</option>
            <option value="fullText">全文検索</option>
            <option value="title">タイトル検索</option>
          </select>
          {currentSearchType === "tag" && (
            <div className="flex items-center w-full">
              <input
                type="text"
                value={tagInputValue}
                onChange={handleTagInputChange}
                className="border border-gray-300 rounded-l px-4 py-2 w-5/6 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="タグを入力"
              />
              <button
                type="submit"
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded mx-2"
              >
                検索
              </button>
            </div>
          )}
          {currentSearchType === "fullText" && (
            <div className="flex items-center w-full">
              <input
                type="text"
                name="q"
                defaultValue={query}
                className="border border-gray-300 rounded-l px-4 py-2 w-5/6 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="検索キーワードを入力"
              />
              <button
                type="submit"
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded mx-2"
              >
                検索
              </button>
            </div>
          )}
          {currentSearchType === "title" && (
            <div className="flex items-center w-full">
              <input
                type="text"
                name="title"
                defaultValue={title}
                className="border border-gray-300 rounded-l px-4 py-2 w-5/6 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="タイトルを入力"
              />
              <button
                type="submit"
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded mx-2"
              >
                検索
              </button>
            </div>
          )}
        </div>
        {currentSearchType === "tag" && (
          <div className="mt-4">
            {tagSearchSuggestions.length > 0 && (
              <ul className="mt-2 border border-gray-300 rounded">
                {tagSearchSuggestions.map((tag) => (
                  <li
                    key={tag.tagName}
                    className="px-4 py-2 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleTagSelect(tag.tagName)}
                  >
                    {tag.tagName} ({tag.count})
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2">
              {selectedTags.map((tag) => (
                <span
                  key={tag}
                  className="bg-blue-500 text-white px-2 py-1 rounded-full mr-2"
                >
                  <input type="hidden" name="tags" value={tag} />
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleTagRemove(tag)}
                    className="ml-2"
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </Form>
      {data && data.length > 0 ? (
        <>
          {data.map((post: any) => (
            <PostCard
              postId={post.postId}
              postTitle={post.postTitle}
              postDateGmt={post.postDateGmt}
              tagNames={post.tagNames}
              countLikes={post.countLikes}
              countDislikes={post.countDislikes}
              highLightedText={post.highlightedContent}
              key={post.postUrl}
            />
          ))}
          <div className="flex justify-center mt-8">
            <NavLink
              to={getPaginationLink(1)}
              className={`px-4 py-2 mx-1 ${
                pageNumber === 1
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-blue-500 text-white"
              } rounded`}
            >
              最初
            </NavLink>
            <NavLink
              to={getPaginationLink(pageNumber - 1)}
              className={`px-4 py-2 mx-1 ${
                pageNumber === 1
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-blue-500 text-white"
              } rounded`}
            >
              前へ
            </NavLink>
            <span className="px-4 py-2 mx-1 bg-white text-blue-500 rounded">
              {pageNumber} / {totalPages}
            </span>
            <NavLink
              to={getPaginationLink(pageNumber + 1)}
              className={`px-4 py-2 mx-1 ${
                pageNumber === totalPages
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-blue-500 text-white"
              } rounded`}
            >
              次へ
            </NavLink>
            <NavLink
              to={getPaginationLink(totalPages)}
              className={`px-4 py-2 mx-1 ${
                pageNumber === totalPages
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-blue-500 text-white"
              } rounded`}
            >
              最後
            </NavLink>
          </div>
        </>
      ) : (
        <p>検索結果がありません。</p>
      )}
    </div>
  );
}



export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data){
    return { title: "Loading..." };
  }

  const searchType = data.searchType || ""
  const searchTags = data.tags || [];
  const searchTitle = data.title || "";
  const searchQueryText = data.query || "";
  
  let title

  if (searchType === "tag") {
    title = `タグ検索: ${searchTags.join(", ")}`;
  } else if (searchType === "title") {
    title = `タイトル検索: ${searchTitle}`;
  } else if (searchType === "fullText") {
    title = `全文検索: ${searchQueryText}`;
  } else {
    title = "検索";
  }

  const description = "検索"

  const ogLocale = "ja_JP";
  const ogSiteName = "健常者エミュレータ事例集";
  const ogType = "article";
  const ogTitle = title;
  const ogDescription = description;
  const ogUrl = data.url

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
