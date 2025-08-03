import { useLoaderData } from "@remix-run/react";
import { getOrCreateHandler, LightSearchHandler, type SearchResult, type OrderBy } from "~/modules/lightSearch.client";
import { useEffect, useState, useCallback } from "react";
import { debounce } from "es-toolkit";
import PostCard from "~/components/PostCard";
import { useSearchParams } from "@remix-run/react";

export async function loader() {
    const searchAssetURL = process.env.SEARCH_PARQUET_FILE_PATH
    const tagsAssetURL = process.env.TAGS_PARQUET_FILE_PATH
    return {
        searchAssetURL,
        tagsAssetURL
    };
}

export default function LightSearch() {
    const { searchAssetURL, tagsAssetURL } = useLoaderData<typeof loader>();
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
        results: []
    });
    const [searchParams, setSearchParams] = useSearchParams();
    const query = searchParams.get("q") || "";
    const orderby = searchParams.get("orderby") as OrderBy || "timeDesc";
    const [inputValue, setInputValue] = useState(query);
    const [currentOrderby, setCurrentOrderby] = useState<OrderBy>(orderby);

    if (!searchAssetURL) {
        throw new Error("Search asset URL is not set");
    }
    if (!tagsAssetURL) {
        throw new Error("Tags asset URL is not set");
    }
    
    useEffect(() => {
        const initializeHandler = async () => {
            const handler = getOrCreateHandler(searchAssetURL, tagsAssetURL);
            setLightSearchHandler(handler);
            // 初期化完了を待つ
            await handler.waitForInitialization();
            setIsInitialized(true);
        };
        
        initializeHandler();
    }, [searchAssetURL, tagsAssetURL]);
    
    // 初回レンダリング時の検索実行
    useEffect(() => {
        if (isInitialized && lightSearchHandler && query) {
            executeSearch(query, currentOrderby);
        }
    }, [isInitialized, lightSearchHandler, query]);
    
    // URL パラメータの管理
    const updateSearchParams = (query: string, orderby: OrderBy) => {
        const params = new URLSearchParams();
        if (query) params.set("q", query);
        params.set("orderby", orderby);
        setSearchParams(params);
    };
    
    // URLパラメータの初期化
    useEffect(() => {
        if (orderby !== currentOrderby) {
            setCurrentOrderby(orderby);
        }
    }, [orderby]);
    
    const executeSearch = useCallback(async (query: string, orderby: OrderBy) => {
        if (lightSearchHandler && isInitialized) {
            try {
                const results = await lightSearchHandler.search(query, orderby);
                setSearchResults({
                    metadata: {
                        query: results.metadata.query,
                        count: results.metadata.count,
                        page: results.metadata.page,
                        totalPages: results.metadata.totalPages,
                        orderby: results.metadata.orderby
                    },
                    results: results.results
                });
                updateSearchParams(query, orderby);
            } catch (error) {
                console.error("Search error:", error);
            }
        }
    }, [lightSearchHandler, isInitialized]);
    
    // debounceされた検索関数を作成
    const handleSearch = useCallback(
        debounce(async (query: string, orderby: OrderBy) => {
            await executeSearch(query, orderby);
        }, 1000),
        [executeSearch]
    );
    
    const handleSortOrderChange = (newOrderby: OrderBy) => {
        setCurrentOrderby(newOrderby);
        // 直接検索を実行（デバウンスなし）
        executeSearch(inputValue, newOrderby);
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

    return (
        <div>
            <p>Query: {searchResults?.metadata.query}</p>
            <p>Count: {searchResults?.metadata.count}</p>
            <p>Page: {searchResults?.metadata.page}</p>
            <p>Total Pages: {searchResults?.metadata.totalPages}</p>
            <p>Sort: {convertOrderBy(searchResults?.metadata.orderby)}</p>
            <div>
                {searchResults?.results.map((result) => (
                    <PostCard key={result.postId} {...result} />
                ))}
            </div>
        </div>
    );
}