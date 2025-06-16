import useSWR from 'swr';
import * as duckdb from '@duckdb/duckdb-wasm';
import { debounce } from "es-toolkit";
import type { PostCardData } from "~/modules/db.server";

export type SearchResult = {
    query: string;
    tags: string[];
    orderby: string;
    page: number;
    totalPages: number;
    results: PostCardData[];
};

export function getObjectUrls(): {
    searchURL: string;
    tagsURL: string;
} {
    const searchURL = process.env.SEARCH_PARQUET_FILE_PATH;
    const tagsURL = process.env.TAGS_PARQEST_FILE_PATH;
    if (!searchURL || !tagsURL) {
        throw new Error("SEARCH_PARQUET_URL or TAGS_PARQUET_URL is not set");
    }
    return {
        searchURL,
        tagsURL,
    };
}

export function useDownloadFile(url: string) {
    const fetcher = (url: string) => fetch(url).then(res => res.blob());
    const { data, error, isLoading } = useSWR(url, fetcher);
    return { data, error, isLoading };
}

export async function search(db: duckdb.AsyncDuckDB, query: string): Promise<SearchResult> {
    const conn = await db.connect();
    const result = (await conn.query(`SELECT * FROM search WHERE post_title LIKE '%${query}%'`)).toArray();
    return {
        query: query,
        tags: [],
        orderby: "",
        page: 1,
        totalPages: Math.ceil(result.length / 10),
        results: result as unknown as PostCardData[]
    };
}

export async function initializeDuckDB(searchBlob: Blob, tagsBlob: Blob): Promise<duckdb.AsyncDuckDB> {
    const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
    const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
    const worker_url = URL.createObjectURL(
        new Blob([`importScripts("${bundle.mainWorker!}");`], { type: 'text/javascript' })
    );

    const worker = new Worker(worker_url);
    const logger = new duckdb.ConsoleLogger();
    const db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    URL.revokeObjectURL(worker_url);

    // BlobデータをArrayBufferに変換
    const tagsArrayBuffer = await tagsBlob.arrayBuffer();
    const searchArrayBuffer = await searchBlob.arrayBuffer();

    // ArrayBufferをDuckDBのファイルシステムに登録
    await db.registerFileBuffer('tags.parquet', new Uint8Array(tagsArrayBuffer));
    await db.registerFileBuffer('search.parquet', new Uint8Array(searchArrayBuffer));

    // データの挿入を実施する
    const conn = await db.connect();
    await conn.query("INSTALL parquet");
    await conn.query("LOAD 'parquet'");
    await conn.query(`CREATE TABLE tags AS SELECT * FROM read_parquet('tags.parquet')`);
    await conn.query(`CREATE TABLE search AS SELECT * FROM read_parquet('search.parquet')`);
    await conn.close();
    return db;
}

// debounceを使った検索用Hook例（必要に応じてexportして利用可能）
export function useDebouncedSearch(db: duckdb.AsyncDuckDB | null, setSearchResults: (results: SearchResult[]) => void, setQuery: (q: string) => void) {
    return debounce((searchQuery: string) => {
        setQuery(searchQuery);
        if (db) {
            search(db, searchQuery).then((result) => {
                setSearchResults([result]);
            });
        }
    }, 300);
}