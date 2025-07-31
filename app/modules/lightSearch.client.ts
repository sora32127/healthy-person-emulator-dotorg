import * as duckdb from "@duckdb/duckdb-wasm";
import type { PostCardProps } from "../components/PostCard";

export type SearchResult = {
    metadata: {
        query: string;
        count: number;
        page: number;
        totalPages: number;
    },
    results: PostCardProps[]
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
        const res = await conn.query(`SELECT * FROM search WHERE postTitle LIKE '%${query}%' OR postContent LIKE '%${query}%' limit 10`)
        await conn.close();
        this.searchResults.metadata.query = query;
        this.searchResults.metadata.count = res.numRows;
        this.searchResults.results = res.toArray().map((row) => {
            const obj = Object.fromEntries(row);
            // BigIntを通常の数値に変換
            Object.keys(obj).forEach(key => {
                if (typeof obj[key] === 'bigint') {
                    obj[key] = Number(obj[key]);
                }
            });
            // tagNameを単純なstring[]に変換する
            const tagNames = obj.tagNames.toArray();

            // UNIXTIME形式のpostDateGmtをDateに変換する
            const postDateGmt = new Date(obj.postDateGmt);

            // countCommentsにnullが入っている場合は0にする
            if (obj.countComments === null) {
                obj.countComments = 0;
            }

            return {
                postId: obj.postId,
                postTitle: obj.postTitle,
                postDateGmt: postDateGmt,
                countLikes: obj.countLikes,
                countDislikes: obj.countDislikes,
                ogpImageUrl: obj.ogpImageUrl,
                tagNames: tagNames,
                countComments: obj.countComments,
            } as PostCardProps
        });
        console.log("this.searchResults.results", this.searchResults.results);
        return this.searchResults;
    }

    getSearchResults() {
        return this.searchResults;
    }
}