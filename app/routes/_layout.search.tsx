import { Form, useLoaderData, useSearchParams } from "@remix-run/react";
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
  const query = url.searchParams.get("q") || "";
  const tags = url.searchParams.getAll("tags");

  const allTagsForSearch = await prisma.dimTags.groupBy({
    by: ['tagName'],
    _count: {
      tagName: true,
    },
    orderBy: {
      _count: {
        tagName: 'desc',
      },
    },
  });

  const formattedAllTagsForSearch = allTagsForSearch.map((tag) => ({
    tagName: tag.tagName,
    count: tag._count.tagName,
  }));
  console.log("query: ", query, "tags: ", tags)
  if (query !== "" && tags.length === 0) {
    const { data } = await supabase.rpc("search_post_contents", { keyword: query }) as { data: UserPostContentSearchResult[] };
    let formattedData = data.map((post) => {
      return {
        postId: post.postid,
        postTitle: post.posttitle,
        postUrl: post.posturl,
        postDateJst: post.postdatejst,
        countLikes: post.countlikes,
        countDislikes: post.countdislikes,
        highlightedContent: MakeReadbleHighlightText(post.highlightedcontent)
      };
    });

    const allTags = await prisma.dimTags.findMany({
      select: {
        postId: true,
        tagName: true,
      },
      where: { postId: { in: formattedData.map((post) => post.postId) } },
    });

    formattedData = formattedData.map((post) => {
      const tagNames = allTags
        .filter((tag) => tag.postId === post.postId)
        .map((tag) => tag.tagName);
      return { ...post, tagNames };
    });

    return json({ data: formattedData, query, allTagsForSearch: formattedAllTagsForSearch });
  } else if (query === "" && tags.length === 0) {
    return json({ data: [], query, allTagsForSearch: formattedAllTagsForSearch });
  } else if (query === "" && tags.length > 0) {

    const baseTagData = await prisma.dimTags.findMany({
      select: {
        postId: true,
        tagName: true,
      },
      where: { tagName: { in: tags } },
    });

    const postIds = baseTagData.map((tag) => tag.postId);
    const allPosts = await prisma.userPostContent.findMany({
      select: {
        postId: true,
        postTitle: true,
        postDateJst: true,
        postUrl: true,
        countLikes: true,
        countDislikes: true,
      },
      where: { postId: { in: postIds } },
    });

    const allTags = await prisma.dimTags.findMany({
      select: {
        postId: true,
        tagName: true,
      },
      where: { postId: { in: allPosts.map((post) => post.postId) } },
    });

    const formattedData = allPosts.map((post) => {
      const tagNames = allTags
        .filter((tag) => tag.postId === post.postId)
        .map((tag) => tag.tagName);
      return { ...post, tagNames };
    });

    return json({ data: formattedData, query, allTagsForSearch: formattedAllTagsForSearch });
  } else if (query !== "" && tags.length > 0){
    const { data } = await supabase.rpc("search_post_contents", { keyword: query }) as { data: UserPostContentSearchResult[] };
    const fullTextSearchData = data.map((post) => {
      return {
        postId: post.postid,
        highlightedContent: MakeReadbleHighlightText(post.highlightedcontent)
      };
    });

    const postIdFromQuery = fullTextSearchData.map((post) => post.postId);

    const postIdIncluededInTags = await prisma.dimTags.findMany({
      select: {
        postId: true,
      },
      where: { tagName: { in: tags } },
    });

    const postIdFromTags = postIdIncluededInTags.map((tag) => tag.postId);

    const postIds = postIdFromQuery.filter((postId) => postIdFromTags.includes(postId));

    const allPosts = await prisma.userPostContent.findMany({
      select: {
        postId: true,
        postTitle: true,
        postDateJst: true,
        postUrl: true,
        countLikes: true,
        countDislikes: true,
      },
      where: { postId: { in: postIds } },
    });

    const allTags = await prisma.dimTags.findMany({
      select: {
        postId: true,
        tagName: true,
      },
      where: { postId: { in: allPosts.map((post) => post.postId) } },
    });

    const result = allPosts.map((post) => {
      const tagNames = allTags
        .filter((tag) => tag.postId === post.postId)
        .map((tag) => tag.tagName);
      const highlightedContent = fullTextSearchData.find((data) => data.postId === post.postId)?.highlightedContent;
      return { ...post, tagNames, highlightedContent };
    });

    return json({ data: result, query, allTagsForSearch: formattedAllTagsForSearch });
  }
  return json({ data: [], query, allTagsForSearch: formattedAllTagsForSearch });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const query = formData.get("q") || "";
  const tags = formData.getAll("tags") as string[];

  const encodedQuery = encodeURIComponent(query.toString());
  const encodedTags = tags.map((tag) => encodeURIComponent(tag)).join('+');

  if (query === "" && tags.length === 0) {
    return redirect("/search");
  }
  else if (query !== "" && tags.length === 0) {
    return redirect(`/search?q=${encodedQuery}`);
  }
  else if (query === "" && tags.length > 0) {
    return redirect(`/search?tags=${encodedTags}`);
  }
  else if (query !== "" && tags.length > 0) {
    return redirect(`/search?q=${encodedQuery}&tags=${encodedTags}`);
  }
};

function MakeReadbleHighlightText(htmlString: string): string {
  const highlightedText = htmlString.replace(/<span class=\\"keyword\\">(.*?)<\/span>/g, '<mark>$1</mark>');
  return highlightedText.slice(2, -2);
}

export default function Component() {
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, query, allTagsForSearch } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagInputValue, setTagInputValue] = useState<string>("");
  const [tagSearchSuggestions, setTagSearchSuggestions] = useState<Tag[]>([]);

  console.log("data", data)

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
        <div className="mt-4">
          <input
            type="text"
            value={tagInputValue}
            onChange={handleTagInputChange}
            className="border border-gray-300 rounded px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="タグを入力"
          />
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
                >x</button>
              </span>
            ))}
          </div>
        </div>
      </Form>
      {data && data.length > 0 ? (
        data.map((post: any) => (
            <PostCard
              postId={post.postId}
              postTitle={post.postTitle}
              postDateJst={post.postDateJst}
              postUrl={post.postUrl}
              tagNames={post.tagNames}
              countLikes={post.countLikes}
              countDislikes={post.countDislikes}
              highLightedText={post.highlightedContent}
              key={post.posturl}
            />
          ))
      ) : query ? (
        <p>検索結果がありません。</p>
      ) : null}
    </div>
  );
}
