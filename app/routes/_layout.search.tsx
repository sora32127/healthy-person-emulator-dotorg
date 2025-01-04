import { useState, useEffect } from "react";
import { Form, useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import { redirect } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { H1 } from "~/components/Headings";
import PostCard  from "~/components/PostCard";
import { Accordion, AccordionItem } from "~/components/Accordion";
import TagSelectionBox from "~/components/SubmitFormComponents/TagSelectionBox";
import { getSearchResults, type SearchResults, type OrderBy } from "~/modules/search.server";
import type { PostCardData } from "~/modules/db.server";
import { commonMetaFunction } from "~/utils/commonMetafunction";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const pageNumber = Number.parseInt(url.searchParams.get("p") || "1");
  const orderby = (url.searchParams.get("orderby") || "timeDesc") as OrderBy;
  const searchQuery = url.searchParams.get("q") || "";
  const searchTags = url.searchParams.get("tags")?.split(" ") || [];
  const searchResults = await getSearchResults(searchQuery, searchTags, pageNumber, orderby ) as SearchResults;
  return searchResults;
}

export async function action({ request }: ActionFunctionArgs) {
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
  const searchResults = useLoaderData<typeof loader>();
  const SearchResults = searchResults as SearchResults;
  const [searchQuery, setSearchQuery] = useState(SearchResults.meta.searchParams.q);
  const [searchTags, setSearchTags] = useState<string[]>(SearchResults.meta.searchParams.tags);
  const [searchOrderby, setSearchOrderby] = useState<OrderBy>(SearchResults.meta.searchParams.orderby as OrderBy);
  const [isSearching, setIsSearching] = useState(false);
  const navigation = useNavigation();
  const submit = useSubmit();
  const [isAccordionOpen, setIsAccordionOpen] = useState(false);

  const currentPage = SearchResults.meta.searchParams.p;
  const totalPages = Math.ceil(SearchResults.meta.totalCount / 10); // 1ページあたり10件と仮定

  const handlePageChange = (action: string) => {
    const form = new FormData();
    setIsAccordionOpen(false);
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
    form.append("action", "firstSearch");
    form.append("currentPage", "1");
    form.append("query", searchQuery);
    form.append("tags", searchTags.join("+"));
    form.append("orderby", searchOrderby);
    submit(form, { method: "post" });
  }

  const handleTagsSelected = (newTags: string[]) => {
    setSearchTags(newTags);
    const form = new FormData();
    form.append("action", "firstSearch");
    form.append("currentPage", "1");
    form.append("query", searchQuery);
    form.append("tags", newTags.join("+"));
    form.append("orderby", searchOrderby);
    submit(form, { 
      method: "post",
      preventScrollReset: true
    });
  };

  useEffect(() => {
    const action = navigation.formData?.get("action")?.toString();
    setIsSearching(
      (navigation.state === "submitting" || navigation.state === "loading") && (action?.includes("Search") ?? false)
    );
  }, [navigation.state, navigation.formData]);

  return (
    <div>
      <H1>検索</H1>
      <div className="container">
        <div className="search-input">
          <Form method="post" action="/search" onSubmit={(event) => handleSearchSubmit(event)}>
            <input
              type="text"
              name="q"
              placeholder="テキストを入力..."
              className="input input-bordered w-full placeholder-slate-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="my-4">
              <Accordion>
                <AccordionItem title="タグ選択" isOpen={isAccordionOpen} setIsOpen={setIsAccordionOpen}>
                  <TagSelectionBox
                    allTagsOnlyForSearch={SearchResults.meta.tags}
                    onTagsSelected={handleTagsSelected}
                    parentComponentStateValues={searchTags}
                  />
                </AccordionItem>
              </Accordion>
            </div>
            <div className="flex justify-center md:justify-end">
              <button type="submit" className="btn btn-primary w-full md:w-1/5">検索</button>
            </div>
          </Form>
        </div>
        <div className="search-results">
        <div className="search-meta-data my-3 min-h-[80px]">
          {isSearching ? (
            <div className="flex justify-center items-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"/>
              <span className="ml-2">検索中...</span>
            </div>
          ) : (SearchResults.meta.searchParams.q !== "" || SearchResults.meta.searchParams.tags.length > 0) ? (
            <div className="h-full flex flex-col justify-center">
              <p>検索結果: {SearchResults.meta.totalCount}件</p>
              {SearchResults.meta.searchParams.q && <p className="truncate">キーワード: {SearchResults.meta.searchParams.q}</p>}
              {SearchResults.meta.searchParams.tags.length > 0 && <p className="truncate">タグ: {SearchResults.meta.searchParams.tags.join(", ")}</p>}
              {SearchResults.meta.totalCount === 0 && <p>検索結果がありません</p>}
            </div>
            ) : (
              <div/>
            )}
        </div>
          <div className="search-sort-order py-2">
            {SearchResults.meta.totalCount > 0 && (
            <select onChange={(e) => handleSortOrderChange(e.target.value as OrderBy)} className="select select-bordered select-sm">
              <option disabled selected>並び順を変更する</option>
              <option selected={searchOrderby === "timeDesc"} value="timeDesc">新着順</option>
              <option selected={searchOrderby === "timeAsc"} value="timeAsc">古い順</option>
              <option selected={searchOrderby === "like"} value="like">いいね順</option>
            </select>
            )}
          </div>
          <div className="search-results-container">
            {SearchResults.results.map((post: PostCardData) => (
              <PostCard
                key={post.postId}
                postId={post.postId}
                postTitle={post.postTitle}
                postDateGmt={post.postDateGmt}
                countLikes={post.countLikes}
                countDislikes={post.countDislikes}
                countComments={post.countComments}
                tagNames={post.tags.map((tag) => tag.tagName)}
              />
            ))}
          </div>
        </div>
        
        <div className="search-navigation flex justify-center my-4">
        { totalPages >= 1 && (
          <div className="join">
            <button
            className="join-item btn btn-lg"
            onClick={() => handlePageChange("firstPage")}
            disabled={currentPage === 1}
            type="submit"
          >
            «
          </button>
          <button
            className="join-item btn btn-lg"
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
            className="join-item btn btn-lg"
            onClick={() => handlePageChange("nextPage")}
            disabled={currentPage === totalPages}
            type="submit"
          >
            ›
          </button>
          <button
            className="join-item btn btn-lg"
            onClick={() => handlePageChange("lastPage")}
            disabled={currentPage === totalPages}
            type="submit"
          >
            »
          </button>
        </div>
      )}
      </div>
      </div>
    </div>
  )

}

export const meta: MetaFunction<typeof loader> = ({ data, location }) => {
  if (!data) {
  return [{ title: "Loading..." }];
  }

  const { tags, q, orderby, p } = data.meta.searchParams;
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
    pageTitle += ` ${convertOrderBy(orderby as OrderBy)}`;
  }
  if ((q === "") && (tags.length === 0)) pageTitle = "検索する";

  const commonMeta = commonMetaFunction({
    title: pageTitle,
    description: "検索",
    url: `https://healthy-person-emulator.org/search${location.search}`,
    image: null
  });

  return commonMeta;
};