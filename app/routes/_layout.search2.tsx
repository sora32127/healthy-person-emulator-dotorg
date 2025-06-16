import { useFetcher, useLoaderData } from "@remix-run/react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import {
  useDownloadFile,
  search,
  initializeDuckDB,
  getObjectUrls,
  useDebouncedSearch,
  type SearchResult
} from "../search/useDuckdb";
import * as duckdb from '@duckdb/duckdb-wasm';
import { useEffect, useState } from "react";

export async function loader({ request }: LoaderFunctionArgs) {
    const { searchURL, tagsURL } = getObjectUrls();
    const url = new URL(request.url);
    const q = url.searchParams.get("q") || "";
    return {
        searchURL,
        tagsURL,
        q,
    }
}

export default function Search2() {
    const { searchURL, tagsURL, q } = useLoaderData<typeof loader>();
    const { data: searchData, error: searchError, isLoading: searchLoading } = useDownloadFile(searchURL);
    const { data: tagsData, error: tagsError, isLoading: tagsLoading } = useDownloadFile(tagsURL);
    const [isInitializationCompleted, setIsInitializationCompleted] = useState(false);
    const [query, setQuery] = useState(q);
    const [db, setDb] = useState<duckdb.AsyncDuckDB | null>(null);
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

    // useDebouncedSearchを一度だけ呼び出してdebouncedSearchに格納
    const debouncedSearch = useDebouncedSearch(db, setSearchResults, setQuery);

    useEffect(() => {
        if (!searchLoading && !tagsLoading && searchData && tagsData) {
            initializeDuckDB(searchData, tagsData).then((db) => {
                setIsInitializationCompleted(true);
                setDb(db);
            });
        }
    }, [searchLoading, tagsLoading, searchData, tagsData]);

    return <div>
        {!isInitializationCompleted && <div>Loading...</div>}
        {isInitializationCompleted && <div>
            <input type="text" value={query} onChange={(e) => debouncedSearch(e.target.value)} />
            {searchResults.map((result) => (
                <div key={result.query}>
                    <h3>{result.query}</h3>
                    <p>{result.totalPages}</p>
                </div>
            ))}
        </div>}
    </div>;
}
