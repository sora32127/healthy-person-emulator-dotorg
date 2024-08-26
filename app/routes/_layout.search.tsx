import { useState } from "react";
import { Form, useFetcher, useLoaderData, useSubmit } from "@remix-run/react";
import type { ActionFunction, LoaderFunction, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { H1, H2 } from "~/components/Headings";
import PostCard, { type PostCardProps }  from "~/components/PostCard";
import TagSelectionBox from "~/components/SubmitFormComponents/TagSelectionBox";
import { getSearchResults, type SearchResults, type OrderBy } from "~/modules/search.server";
import type { PostCardData } from "~/modules/db.server";
import { Accordion, AccordionItem } from "~/components/Accordion";


export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const pageNumber = Number.parseInt(url.searchParams.get("p") || "1");
  const orderby = (url.searchParams.get("orderby") || "timeDesc") as OrderBy;
  const searchQuery = url.searchParams.get("q") || "";
  const searchTags = url.searchParams.get("tags")?.split(" ") || [];
  const searchResults = await getSearchResults(searchQuery, searchTags, pageNumber, orderby ) as SearchResults;
  return json({ searchResults });
}

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const action = formData.get("action");
  const currentPage = Number.parseInt(formData.get("currentPage") as string);
  const totalPages = Number.parseInt(formData.get("totalPages") as string);
  const tags = formData.get("tags")?.toString().split("+") ?? null;
  const query = formData.get("query")?.toString() ?? null;
  const orderby = formData.get("orderby") ?? "timeDesc";

  const encodedQueryString = query && query !== '' ? `&q=${encodeURIComponent(query)}` : "";
  const encodedTagsString =  tags && tags.filter(tag => tag !== '').length > 0 ? `&tags=${tags.map(tag => encodeURIComponent(tag)).join("+")}` : "";

  if (action === "firstSearch" || action === "firstPage") {
    return redirect(
      `/search?p=1&orderby=${orderby}${encodedQueryString}${encodedTagsString}`
    );
  }
  if (action === "prevPage") {
    return redirect(
      `/search?p=${currentPage - 1}&orderby=${orderby}${encodedQueryString}${encodedTagsString}`
    );
  }
  if (action === "nextPage") {
    return redirect(
      `/search?p=${currentPage + 1}&orderby=${orderby}${encodedQueryString}${encodedTagsString}`
    );
  }
  if (action === "lastPage") {
    return redirect(
      `/search?p=${totalPages}&orderby=${orderby}${encodedQueryString}${encodedTagsString}`
    );
  }
  return redirect("/search");
};

export default function SearchPage() {
  const { searchResults } = useLoaderData<typeof loader>();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTags, setSearchTags] = useState<string[]>([]);
  const SearchResults = searchResults as SearchResults;

  const submit = useSubmit();

  const currentPage = SearchResults.meta.searchParams.p;
  const totalPages = Math.ceil(SearchResults.meta.totalCount / 10); // 1ページあたり10件と仮定

  const handlePageChange = (action: string) => {
    const form = new FormData();
    form.append("action", action);
    form.append("currentPage", currentPage.toString());
    form.append("totalPages", totalPages.toString());
    form.append("query", searchQuery);
    form.append("tags", searchTags.join("+"));
    form.append("orderby", SearchResults.meta.searchParams.orderby);
    submit(form, { method: "post" });
  };

  
  return (
    <div>
      <H1>検索</H1>
      <div className="container mx-auto px-4">
        <div className="search-input">
          <Form method="get" action="/search">
            <input
              type="text"
              name="q"
              placeholder="検索"
              className="input input-bordered w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="my-4">
              <Accordion>
                <AccordionItem title="タグ選択">
                  <TagSelectionBox
                    allTagsOnlyForSearch={SearchResults.meta.tags}
                    onTagsSelected={setSearchTags}
                    parentComponentStateValues={searchTags}
                  />
                </AccordionItem>
              </Accordion>
            </div>
          </Form>
        </div>
        <div className="search-results">
          <div className="container mx-auto px-4">
            {SearchResults.results.map((post: PostCardData) => (
              <PostCard
                key={post.postId}
                postId={post.postId}
                postTitle={post.postTitle}
                postDateGmt={post.postDateGmt.toString()}
                countLikes={post.countLikes}
                countDislikes={post.countDislikes}
                countComments={post.countComments}
                tagNames={post.tags.map((tag) => tag.tagName)}
              />
            ))}
          </div>
        </div>
        <div className="search-navigation flex justify-center">
          <div className="join">
          <button
            className="join-item btn"
            onClick={() => handlePageChange("firstPage")}
            disabled={currentPage === 1}
            type="submit"
          >
            «
          </button>
          <button
            className="join-item btn"
            onClick={() => handlePageChange("prevPage")}
            disabled={currentPage === 1}
            type="submit"
          >
            ‹
          </button>
          <div className="join-item bg-base-200 font-bold text-lg flex items-center justify-center min-w-[100px]">
            {currentPage} / {totalPages}
          </div>
          <button
            className="join-item btn"
            onClick={() => handlePageChange("nextPage")}
            disabled={currentPage === totalPages}
            type="submit"
          >
            ›
          </button>
          <button
            className="join-item btn"
            onClick={() => handlePageChange("lastPage")}
            disabled={currentPage === totalPages}
            type="submit"
          >
            »
          </button>
        </div>
      </div>
      </div>
    </div>
  )

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