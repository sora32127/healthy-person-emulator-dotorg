import * as duckdb from "@duckdb/duckdb-wasm";
import type { PostCardProps } from "../components/PostCard";

export type OrderBy = "timeDesc" | "timeAsc" | "like";

export type SearchResult = {
    metadata: {
        query: string;
        count: number;
        page: number;
        totalPages: number;
        orderby: OrderBy;
    },
    results: PostCardProps[]
}

const handlerCache = new Map<string, LightSearchHandler>();

export function getOrCreateHandler(searchAssetURL: string): LightSearchHandler {
    const cacheKey = `${searchAssetURL}`;
    
    if (!handlerCache.has(cacheKey)) {
        const handler = new LightSearchHandler(searchAssetURL);
        handlerCache.set(cacheKey, handler);
    }
    
    return handlerCache.get(cacheKey)!;
}

export class LightSearchHandler {
    private db: duckdb.AsyncDuckDB | null = null;
    private initializationPromise: Promise<void> | null = null;
    private searchResults: SearchResult = {
        metadata: {
            query: "",
            count: 0,
            page: 1,
            totalPages: 0,
            orderby: "timeDesc"
        },
        results: []
    };

    constructor(searchAssetURL: string) {
        this.initializationPromise = this.initialize(searchAssetURL);
    }

    // 初期化完了を待つメソッド
    async waitForInitialization() {
        if (this.initializationPromise) {
            await this.initializationPromise;
        }
    }

    async initialize(searchAssetURL: string) {
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
        await conn.close();
    }

    async search(query: string, orderby: OrderBy = "timeDesc", page: number = 1){
        return this.searchByQueryWithSort(query, orderby, page);
    }

    async searchByQuery(query: string) {
        return this.searchByQueryWithSort(query, "timeDesc", 1);
    }

    async searchByQueryWithSort(query: string, orderby: OrderBy, page: number = 1) {
        if (!this.db) {
            throw new Error("Database not initialized");
        }
        const conn = await this.db.connect();
        const orderByClause = this.getOrderByClause(orderby);
        const pageSize = 10;
        const offset = (page - 1) * pageSize;
        
        // 総件数を取得
        const countRes = await conn.query(`SELECT COUNT(*) as total FROM search WHERE postTitle LIKE '%${query}%' OR postContent LIKE '%${query}%'`);
        const totalCount = Number(countRes.toArray()[0].total);
        
        // ページング付きで検索結果を取得
        const res = await conn.query(`SELECT * FROM search WHERE postTitle LIKE '%${query}%' OR postContent LIKE '%${query}%' ${orderByClause} LIMIT ${pageSize} OFFSET ${offset}`);
        await conn.close();
        
        this.searchResults.metadata.query = query;
        this.searchResults.metadata.count = res.numRows;
        this.searchResults.metadata.page = page;
        this.searchResults.metadata.totalPages = this.calculateTotalPages(totalCount, pageSize);
        this.searchResults.metadata.orderby = orderby;
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

    // 総件数取得メソッド
    async getTotalCount(query: string): Promise<number> {
        if (!this.db) {
            throw new Error("Database not initialized");
        }
        const conn = await this.db.connect();
        const countRes = await conn.query(`SELECT COUNT(*) as total FROM search WHERE postTitle LIKE '%${query}%' OR postContent LIKE '%${query}%'`);
        await conn.close();
        return Number(countRes.toArray()[0].total);
    }

    // totalPages計算ロジック
    private calculateTotalPages(totalCount: number, pageSize: number = 10): number {
        return Math.ceil(totalCount / pageSize);
    }

    private getOrderByClause(orderby: OrderBy): string {
        switch (orderby) {
            case "timeDesc": return "ORDER BY postDateGmt DESC";
            case "timeAsc": return "ORDER BY postDateGmt ASC";
            case "like": return "ORDER BY countLikes DESC";
            default: return "ORDER BY postDateGmt DESC";
        }
    }

    getSearchResults() {
        return this.searchResults;
    }
}