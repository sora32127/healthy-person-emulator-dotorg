import { Form, useLoaderData, useSearchParams, Link } from "@remix-run/react";
import { H1 } from "~/components/Headings";
import { ActionFunctionArgs, LoaderFunctionArgs, json, redirect } from "@remix-run/node";
import { supabase } from "~/modules/supabase.server";
import { prisma } from "~/modules/db.server";
import PostCard from "~/components/PostCard";
import { useState } from "react";

interface UserPostContentSearchResult {
  highlightedcontent: string;
  postid: number;
  posttitle: string;
  posturl: string;
  postdatejst: string;
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
  const tags = await prisma.dimTags.groupBy({
    by: ["tagName"],
    _count: { postId: true },
    orderBy: { _count: { postId: "desc" } },
  });

  const allTagsOnlyForSearch: Tag[] = tags.map((tag: { tagName: string, _count: { postId: number } }) => {
    return { tagName: tag.tagName, count: tag._count.postId };
  });


  if (searchType === "tag") {
    const tags = url.searchParams.get("tags")?.split("+") || [];
    const allTagsForSearch = await prisma.dimTags.findMany({
      where: { tagName: { in: tags } },
      select: { tagName: true, postId: true },
    });
    const postIds = allTagsForSearch.map((tag) => tag.postId);
    const totalCount = await prisma.userPostContent.count({
      where: { postId: { in: postIds } },
    });
    const searchPosts = await prisma.userPostContent.findMany({
      where: { postId: { in: postIds } },
      select: {
        postId: true,
        postTitle: true,
        postDateJst: true,
        postUrl: true,
        countLikes: true,
        countDislikes: true,
        postContent: true,
      },
      orderBy: { postDateJst: "desc" },
      skip: (pageNumber - 1) * 10,
      take: 10,
    });
    const allTags = await prisma.dimTags.findMany({
      select: { tagName: true, postId: true },
      where: { postId: { in: searchPosts.map((post) => post.postId) } }
    });

    const searchResults = searchPosts.map((post) => {
      const tagNames = allTags
        .filter((tag) => tag.postId === post.postId)
        .map((tag) => tag.tagName);
      return {
        postId: post.postId,
        postTitle: post.postTitle,
        postDateJst: post.postDateJst,
        postUrl: post.postUrl,
        countLikes: post.countLikes,
        countDislikes: post.countDislikes,
        tagNames,
      };
    });

    return { data: searchResults, allTagsForSearch: allTagsOnlyForSearch, totalCount, pageNumber, searchType, tags: tags.join("+") };
  }
  else if (searchType === "title") {
    const title = url.searchParams.get("title") || "";
    const totalCount = await prisma.userPostContent.count({
      where: { postTitle: { contains: title } },
    });
    const searchResults = await prisma.userPostContent.findMany({
      where: { postTitle: { contains: title } },
      select: {
        postId: true,
        postTitle: true,
        postDateJst: true,
        postUrl: true,
        countLikes: true,
        countDislikes: true,
        postContent: true,
      },
      orderBy: { postDateJst: "desc" },
      skip: (pageNumber - 1) * 10,
      take: 10,
    });

    const allTags = await prisma.dimTags.findMany({
      select: { tagName: true, postId: true },
      where: { postId: { in: searchResults.map((post) => post.postId) } }
    });

    const searchResultsWithTags = searchResults.map((post) => {
      const tagNames = allTags
        .filter((tag) => tag.postId === post.postId)
        .map((tag) => tag.tagName);
      return {
        postId: post.postId,
        postTitle: post.postTitle,
        postDateJst: post.postDateJst,
        postUrl: post.postUrl,
        countLikes: post.countLikes,
        countDislikes: post.countDislikes,
        tagNames,
      };
    });

    return { data: searchResultsWithTags, allTagsForSearch: allTagsOnlyForSearch, totalCount, pageNumber, searchType, title };
  }
  else if (searchType === "fullText") {
    const query = url.searchParams.get("text") || "";
    const { data } = await supabase.rpc("search_post_contents", { keyword: query }) as { data: UserPostContentSearchResult[]};
    const count = data.length;
    const styledData = data.slice((pageNumber - 1) * 10, pageNumber * 10).map((post) => {
      return {
        postId: post.postid,
        postTitle: post.posttitle,
        postDateJst: post.postdatejst,
        postUrl: post.posturl,
        countLikes: post.countlikes,
        countDislikes: post.countdislikes,
        highlightedContent: MakeReadbleHighlightText(post.highlightedcontent)
      };
    });
    const allTags = await prisma.dimTags.findMany({
      select: { tagName: true, postId: true },
      where: { postId: { in: styledData.map((post) => post.postId) } }
    });
    const searchResultsWithTags = styledData.map((post) => {
      const tagNames = allTags
        .filter((tag) => tag.postId === post.postId)
        .map((tag) => tag.tagName);
      return {
        postId: post.postId,
        postTitle: post.postTitle,
        postDateJst: post.postDateJst,
        postUrl: post.postUrl,
        countLikes: post.countLikes,
        countDislikes: post.countDislikes,
        tagNames,
        highlightedContent: post.highlightedContent
      };
    });

    return { data: searchResultsWithTags, allTagsForSearch: allTagsOnlyForSearch, totalCount: count, pageNumber, searchType, query };
  }
  else {
    return { data: [], allTagsForSearch: allTagsOnlyForSearch, totalCount: 0, pageNumber: 1, searchType: null, query: "" };
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
  const { data, allTagsForSearch, totalCount, pageNumber, searchType, tags, title, query } = useLoaderData<typeof loader>();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagInputValue, setTagInputValue] = useState<string>("");
  const [tagSearchSuggestions, setTagSearchSuggestions] = useState<Tag[]>([]);
  const [currentSearchType, setCurrentSearchType] = useState<SearchType>(searchType || "tag");

