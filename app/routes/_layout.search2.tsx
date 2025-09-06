import { useLoaderData, Outlet, useNavigate, useLocation } from "@remix-run/react";
import { getOrCreateHandler, LightSearchHandler, type SearchResult, type OrderBy } from "~/modules/lightSearch.client";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
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
import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
    return [
        { title: "検索 | 健常者エミュレータ事例集" },
        { name: "description", content: "健常者エミュレータ事例集での記事検索ページです。キーワードやタグで記事を検索できます。" },
        { property: "og:title", content: "検索 | 健常者エミュレータ事例集" },
        { property: "og:description", content: "健常者エミュレータ事例集での記事検索ページです。キーワードやタグで記事を検索できます。" },
        { property: "og:type", content: "website" },
    ];
};

export async function loader() {
    const SEARCH_PARQUET_FILE_NAME = process.env.SEARCH_PARQUET_FILE_NAME;
    const TAGS_PARQUET_FILE_NAME = process.env.TAGS_PARQUET_FILE_NAME
    if (!SEARCH_PARQUET_FILE_NAME || !TAGS_PARQUET_FILE_NAME) {
        throw new Error("Search or tags parquet file name is not set");
    }
    const searchAssetURL = await generateDownloadSignedUrl(SEARCH_PARQUET_FILE_NAME);
    const tagsAssetURL = await generateDownloadSignedUrl(TAGS_PARQUET_FILE_NAME);
    return {
        searchAssetURL,
        tagsAssetURL,
    };
}

