import { useAtomValue } from "jotai";
import { useLoaderData } from "@remix-run/react";
import { LightSearchHandler,type SearchResult } from "~/modules/lightSearch.client";
import { useEffect, useState } from "react";
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

    if (!searchAssetURL) {
        throw new Error("Search asset URL is not set");
    }
    if (!tagsAssetURL) {
        throw new Error("Tags asset URL is not set");
    }
    
    useEffect(() => {
        const handler = new LightSearchHandler(searchAssetURL, tagsAssetURL);
        setLightSearchHandler(handler);
    }, [searchAssetURL]);
    
    const handleSearch = debounce(async (query: string) => {
        if (lightSearchHandler) {
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
            setSearchParams({ q: query });
        }
    }, 300);
    
    return (
        <div>
            <h1>Light Search</h1>
            <input type="text" onChange={(e) => handleSearch(e.target.value)}></input>
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