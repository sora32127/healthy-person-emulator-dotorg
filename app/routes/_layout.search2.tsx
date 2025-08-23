import { useLoaderData } from "@remix-run/react";
import { getOrCreateHandler, LightSearchHandler, type SearchResult, type OrderBy } from "~/modules/lightSearch.client";
import { useEffect, useState, useCallback } from "react";
import { debounce } from "es-toolkit";
import PostCard from "~/components/PostCard";
import { useSearchParams } from "@remix-run/react";
import { Accordion, AccordionItem } from "~/components/Accordion";
import TagSelectionBox from "~/components/SubmitFormComponents/TagSelectionBox";
import { H1 } from "~/components/Headings";
import { useAtom } from "jotai";
import {
    searchResultsAtom,
} from "~/stores/search";
import { generateDownloadSignedUrl } from "~/modules/gcloud.server";


export async function loader() {
    const SEARCH_PARQUET_FILE_NAME = process.env.SEARCH_PARQUET_FILE_NAME;
    const TAGS_PARQUET_FILE_NAME_1 = process.env.TAGS_PARQUET_FILE_NAME_1;
    const TAGS_PARQUET_FILE_NAME_2 = process.env.TAGS_PARQUET_FILE_NAME_2;
    if (!SEARCH_PARQUET_FILE_NAME || !TAGS_PARQUET_FILE_NAME_1 || !TAGS_PARQUET_FILE_NAME_2) {
        throw new Error("Search or tags parquet file name is not set");
    }
    const searchAssetURL = await generateDownloadSignedUrl(SEARCH_PARQUET_FILE_NAME);
    const tagsAssetURL1 = await generateDownloadSignedUrl(TAGS_PARQUET_FILE_NAME_1);
    const tagsAssetURL2 = await generateDownloadSignedUrl(TAGS_PARQUET_FILE_NAME_2);
    return {
        searchAssetURL,
        tagsAssetURL1,
        tagsAssetURL2
    };
}