export default function LightSearch() {
    const { searchAssetURL, tagsAssetURL } = useLoaderData<typeof loader>();
    const [lightSearchHandler, setLightSearchHandler] = useState<LightSearchHandler | null>(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const [isInitialized, setIsInitialized] = useState(false);
    const [isAccordionOpen, setIsAccordionOpen] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [hasInitialSearchCompleted, setHasInitialSearchCompleted] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    
    // 記事表示用の状態
    const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
    
    // URL から現在の状態を取得
    const query = searchParams.get("q") || "";
    const orderby = (searchParams.get("orderby") as OrderBy) || "timeDesc";
    const selectedTags = searchParams.get("tags")?.split(" ").filter(Boolean) || [];
    const pageSize = Number(searchParams.get("pageSize")) || 10;
    const postId = searchParams.get("postId") || null;
    
    // UI用の状態（デバウンス検索用）
    const [inputValue, setInputValue] = useState(query);
    
    // 検索結果と無限スクロール状態
    const [searchResults, setSearchResults] = useAtom(searchResultsAtom);
    const [allResults, setAllResults] = useState<SearchResult["results"]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [searchKey, setSearchKey] = useState("");

    if (!searchAssetURL || !tagsAssetURL) {
        throw new Error("Search or tags asset URL is not set");
    }

    // スクロール復元を有効にする
    useEffect(() => {
        if (history.scrollRestoration) {
            history.scrollRestoration = 'manual';
        }
        return () => {
            if (history.scrollRestoration) {
                history.scrollRestoration = 'auto';
            }
        };
    }, []);

    // URLのpostIdパラメータと状態を同期
    useEffect(() => {
        setSelectedPostId(postId);
    }, [postId]);
    
    // 初期化処理
    useEffect(() => {
        const initializeHandler = async () => {
            const handler = await getOrCreateHandler(searchAssetURL, tagsAssetURL);
            setLightSearchHandler(handler);
            setIsInitialized(true);
        };
        
        initializeHandler();
    }, [searchAssetURL, tagsAssetURL]);
    
    // URLパラメータが変更された時に入力フィールドを同期
    useEffect(() => {
        setInputValue(query);
    }, [query]);
    
    // 検索キーの生成（検索条件が変わったかを判定）
    const newSearchKey = useMemo(() => 
        JSON.stringify({ query, orderby, selectedTags: selectedTags.sort(), pageSize })
    , [query, orderby, selectedTags, pageSize]);
    
    // 検索実行関数
    const performSearch = useCallback(async (page: number, isNewSearch: boolean = false) => {
        if (!lightSearchHandler) return null;
        
        try {
            const results = await lightSearchHandler.search(query, orderby, page, selectedTags, pageSize);
            return results;
        } catch (error) {
            console.error("Search error:", error);
            throw error;
        }
    }, [lightSearchHandler, query, orderby, selectedTags, pageSize]);
    
    // 検索条件変更時の初期検索
    useEffect(() => {
        if (!isInitialized || !lightSearchHandler) return;
        
        // 検索条件が変わった場合
        if (newSearchKey !== searchKey) {
            setIsSearching(true);
            setAllResults([]);
            setCurrentPage(1);
            setSearchKey(newSearchKey);
            
            performSearch(1, true)
                .then(results => {
                    if (results) {
                        setAllResults(results.results);
                        setSearchResults(results);
                        setHasMore(results.metadata.totalPages > 1);
                        setCurrentPage(1);
                        
                        if (!hasInitialSearchCompleted) {
                            setHasInitialSearchCompleted(true);
                        }
                    }
                })
                .catch(error => {
                    console.error("Initial search failed:", error);
                })
                .finally(() => {
                    setIsSearching(false);
                });
        }
    }, [isInitialized, lightSearchHandler, newSearchKey, searchKey, performSearch, hasInitialSearchCompleted, setSearchResults]);
    
    // 次のページを読み込む
    const loadMore = useCallback(async () => {
        if (isLoadingMore || !hasMore || !lightSearchHandler) return;
        
        const nextPage = currentPage + 1;
        
        setIsLoadingMore(true);
        
        try {
            const results = await performSearch(nextPage);
            if (results && results.results.length > 0) {
                // 重複を防いで結果を追加
                setAllResults(prev => {
                    const existingIds = new Set(prev.map(r => r.postId));
                    const newResults = results.results.filter(r => !existingIds.has(r.postId));
                    return [...prev, ...newResults];
                });
                
                // searchResultsも更新（現在の全結果を反映）
                setSearchResults(prev => ({
                    ...results,
                    results: prev ? [...prev.results.filter(r => 
                        !results.results.some(newR => newR.postId === r.postId)
                    ), ...results.results] : results.results
                }));
                
                setCurrentPage(nextPage);
                setHasMore(nextPage < results.metadata.totalPages);
            } else {
                setHasMore(false);
            }
        } catch (error) {
            console.error("Load more failed:", error);
        } finally {
            setIsLoadingMore(false);
        }
    }, [isLoadingMore, hasMore, lightSearchHandler, currentPage, performSearch, setSearchResults]);
    
    // URL更新関数
    const updateSearchParams = useCallback((newQuery: string, newOrderby: OrderBy, newTags: string[], newPostId?: string | null) => {
        const params = new URLSearchParams();
        if (newQuery) params.set("q", newQuery);
        if (newOrderby !== "timeDesc") params.set("orderby", newOrderby);
        if (newTags.length > 0) params.set("tags", newTags.join(" "));
        if (newPostId) params.set("postId", newPostId);
        setSearchParams(params, { preventScrollReset: true });
    }, [setSearchParams]);
    
    // デバウンス検索
    const debouncedSearch = useMemo(() => 
        debounce((searchQuery: string, currentOrderby: OrderBy, currentSelectedTags: string[]) => {
            updateSearchParams(searchQuery, currentOrderby, currentSelectedTags);
        }, 1000),
        []
    );
    
    // ハンドラー関数
    const handleSearch = useCallback((value: string) => {
        setInputValue(value);
        debouncedSearch(value, orderby, selectedTags);
    }, [debouncedSearch, orderby, selectedTags]);
    
    const handleSortOrderChange = useCallback((newOrderby: OrderBy) => {
        updateSearchParams(query, newOrderby, selectedTags);
    }, [updateSearchParams, query, selectedTags]);

    const handleTagsSelected = useCallback((newTags: string[]) => {
        updateSearchParams(query, orderby, newTags);
    }, [updateSearchParams, query, orderby]);

    // 記事選択ハンドラー（ナビゲーションを使用）
    const navigate = useNavigate();
    const location = useLocation();

    const handlePostSelect = useCallback((postId: string) => {
        const searchParamsObj = new URLSearchParams(location.search);
        navigate(`/search2/${postId}?${searchParamsObj.toString()}`);
    }, [navigate, location.search]);

    // 検索画面に戻るハンドラー
    const handleBackToSearch = useCallback(() => {
        const searchParamsObj = new URLSearchParams(location.search);
        searchParamsObj.delete("postId");
        // history.back()を使ってブラウザのスクロール復元機能を活用
        if (window.history.length > 1) {
            window.history.back();
        } else {
            navigate(`/search2?${searchParamsObj.toString()}`);
        }
    }, [navigate, location.search]);

    // 現在記事が選択されているかどうか
    const isPostSelected = location.pathname.includes("/search2/");
    
    return (
        <div className="md:flex md:h-screen">
            {/* 検索結果パネル */}
            <div className={`${isPostSelected ? 'md:w-1/2 hidden md:block' : 'w-full'} transition-all duration-300 overflow-y-auto pr-2`}>
                <div>
                    <H1>検索</H1>
                    <div className="container">
                        <div className="search-input" style={{ minHeight: hasInitialSearchCompleted ? 'auto' : '300px', display: 'flex', alignItems: hasInitialSearchCompleted ? 'stretch' : 'center', justifyContent: hasInitialSearchCompleted ? 'stretch' : 'center' }}>
                            {!hasInitialSearchCompleted ? (
                                <div className="search-initialization text-center">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"/>
                                    <span className="text-lg block">検索システムを初期化中...</span>
                                    <p className="text-sm text-gray-500 mt-2">初期化完了まで少々お待ちください</p>
                                </div>
                            ) : (
                                <div className="search-input-form w-full">
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
                            )}
                        </div>
                        {hasInitialSearchCompleted && (
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
                                        <p>検索結果: {searchResults.metadata.count}件 (表示中: {allResults.length}件)</p>
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
                            <div className="search-sort-order py-2 flex gap-2 items-center">
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
                            <InfiniteScrollResults 
                                allResults={allResults} 
                                hasMore={hasMore}
                                isLoading={isLoadingMore}
                                onLoadMore={loadMore}
                                onPostSelect={handlePostSelect}
                                selectedPostId={selectedPostId}
                            />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 記事表示パネル（Outlet使用） */}
            {isPostSelected && (
                <div className="w-full md:w-1/2 md:border-l border-neutral overflow-y-auto relative">
                    {/* 戻るボタン - モバイルでは通常位置、デスクトップでは絶対位置 */}
                    <div className="md:absolute md:top-4 md:left-4 md:z-10 block md:block p-4 md:p-0">
                        <button 
                            onClick={handleBackToSearch}
                            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors bg-white px-3 py-1 rounded-full shadow-md"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            検索に戻る
                        </button>
                    </div>
                    <div className="p-4 md:pt-4">
                        <Outlet />
                    </div>
                </div>
            )}
        </div>
    );
}

function InfiniteScrollResults({ 
    allResults, 
    hasMore, 
    isLoading, 
    onLoadMore,
    onPostSelect,
    selectedPostId
}: { 
    allResults: SearchResult["results"];
    hasMore: boolean;
    isLoading: boolean;
    onLoadMore: () => void;
    onPostSelect: (postId: string) => void;
    selectedPostId: string | null;
}) {
    const observerRef = useRef<IntersectionObserver>();
    const loadMoreRef = useRef<HTMLDivElement>(null);
    
    // IntersectionObserver の設定
    useEffect(() => {
        if (!loadMoreRef.current || isLoading || !hasMore) return;
        
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    onLoadMore();
                }
            },
            {
                threshold: 0,
                rootMargin: '100px'
            }
        );
        
        observer.observe(loadMoreRef.current);
        observerRef.current = observer;
        
        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, [onLoadMore, isLoading, hasMore]);

    if (allResults.length === 0) {
        return null;
    }

    return (
        <div className="infinite-scroll-results">
            {/* 検索結果のリスト */}
            <div className="results-list">
                {allResults.map((result) => (
                    <div key={result.postId} 
                         className={`cursor-pointer transition-colors ${
                             selectedPostId === result.postId.toString() ? 'bg-blue-50' : 'hover:bg-gray-50'
                         }`}
                         onClick={() => onPostSelect(result.postId.toString())}>
                        <PostCard {...result} />
                    </div>
                ))}
            </div>
            
            {/* ローディングトリガー */}
            {hasMore && (
                <div 
                    ref={loadMoreRef}
                    className="loading-trigger flex justify-center py-8"
                >
                    {isLoading ? (
                        <div className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"/>
                            <span className="text-gray-600">読み込み中...</span>
                        </div>
                    ) : (
                        <div className="text-gray-400">
                            ここまで読み込みました
                        </div>
                    )}
                </div>
            )}
            
            {/* 読み込み完了メッセージ */}
            {!hasMore && allResults.length > 0 && (
                <div className="text-center py-8">
                    <div className="text-gray-500">すべての結果を表示しました</div>
                    <div className="text-sm text-gray-400 mt-1">({allResults.length}件)</div>
                </div>
            )}
        </div>
    );
}