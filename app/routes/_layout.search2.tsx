import { useLoaderData } from "@remix-run/react";
import { getOrCreateHandler, LightSearchHandler, type SearchResult, type OrderBy } from "~/modules/lightSearch.client";
import { useEffect, useState, useCallback } from "react";
import { debounce } from "es-toolkit";
import PostCard from "~/components/PostCard";
import { useSearchParams } from "@remix-run/react";
import { Accordion, AccordionItem } from "~/components/Accordion";
import TagSelectionBox from "~/components/SubmitFormComponents/TagSelectionBox";

export async function loader() {
    const searchAssetURL = process.env.SEARCH_PARQUET_FILE_PATH
    return {
        searchAssetURL,
    };
}

export default function LightSearch() {
    const { searchAssetURL } = useLoaderData<typeof loader>();
    const [lightSearchHandler, setLightSearchHandler] = useState<LightSearchHandler | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [searchResults, setSearchResults] = useState<SearchResult>({
        metadata: {
            query: "",
            count: 0,
            page: 1,
            totalPages: 0,
            orderby: "timeDesc"
        },
        tagCounts: [],
        results: []
    });
// ... existing code ...
const [searchParams, setSearchParams] = useSearchParams();
const query = searchParams.get("q") || "";
const orderby = searchParams.get("orderby") as OrderBy || "timeDesc";
const page = Number(searchParams.get("p")) || 1;
const tags = searchParams.get("tags")?.split(" ") || [];
const [inputValue, setInputValue] = useState(query);
const [currentOrderby, setCurrentOrderby] = useState<OrderBy>(orderby);
const [currentPage, setCurrentPage] = useState(page);
const [selectedTags, setSelectedTags] = useState<string[]>(tags);
const [isAccordionOpen, setIsAccordionOpen] = useState(false);

    if (!searchAssetURL) {
        throw new Error("Search asset URL is not set");
    }
    
    useEffect(() => {
        const initializeHandler = async () => {
            const handler = getOrCreateHandler(searchAssetURL);
            setLightSearchHandler(handler);
            // 初期化完了を待つ
            await handler.waitForInitialization();
            setIsInitialized(true);
        };
        
        initializeHandler();
    }, [searchAssetURL]);
    
    // 初回レンダリング時の検索実行
    useEffect(() => {
        if (isInitialized && lightSearchHandler && query) {
            executeSearch(query, currentOrderby, currentPage, selectedTags);
        }
    }, [isInitialized, lightSearchHandler, query, currentOrderby, currentPage, selectedTags]);
    
    // URL パラメータの管理
    const updateSearchParams = (query: string, orderby: OrderBy, page: number, tags: string[] = []) => {
        const params = new URLSearchParams();
        if (query) params.set("q", query);
        params.set("orderby", orderby);
        params.set("p", page.toString());
        if (tags.length > 0) {
            params.set("tags", tags.join(" "));
        }
        setSearchParams(params);
    };
    
    useEffect(() => {
        if (orderby !== currentOrderby) {
            setCurrentOrderby(orderby);
        }
        if (page !== currentPage) {
            setCurrentPage(page);
        }
        // タグ状態の復元
        if (tags.length > 0 && selectedTags.length === 0) {
            setSelectedTags(tags);
        }
    }, [orderby, page, tags]);
    
    // executeSearch関数を修正
    const executeSearch = useCallback(async (query: string, orderby: OrderBy, page: number, tags: string[] = []) => {
        if (lightSearchHandler && isInitialized) {
            try {
                const results = await lightSearchHandler.search(query, orderby, page);
                setSearchResults({
                    metadata: {
                        query: results.metadata.query,
                        count: results.metadata.count,
                        page: results.metadata.page,
                        totalPages: results.metadata.totalPages,
                        orderby: results.metadata.orderby
                    },
                    tagCounts: results.tagCounts,
                    results: results.results
                });
                updateSearchParams(query, orderby, page, tags); // タグパラメータを追加
            } catch (error) {
                console.error("Search error:", error);
            }
        }
    }, [lightSearchHandler, isInitialized]);
    
    // handleSearch関数を修正
    const handleSearch = useCallback(
        debounce(async (query: string, orderby: OrderBy) => {
            await executeSearch(query, orderby, 1, selectedTags); // タグパラメータを追加
        }, 1000),
        [executeSearch, selectedTags] // selectedTagsを依存配列に追加
    );
    
    // handleSortOrderChange関数を修正
    const handleSortOrderChange = (newOrderby: OrderBy) => {
        setCurrentOrderby(newOrderby);
        // 並び順変更時は1ページ目に戻る
        executeSearch(inputValue, newOrderby, 1, selectedTags); // タグパラメータを追加
    };

    // handlePageChange関数を修正
    const handlePageChange = (newPage: number) => {
        setCurrentPage(newPage);
        executeSearch(inputValue, currentOrderby, newPage, selectedTags); // タグパラメータを追加
    };

    // handleTagsSelected関数を修正
    const handleTagsSelected = (newTags: string[]) => {
        setSelectedTags(newTags);
        // とりあえず既存のsearchメソッドを呼び出す（タグは無視）
        executeSearch(inputValue, currentOrderby, 1, newTags); // タグパラメータを追加
    };
    
    return (
        <div>
            <h1>Light Search</h1>
            <input
                type="text"
                onChange={(e) => {
                    setInputValue(e.target.value);
                    handleSearch(e.target.value, currentOrderby);
                }}
                value={inputValue}
            ></input>
            <div className="my-4">
                <Accordion>
                    <AccordionItem title="タグ選択" isOpen={isAccordionOpen} setIsOpen={setIsAccordionOpen}>
                        <TagSelectionBox
                            allTagsOnlyForSearch={[
                                {tagName: "test", count: 10},
                                {tagName: "test2", count: 20},
                                {tagName: "test3", count: 30},
                            ]}
                            onTagsSelected={handleTagsSelected}
                            parentComponentStateValues={selectedTags}
                        />
                    </AccordionItem>
                </Accordion>
            </div>
            {searchResults.metadata.count > 0 && (
                <div className="search-sort-order py-2">
                    <select 
                        value={currentOrderby} 
                        onChange={(e) => handleSortOrderChange(e.target.value as OrderBy)}
                        className="select select-bordered select-sm"
                    >
                        <option value="timeDesc">新着順</option>
                        <option value="timeAsc">古い順</option>
                        <option value="like">いいね順</option>
                    </select>
                </div>
            )}
            {!isInitialized && <p>初期化中...</p>}
            <SearchResults searchResults={searchResults} />
            <Pagination 
                currentPage={searchResults.metadata.page}
                totalPages={searchResults.metadata.totalPages}
                onPageChange={handlePageChange}
                totalCount={searchResults.metadata.count}
            />
        </div>
    );
}

