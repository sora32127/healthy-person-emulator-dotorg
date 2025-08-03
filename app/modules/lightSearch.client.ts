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
    tagCounts: Array<{tagName: string, count: number}>,
    results: PostCardProps[]
}

const handlerCache = new Map<string, LightSearchHandler>();

export function getOrCreateHandler(searchAssetURL: string, tagsAssetURL1: string, tagsAssetURL2: string): LightSearchHandler {
    const cacheKey = `${searchAssetURL}-${tagsAssetURL1}-${tagsAssetURL2}`;
    
    if (!handlerCache.has(cacheKey)) {
        const handler = new LightSearchHandler(searchAssetURL, tagsAssetURL1, tagsAssetURL2);
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
        tagCounts: [],
        results: []
    };

    constructor(searchAssetURL: string, tagsAssetURL1: string, tagsAssetURL2: string) {
        this.initializationPromise = this.initialize(searchAssetURL, tagsAssetURL1, tagsAssetURL2);
    }

    // 初期化完了を待つメソッド
    async waitForInitialization() {
        if (this.initializationPromise) {
            await this.initializationPromise;
        }
    }

    async initialize(searchAssetURL: string, tagsAssetURL1: string, tagsAssetURL2: string) {
        console.log("searchAssetURL", searchAssetURL);
        console.log("tagsAssetURL1", tagsAssetURL1);
        console.log("tagsAssetURL2", tagsAssetURL2);
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
        await conn.query(`CREATE TABLE tags AS SELECT * FROM read_parquet(['${tagsAssetURL1}', '${tagsAssetURL2}'])`);
        await conn.close();
    }

    async search(query: string, orderby: OrderBy = "timeDesc", page: number = 1, tags: string[] = []): Promise<SearchResult> {
        const searchResult = await this.searchByQueryAndTagsWithSort(query, orderby, page, tags);
        const tagCounts = await this.getTagCounts(query, tags);
        return {
            ...searchResult,
            tagCounts
        };
    }

    private async searchByQueryAndTagsWithSort(query: string, orderby: OrderBy, page: number = 1, tags: string[] = []) {
        if (!this.db) {
            throw new Error("Database not initialized");
        }
        const conn = await this.db.connect();
        const orderByClause = this.getOrderByClause(orderby);
        let tagFilterClause = "";
        if (tags.length > 0) {
            const tagConditions = tags.map(tag => `'${tag}' IN (SELECT UNNEST(tagNames))`).join(" AND ");
            tagFilterClause = `AND (${tagConditions})`;
        }

        // 検索条件の構築
        const searchCondition = query.trim() !== "" 
        ? `WHERE (postTitle LIKE '%${query}%' OR postContent LIKE '%${query}%') ${tagFilterClause}`
        : tags.length > 0 
            ? `WHERE ${tagFilterClause.substring(4)}` // "AND "を除去
            : "";

        const pageSize = 10;
        const offset = (page - 1) * pageSize;
        
        // 総件数を取得
        const countSql = `SELECT COUNT(*) as total FROM search ${searchCondition}`;
        const countRes = await conn.query(countSql);
        const totalCount = Number(countRes.toArray()[0].total);

        // ページング付きで検索結果を取得
        const res = await conn.query(`SELECT * FROM search ${searchCondition} ${orderByClause} LIMIT ${pageSize} OFFSET ${offset}`);
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


    private async getTagCounts(query: string, tags: string[]): Promise<Array<{tagName: string, count: number}>> {
        if (!this.db) {
            throw new Error("Database not initialized");
        }
        const conn = await this.db.connect();
        const isQueryEmpty = this.isQueryEmpty(query);
        const isTagsEmpty = tags.length === 0;
        console.log("isQueryEmpty", isQueryEmpty);
        console.log("isTagsEmpty", isTagsEmpty);
       
        const sql = isQueryEmpty && isTagsEmpty
        ? `SELECT tagName, count(*) as count FROM tags GROUP BY tagName ORDER BY count DESC`
        : isQueryEmpty && !isTagsEmpty
        ? `SELECT tagName, count(*) as count FROM tags WHERE tagName IN (${tags.map(tag => `'${tag}'`).join(",")}) GROUP BY tagName ORDER BY count DESC`
        : !isQueryEmpty && isTagsEmpty
        ? `with post as (SELECT postId FROM search WHERE postTitle LIKE '%${query}%' OR postContent LIKE '%${query}%')
        SELECT tagName, count(*) as count FROM tags WHERE postId in (SELECT postId FROM post) GROUP BY tagName ORDER BY count DESC`
        : !isQueryEmpty && !isTagsEmpty
        ? `with post as (SELECT postId FROM search WHERE postTitle LIKE '%${query}%' OR postContent LIKE '%${query}%')
        SELECT tagName, count(*) as count FROM tags WHERE postId in (SELECT postId FROM post) AND tagName IN (${tags.map(tag => `'${tag}'`).join(",")}) GROUP BY tagName ORDER BY count DESC`
        : "";
        
        console.log("sql", sql);
        const countRes = await conn.query(sql);
        await conn.close();
        return countRes.toArray().map((row) => ({
            tagName: String(row.tagName),
            count: Number(row.count)
        }));
    }

    private isQueryEmpty(query: string): boolean {
        return query === "" || query.trim() === "" || !query;
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