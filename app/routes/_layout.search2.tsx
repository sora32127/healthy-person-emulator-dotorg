import { useFetcher, useLoaderData } from "@remix-run/react";
import useSWR from 'swr'
import * as duckdb from '@duckdb/duckdb-wasm';
import { useEffect } from "react";

export async function loader() {
    const { searchURL, tagsURL } = getObjectUrls();
    return {
        searchURL,
        tagsURL,
    }
}

export default function Search2() {
    const { searchURL, tagsURL } = useLoaderData<typeof loader>();
    const { data: searchData, error: searchError, isLoading: searchLoading } = useDownloadFile(searchURL);
    const { data: tagsData, error: tagsError, isLoading: tagsLoading } = useDownloadFile(tagsURL);
    useEffect(() => {
        if (!searchLoading && !tagsLoading && searchData && tagsData) {
            console.log("Data is downloaded");
            initializeDuckDB(searchData, tagsData);
        }
    }, [searchLoading, tagsLoading, searchData, tagsData]);
    return <div>
        {searchLoading && <div>Loading...</div>}
        {searchError && <div>Error: {searchError.message}</div>}
        {tagsLoading && <div>Loading...</div>}
        {tagsError && <div>Error: {tagsError.message}</div>}
    </div>;
}

async function initializeDuckDB(searchBlob: Blob, tagsBlob: Blob) {
    const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
    const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
    const worker_url = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker!}");`], {type: 'text/javascript'})
    );

    const worker = new Worker(worker_url);
    const logger = new duckdb.ConsoleLogger()
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


function useDownloadFile(url:string) {
    const fetcher = (url: string) => fetch(url).then(res => res.blob());
    const { data, error, isLoading } = useSWR(url, fetcher);
    return { data, error, isLoading };
}

function getObjectUrls(): {
    searchURL: string;
    tagsURL: string;
} {
    const searchURL = process.env.SEARCH_PARQUET_FILE_PATH
    const tagsURL = process.env.TAGS_PARQEST_FILE_PATH
    if (!searchURL || !tagsURL) {
        throw new Error("SEARCH_PARQUET_URL or TAGS_PARQUET_URL is not set");
    }
    return {
        searchURL,
        tagsURL,
    }
}