function SearchResults({ searchResults }: { searchResults: SearchResult }) {
    function convertOrderBy(orderby: OrderBy) {
        switch (orderby) {
            case "timeDesc": return "新着順";
            case "timeAsc": return "古い順";
            case "like": return "いいね順";
        }
    }

    // 検索が実行されていない場合
    if (!searchResults.metadata.query && searchResults.metadata.count === 0) {
        return (
            <div className="search-results">
                <p>検索キーワードを入力してください</p>
            </div>
        );
    }

    // 検索結果が0件の場合
    if (searchResults.metadata.query && searchResults.metadata.count === 0) {
        return (
            <div className="search-results">
                <div className="search-meta-data my-3 min-h-[80px]">
                    <div className="h-full flex flex-col justify-center">
                        <p>検索結果: 0件</p>
                        <p className="truncate">キーワード: {searchResults.metadata.query}</p>
                        <p>検索結果がありません</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="search-results">
            <div className="search-meta-data my-3 min-h-[80px]">
                <div className="h-full flex flex-col justify-center">
                    <p>検索結果: {searchResults.metadata.count}件</p>
                    <p className="truncate">キーワード: {searchResults.metadata.query}</p>
                    <p>ページ: {searchResults.metadata.page} / {searchResults.metadata.totalPages}</p>
                    <p>並び順: {convertOrderBy(searchResults.metadata.orderby)}</p>
                </div>
            </div>
            <div className="search-results-container">
                {searchResults.results.map((result) => (
                    <PostCard key={result.postId} {...result} />
                ))}
            </div>
        </div>
    );
}

function Pagination({ 
    currentPage, 
    totalPages, 
    onPageChange, 
    totalCount 
}: { 
    currentPage: number; 
    totalPages: number; 
    onPageChange: (page: number) => void;
    totalCount: number;
}) {
    if (totalCount === 0) return null;

    return (
        <div className="search-navigation flex justify-center my-4">
            {totalPages >= 1 && (
                <div className="join">
                    <button
                        className="join-item btn btn-lg"
                        onClick={() => onPageChange(1)}
                        disabled={currentPage === 1}
                        type="button"
                    >
                        «
                    </button>
                    <button
                        className="join-item btn btn-lg"
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        type="button"
                    >
                        ‹
                    </button>
                    <div className="join-item bg-base-200 font-bold text-lg flex items-center justify-center min-w-[100px]">
                        {currentPage} / {totalPages}
                    </div>
                    <button
                        className="join-item btn btn-lg"
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        type="button"
                    >
                        ›
                    </button>
                    <button
                        className="join-item btn btn-lg"
                        onClick={() => onPageChange(totalPages)}
                        disabled={currentPage === totalPages}
                        type="button"
                    >
                        »
                    </button>
                </div>
            )}
        </div>
    );
}