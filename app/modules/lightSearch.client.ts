import * as duckdb from "@duckdb/duckdb-wasm";
import type { PostCardData } from "./db.server";

export type SearchResult = {
    metadata: {
        query: string;
        count: number;
        page: number;
        totalPages: number;
    },
    results: PostCardData[]
}

export class LightSearchHandler {
    private db: duckdb.AsyncDuckDB | null = null;
    private initializationPromise: Promise<void> | null = null;
    private searchResults: SearchResult = {
        metadata: {
            query: "",
            count: 0,
            page: 1,
            totalPages: 0
        },
        results: []
    };

    constructor(searchAssetURL: string, tagsAssetURL: string) {
        this.initializationPromise = this.initialize(searchAssetURL, tagsAssetURL);
    }

    // 初期化完了を待つメソッド
    async waitForInitialization() {
        if (this.initializationPromise) {
            await this.initializationPromise;
        }
    }

    async initialize(searchAssetURL: string, tagsAssetURL: string) {
        const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
        const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
        const worker_url = URL.createObjectURL(
        new Blob([`importScripts("${bundle.mainWorker!}");`], {type: 'text/javascript'})
        );

        const worker = new Worker(worker_url);
        const logger = new duckdb.ConsoleLogger()
        this.db = new duckdb.AsyncDuckDB(logger, worker);
        await this.db.instantiate(bundle.mainModule, bundle.pthreadWorker);
        URL.revokeObjectURL(worker_url);
        const conn = await this.db.connect();
        await conn.query("INSTALL parquet");
        await conn.query("LOAD 'parquet'");
        await conn.query(`CREATE TABLE search AS SELECT * FROM read_parquet('${searchAssetURL}')`);
        await conn.query(`CREATE TABLE tags AS SELECT * FROM read_parquet('${tagsAssetURL}')`);
        await conn.close();
    }

    async search(query: string){
        return this.searchByQuery(query);
    }

    async searchByQuery(query: string) {
        if (!this.db) {
            throw new Error("Database not initialized");
        }
        const conn = await this.db.connect();
        const res = await conn.query(`SELECT * FROM search WHERE post_title LIKE '%${query}%' OR post_content LIKE '%${query}%' limit 10`);
        const postIds = res.toArray().map((row) => {
            const obj = Object.fromEntries(row);
            return obj.post_id;
        });
        const tags = postIds.length > 0 ? (await conn.query(`SELECT * FROM tags WHERE post_id IN (${postIds.join(',')})`)).toArray().map((row) => {
            const obj = Object.fromEntries(row);
            return {
                postId: Number(obj.post_id),
                tagName: obj.tag_name,
            }
        }) : [];
        await conn.close();
        this.searchResults.metadata.query = query;
        this.searchResults.metadata.count = res.numRows;
        this.searchResults.results = res.toArray().map((row) => {
            const obj = Object.fromEntries(row);
            // snake_case to camelCase
            Object.keys(obj).forEach(key => {
                const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
                obj[camelKey] = obj[key];
                delete obj[key];
            });
            // BigIntを通常の数値に変換
            Object.keys(obj).forEach(key => {
                if (typeof obj[key] === 'bigint') {
                    obj[key] = Number(obj[key]);
                }
            });
            // post_date_jstを日付文字列に変換
            if (obj.postDateJst) {
                obj.postDateGmt = new Date(obj.postDateJst);
            }
            return {
                ...obj,
                tags: tags.filter((tag) => tag.postId === obj.postId).map((tag) => tag.tagName)
            } as PostCardData;
        });
        console.log("this.searchResults.results", this.searchResults.results);
        return this.searchResults;
    }

    getSearchResults() {
        return this.searchResults;
    }
}