  const totalPages = Math.ceil(totalCount / 10);

  const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTagInputValue(value);

    if (value.length > 0){
      const filteredTagSearchSuggestions = allTagsForSearch.filter((tag: Tag) => tag.tagName.includes(value));
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
                className="border border-gray-300 rounded-l px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="タグを入力"
              />
              <button
                type="submit"
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-r"
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
          )}
          {currentSearchType === "title" && (
            <div className="flex items-center w-full">
              <input
                type="text"
                name="title"
                defaultValue={title}
                className="border border-gray-300 rounded-l px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="タイトルを入力"
              />
              <button
                type="submit"
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-r"
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
              postDateJst={post.postDateJst}
              postUrl={post.postUrl}
              tagNames={post.tagNames}
              countLikes={post.countLikes}
              countDislikes={post.countDislikes}
              highLightedText={post.highlightedContent}
              key={post.postUrl}
            />
          ))}
          <div className="flex justify-center mt-8">
            <Link
              to={getPaginationLink(1)}
              className={`px-4 py-2 mx-1 ${
                pageNumber === 1
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-blue-500 text-white"
              } rounded`}
            >
              最初
            </Link>
            <Link
              to={getPaginationLink(pageNumber - 1)}
              className={`px-4 py-2 mx-1 ${
                pageNumber === 1
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-blue-500 text-white"
              } rounded`}
            >
              前へ
            </Link>
            <span className="px-4 py-2 mx-1 bg-white text-blue-500 rounded">
              {pageNumber} / {totalPages}
            </span>
            <Link
              to={getPaginationLink(pageNumber + 1)}
              className={`px-4 py-2 mx-1 ${
                pageNumber === totalPages
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-blue-500 text-white"
              } rounded`}
            >
              次へ
            </Link>
            <Link
              to={getPaginationLink(totalPages)}
              className={`px-4 py-2 mx-1 ${
                pageNumber === totalPages
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-blue-500 text-white"
              } rounded`}
            >
              最後
            </Link>
          </div>
        </>
      ) : (
        <p>検索結果がありません。</p>
      )}
    </div>
  );
}