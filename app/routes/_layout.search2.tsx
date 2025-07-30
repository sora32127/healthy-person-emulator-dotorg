import { useAtomValue } from "jotai";
import { useLoaderData } from "@remix-run/react";
import { LightSearchHandler,type SearchResult } from "~/modules/lightSearch.client";
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
            totalPages: 0
        },
        results: []
    });
    const [searchParams, setSearchParams] = useSearchParams();
    const query = searchParams.get("q") || "";
    const [inputValue, setInputValue] = useState(query);

    if (!searchAssetURL) {
        throw new Error("Search asset URL is not set");
    }
    if (!tagsAssetURL) {
        throw new Error("Tags asset URL is not set");
    }
    
    useEffect(() => {
        const initializeHandler = async () => {
            const handler = new LightSearchHandler(searchAssetURL, tagsAssetURL);
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
            executeSearch(query);
        }
    }, [isInitialized, lightSearchHandler, query]);
    
    const executeSearch = useCallback(async (query: string) => {
        if (lightSearchHandler && isInitialized) {
            try {
                const results = await lightSearchHandler.search(query);
                setSearchResults({
                    metadata: {
                        query: results.metadata.query,
                        count: results.metadata.count,
                        page: results.metadata.page,
                        totalPages: results.metadata.totalPages
                    },
                    results: results.results
                });
                if (searchParams.get("q") !== query) {
                    setSearchParams({ q: query });
                }
            } catch (error) {
                console.error("Search error:", error);
            }
        }
    }, [lightSearchHandler, isInitialized, searchParams, setSearchParams]);
    
    // debounceされた検索関数を作成
    const handleSearch = useCallback(
        debounce(async (query: string) => {
            await executeSearch(query);
        }, 1000),
        [executeSearch]
    );
    
    return (
        <div>
            <h1>Light Search</h1>
            <input
                type="text"
                onChange={(e) => {
                    setInputValue(e.target.value);
                    handleSearch(e.target.value);
                }}
                value={inputValue}
            ></input>
            {!isInitialized && <p>初期化中...</p>}
            <SearchResults searchResults={searchResults} />
        </div>
    );
}

function SearchResults({ searchResults }: { searchResults: SearchResult }) {
    return (
        <div>
            <p>Query: {searchResults?.metadata.query}</p>
            <p>Count: {searchResults?.metadata.count}</p>
            <p>Page: {searchResults?.metadata.page}</p>
            <p>Total Pages: {searchResults?.metadata.totalPages}</p>
            <div>
                {searchResults?.results.map((result) => (
                    <PostCard key={result.postId} {...result} tagNames={result.tags} />
                ))}
            </div>
        </div>
    );
}