export default function LightSearch() {
    const { searchAssetURL, tagsAssetURL1, tagsAssetURL2 } = useLoaderData<typeof loader>();
    const [lightSearchHandler, setLightSearchHandler] = useState<LightSearchHandler | null>(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const [isInitialized, setIsInitialized] = useState(false);
    const [isAccordionOpen, setIsAccordionOpen] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [lastSearchParams, setLastSearchParams] = useState<string>("");
    
    // URL から現在の状態を取得
    const query = searchParams.get("q") || "";
    const currentPage = Number(searchParams.get("p")) || 1;
    const orderby = (searchParams.get("orderby") as OrderBy) || "timeDesc";
    const selectedTags = searchParams.get("tags")?.split(" ").filter(Boolean) || [];
    
    // UI用の状態（デバウンス検索用）
    const [inputValue, setInputValue] = useState(query);
    
    // 検索結果
    const [searchResults, setSearchResults] = useAtom(searchResultsAtom);

    if (!searchAssetURL) {
        throw new Error("Search asset URL is not set");
    }
    if (!tagsAssetURL1 || !tagsAssetURL2) {
        throw new Error("Tags asset URL is not set : ");
    }
    
    // 初期化処理
    useEffect(() => {
        const initializeHandler = async () => {
            const handler = getOrCreateHandler(searchAssetURL, tagsAssetURL1, tagsAssetURL2);
            setLightSearchHandler(handler);
            await handler.waitForInitialization();
            setIsInitialized(true);
        };
        
        initializeHandler();
    }, [searchAssetURL]);
    
    // URLパラメータが変更された時に入力フィールドを同期
    useEffect(() => {
        setInputValue(query);
    }, [query]);
    
    // URLパラメータ変更時に検索実行
    useEffect(() => {
        if (!isInitialized || !lightSearchHandler || isSearching) return;
        
        const currentSearchParams = JSON.stringify({ query, orderby, currentPage, selectedTags });
        if (currentSearchParams === lastSearchParams) return; // 前回と同じなら実行しない
        
        const executeSearch = async () => {
            setIsSearching(true);
            try {
                console.log("検索実行:", { query, orderby, currentPage, selectedTags });
                const results = await lightSearchHandler.search(query, orderby, currentPage, selectedTags);
                setSearchResults(results);
                setLastSearchParams(currentSearchParams);
            } catch (error) {
                console.error("Search error:", error);
            } finally {
                setIsSearching(false);
            }
        };
        
        executeSearch();
    }, [isInitialized, lightSearchHandler, query, orderby, currentPage, JSON.stringify(selectedTags), lastSearchParams]);
    
    // URL更新関数
    const updateSearchParams = useCallback((newQuery: string, newOrderby: OrderBy, newPage: number, newTags: string[]) => {
        const params = new URLSearchParams();
        if (newQuery) params.set("q", newQuery);
        if (newOrderby !== "timeDesc") params.set("orderby", newOrderby);
        if (newPage !== 1) params.set("p", newPage.toString());
        if (newTags.length > 0) params.set("tags", newTags.join(" "));
        setSearchParams(params, { preventScrollReset: true });
    }, [setSearchParams]);
    
    // デバウンス検索
    const debouncedSearch = useCallback(
        debounce((searchQuery: string) => {
            updateSearchParams(searchQuery, orderby, 1, selectedTags);
            // 検索実行時もページトップにスクロール
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 1000),
        [updateSearchParams, orderby, selectedTags]
    );
    
    // ハンドラー関数
    const handleSearch = (value: string) => {
        setInputValue(value);
        debouncedSearch(value);
    };
    
    const handleSortOrderChange = (newOrderby: OrderBy) => {
        updateSearchParams(query, newOrderby, 1, selectedTags);
        // 並び順変更時もページトップにスクロール
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handlePageChange = (newPage: number) => {
        console.log("ページ変更:", newPage);
        updateSearchParams(query, orderby, newPage, selectedTags);
        // ページトップにスクロール
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleTagsSelected = (newTags: string[]) => {
        updateSearchParams(query, orderby, 1, newTags);
        // タグ変更時もページトップにスクロール
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    
    return (
        <div>
            <H1>検索</H1>
            <div className="container">
                <div className="search-input">
                    <form onSubmit={(e) => e.preventDefault()}>
                        <input
                            type="text"
                            name="q"
                            placeholder="テキストを入力..."
                            className="input input-bordered w-full placeholder-slate-500"
                            onChange={(e) => handleSearch(e.target.value)}
                            value={inputValue}
                        />
                        <div className="my-4">
                            <Accordion>
                                <AccordionItem title="タグ選択" isOpen={isAccordionOpen} setIsOpen={setIsAccordionOpen}>
                                    <TagSelectionBox
                                        allTagsOnlyForSearch={searchResults.tagCounts}
                                        onTagsSelected={handleTagsSelected}
                                        parentComponentStateValues={selectedTags}
                                    />
                                </AccordionItem>
                            </Accordion>
                        </div>
                    </form>
                </div>
                <div className="search-results">
                    <div className="search-meta-data my-3 min-h-[80px]">
                        {!isInitialized ? (
                            <div className="flex justify-center items-center h-full">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"/>
                                <span className="ml-2">初期化中...</span>
                            </div>
                        ) : isSearching ? (
                            <div className="flex justify-center items-center h-full">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"/>
                                <span className="ml-2">検索中...</span>
                            </div>
                        ) : (searchResults.metadata.query !== "" || selectedTags.length > 0) ? (
                            <div className="h-full flex flex-col justify-center">
                                <p>検索結果: {searchResults.metadata.count}件</p>
                                {searchResults.metadata.query && <p className="truncate">キーワード: {searchResults.metadata.query}</p>}
                                {selectedTags.length > 0 && <p className="truncate">タグ: {selectedTags.join(", ")}</p>}
                                {searchResults.metadata.count === 0 && <p>検索結果がありません</p>}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col justify-center">
                                <p>検索キーワードを入力してください</p>
                            </div>
                        )}
                    </div>
                    <div className="search-sort-order py-2">
                        {searchResults.metadata.count > 0 && (
                            <select 
                                value={orderby} 
                                onChange={(e) => handleSortOrderChange(e.target.value as OrderBy)}
                                className="select select-bordered select-sm"
                            >
                                <option value="timeDesc">新着順</option>
                                <option value="timeAsc">古い順</option>
                                <option value="like">いいね順</option>
                            </select>
                        )}
                    </div>
                    <SearchResults searchResults={searchResults} />
                    <Pagination 
                        currentPage={currentPage}
                        totalPages={searchResults.metadata.totalPages}
                        onPageChange={handlePageChange}
                        totalCount={searchResults.metadata.count}
                    />
                </div>
            </div>
        </div>
    );
}

function SearchResults({ searchResults }: { searchResults: SearchResult }) {
    // 検索結果の表示は親コンポーネントのメタデータ部分で処理されるため、
    // ここでは結果リストのみを表示
    if (searchResults.metadata.count === 0) {
        return null;
    }

    return (
        <div className="search-results-container">
            {searchResults.results.map((result) => (
                <PostCard key={result.postId} {...result} />
            ))}
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