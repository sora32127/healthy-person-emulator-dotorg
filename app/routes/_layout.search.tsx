import { useState } from "react";
import { Form, useLoaderData, useSubmit } from "@remix-run/react";
import { json, redirect } from "@remix-run/node";
import type { ActionFunction, LoaderFunction, MetaFunction } from "@remix-run/node";
import { H1 } from "~/components/Headings";
import PostCard  from "~/components/PostCard";
import { Accordion, AccordionItem } from "~/components/Accordion";
import TagSelectionBox from "~/components/SubmitFormComponents/TagSelectionBox";
import { getSearchResults, type SearchResults, type OrderBy } from "~/modules/search.server";
import type { PostCardData } from "~/modules/db.server";

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
  /*
  - 全角空白の場合は%E3%80%80としてエンコードされ、半角空白の場合は%20としてエンコードされるが、このブレを吸収する仕組みをaction関数内部で実装する
  - この実装がないと、検索結果にブレが生じてしまい、「全角空白で区切るか半角空白で区切るか」で検索結果が変わってしまう
  */
  const normalizeSpaces = (str: string) => str.replace(/[\s　]+/g, ' ').trim();

  const encodedQueryString = query && query !== '' ? `&q=${encodeURIComponent(normalizeSpaces(query))}` : "";
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
  const SearchResults = searchResults as SearchResults;
  const [searchQuery, setSearchQuery] = useState(SearchResults.meta.searchParams.q);
  const [searchTags, setSearchTags] = useState<string[]>(SearchResults.meta.searchParams.tags);
  const [searchOrderby, setSearchOrderby] = useState<OrderBy>(SearchResults.meta.searchParams.orderby as OrderBy);
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

  const handleSortOrderChange = (orderby: OrderBy) => {
    // 並び順を変更する場合、実質最初のページに戻るのと同じなので、actionをfirstSearchにする
    const form = new FormData();
    form.append("action", "firstSearch");
    form.append("currentPage", "1");
    form.append("totalPages", totalPages.toString());
    form.append("query", searchQuery);
    form.append("tags", searchTags.join("+"));
    form.append("orderby", orderby);
    submit(form, { method: "post" });
  };

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData();
    console.log(searchQuery, searchTags, searchOrderby);
    form.append("action", "firstSearch");
    form.append("currentPage", "1");
    form.append("query", searchQuery);
    form.append("tags", searchTags.join("+"));
    form.append("orderby", searchOrderby);
    submit(form, { method: "post" });
  }
  
  return (
    <div>
      <H1>検索</H1>
      <div className="container mx-auto px-4">
        <div className="search-input">
          <Form method="post" action="/search" onSubmit={(event) => handleSearchSubmit(event)}>
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
            <div className="flex justify-center md:justify-end">
              <button type="submit" className="btn btn-primary">検索</button>
            </div>
          </Form>
        </div>
        <div className="search-results">
          <div className="search-meta-data">
            <p>検索結果: {SearchResults.meta.totalCount}件</p>
            {SearchResults.meta.searchParams.q && <p>キーワード: {SearchResults.meta.searchParams.q}</p>}
            {SearchResults.meta.searchParams.tags.length > 0 && <p>タグ: {SearchResults.meta.searchParams.tags.join(", ")}</p>}
          </div>
          <div className="search-sort-order py-2">
            <select onChange={(e) => handleSortOrderChange(e.target.value as OrderBy)} className="select select-bordered select-sm">
              <option disabled selected>並び順を変更する</option>
              <option value="timeDesc">新着順</option>
              <option value="timeAsc">古い順</option>
              <option value="like">いいね順</option>
            </select>
          </div>
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

  const { tags, q, orderby, p } = data.searchResults.meta.searchParams;
  function convertOrderBy(orderby: OrderBy) {
    switch (orderby) {
      case "timeDesc":
        return "新着順";
      case "timeAsc":
        return "古い順";
      case "like":
        return "いいね順";
    }
  }

  let pageTitle = "検索結果";
  if (q) {
    pageTitle += ` キーワード: ${q}`;
  }
  if (tags && tags.length > 0) {
    pageTitle += " タグ"
    pageTitle += `: ${tags.join(", ")}`;
  }
  if (p) {
    pageTitle += ` ページ: ${p}`;
  }
  if (orderby) {
    pageTitle += ` ${convertOrderBy(orderby)}`;
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