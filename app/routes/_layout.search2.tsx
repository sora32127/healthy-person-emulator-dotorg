import { useLoaderData } from "@remix-run/react";
import { getOrCreateHandler, LightSearchHandler, type SearchResult, type OrderBy } from "~/modules/lightSearch.client";
import { useEffect, useState, useCallback } from "react";
import { debounce } from "es-toolkit";
import PostCard from "~/components/PostCard";
import { useSearchParams } from "@remix-run/react";
import { Accordion, AccordionItem } from "~/components/Accordion";
import TagSelectionBox from "~/components/SubmitFormComponents/TagSelectionBox";
import { H1 } from "~/components/Headings";
import { Storage } from '@google-cloud/storage';

/**
 * ファイルの署名付きダウンロードURLを生成
 * @param fileName ファイル名
 * @param expirationMinutes 有効期限（分）
 * @returns 署名付きURL
 */
async function generateDownloadSignedUrl(
  fileName: string,
  expirationMinutes: number = 15
): Promise<string> {
  try {
    const bucket = new Storage({
        keyFilename: "./hpe-temp-downloader-key.json"
    }).bucket("hpe-temp");
    const file = bucket.file(fileName);

    // ファイルの存在確認
    const [exists] = await file.exists();
    if (!exists) {
      throw new Error(`File ${fileName} does not exist in bucket hpe-temp`);
    }

    // 署名付きURLを生成
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + expirationMinutes * 60 * 1000,
    });

    return signedUrl;
  } catch (error) {
    console.error('Error generating signed URL:', error);
    throw new Error(`Failed to generate signed URL for ${fileName}`);
  }
}


export async function loader() {
    const SEARCH_PARQUET_FILE_NAME = process.env.SEARCH_PARQUET_FILE_NAME;
    const TAGS_PARQUET_FILE_NAME_1 = process.env.TAGS_PARQUET_FILE_NAME_1;
    const TAGS_PARQUET_FILE_NAME_2 = process.env.TAGS_PARQUET_FILE_NAME_2;
    if (!SEARCH_PARQUET_FILE_NAME || !TAGS_PARQUET_FILE_NAME_1 || !TAGS_PARQUET_FILE_NAME_2) {
        throw new Error("Search or tags parquet file name is not set");
    }
    const searchAssetURL = await generateDownloadSignedUrl(SEARCH_PARQUET_FILE_NAME);
    const tagsAssetURL1 = await generateDownloadSignedUrl(TAGS_PARQUET_FILE_NAME_1);
    const tagsAssetURL2 = await generateDownloadSignedUrl(TAGS_PARQUET_FILE_NAME_2);
    return {
        searchAssetURL,
        tagsAssetURL1,
        tagsAssetURL2
    };
}

export default function LightSearch() {
    const { searchAssetURL, tagsAssetURL1, tagsAssetURL2 } = useLoaderData<typeof loader>();
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
        tagCounts: [],
        results: []
    });
    const [searchParams, setSearchParams] = useSearchParams();
    const query = searchParams.get("q") || "";
    const orderby = searchParams.get("orderby") as OrderBy || "timeDesc";
    const page = Number(searchParams.get("p")) || 1;
    const tags = searchParams.get("tags")?.split(" ") || [];
    const [inputValue, setInputValue] = useState(query);
    const [currentOrderby, setCurrentOrderby] = useState<OrderBy>(orderby);
    const [currentPage, setCurrentPage] = useState(page);
    const [selectedTags, setSelectedTags] = useState<string[]>(tags);
    const [isAccordionOpen, setIsAccordionOpen] = useState(false);

    if (!searchAssetURL) {
        throw new Error("Search asset URL is not set");
    }
    if (!tagsAssetURL1 || !tagsAssetURL2) {
        throw new Error("Tags asset URL is not set : ");
    }
    
    useEffect(() => {
        const initializeHandler = async () => {
            const handler = getOrCreateHandler(searchAssetURL, tagsAssetURL1, tagsAssetURL2);
            setLightSearchHandler(handler);
            // 初期化完了を待つ
            await handler.waitForInitialization();
            setIsInitialized(true);
        };
        
        initializeHandler();
    }, [searchAssetURL]);
    
    // 初回レンダリング時の検索実行
    useEffect(() => {
        if (isInitialized && lightSearchHandler && query) {
            executeSearch(query, currentOrderby, currentPage, selectedTags);
        }
    }, [isInitialized, lightSearchHandler, query, currentOrderby, currentPage]);
    
    // URL パラメータの管理
    const updateSearchParams = (query: string, orderby: OrderBy, page: number, tags: string[] = []) => {
        const params = new URLSearchParams();
        if (query) params.set("q", query);
        params.set("orderby", orderby);
        params.set("p", page.toString());
        if (tags.length > 0) {
            params.set("tags", tags.join(" "));
        }
        setSearchParams(params, { preventScrollReset: true });
    };
    
    useEffect(() => {
        if (orderby !== currentOrderby) {
            setCurrentOrderby(orderby);
        }
        if (page !== currentPage) {
            setCurrentPage(page);
        }
        // タグ状態の復元 - URLパラメータが変更された場合のみ
        if (tags.length !== selectedTags.length || 
            tags.some((tag, index) => tag !== selectedTags[index])) {
            setSelectedTags(tags);
        }
    }, [orderby, page, tags]);
    
    // executeSearch関数を修正
    const executeSearch = useCallback(async (query: string, orderby: OrderBy, page: number, tags: string[] = []) => {
        if (lightSearchHandler && isInitialized) {
            try {
                const results = await lightSearchHandler.search(query, orderby, page, tags);
                setSearchResults({
                    metadata: {
                        query: results.metadata.query,
                        count: results.metadata.count,
                        page: results.metadata.page,
                        totalPages: results.metadata.totalPages,
                        orderby: results.metadata.orderby
                    },
                    tagCounts: results.tagCounts,
                    results: results.results
                });
                updateSearchParams(query, orderby, page, tags); // タグパラメータを追加
            } catch (error) {
                console.error("Search error:", error);
            }
        }
    }, [lightSearchHandler, isInitialized]);
    
    // handleSearch関数を修正
    const handleSearch = useCallback(
        debounce(async (query: string, orderby: OrderBy) => {
            await executeSearch(query, orderby, 1, selectedTags);
        }, 1000),
        [executeSearch]
    );
    
    // handleSortOrderChange関数を修正
    const handleSortOrderChange = (newOrderby: OrderBy) => {
        setCurrentOrderby(newOrderby);
        // 並び順変更時は1ページ目に戻る
        executeSearch(inputValue, newOrderby, 1, selectedTags); // タグパラメータを追加
    };

    // handlePageChange関数を修正
    const handlePageChange = (newPage: number) => {
        setCurrentPage(newPage);
        executeSearch(inputValue, currentOrderby, newPage, selectedTags); // タグパラメータを追加
    };

    // handleTagsSelected関数を修正
    const handleTagsSelected = (newTags: string[]) => {
        setSelectedTags(newTags);
        // タグが変更されたら検索を実行し、URLパラメータも更新
        executeSearch(inputValue, currentOrderby, 1, newTags);
    };
    
    return (
        <div>
            <H1>検索</H1>
            <div className="container">
                <div className="search-input">
                    <form onSubmit={(e) => e.preventDefault()}>
                        <input
                            type="text"
                            name="q"
                            placeholder="テキストを入力..."
                            className="input input-bordered w-full placeholder-slate-500"
                            onChange={(e) => {
                                setInputValue(e.target.value);
                                handleSearch(e.target.value, currentOrderby);
                            }}
                            value={inputValue}
                        />
                        <div className="my-4">
                            <Accordion>
                                <AccordionItem title="タグ選択" isOpen={isAccordionOpen} setIsOpen={setIsAccordionOpen}>
                                    <TagSelectionBox
                                        allTagsOnlyForSearch={searchResults.tagCounts}
                                        onTagsSelected={handleTagsSelected}
                                        parentComponentStateValues={selectedTags}
                                    />
                                </AccordionItem>
                            </Accordion>
                        </div>
                    </form>
                </div>
                <div className="search-results">
                    <div className="search-meta-data my-3 min-h-[80px]">
                        {!isInitialized ? (
                            <div className="flex justify-center items-center h-full">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"/>
                                <span className="ml-2">初期化中...</span>
                            </div>
                        ) : (searchResults.metadata.query !== "" || selectedTags.length > 0) ? (
                            <div className="h-full flex flex-col justify-center">
                                <p>検索結果: {searchResults.metadata.count}件</p>
                                {searchResults.metadata.query && <p className="truncate">キーワード: {searchResults.metadata.query}</p>}
                                {selectedTags.length > 0 && <p className="truncate">タグ: {selectedTags.join(", ")}</p>}
                                {searchResults.metadata.count === 0 && <p>検索結果がありません</p>}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col justify-center">
                                <p>検索キーワードを入力してください</p>
                            </div>
                        )}
                    </div>
                    <div className="search-sort-order py-2">
                        {searchResults.metadata.count > 0 && (
                            <select 
                                value={currentOrderby} 
                                onChange={(e) => handleSortOrderChange(e.target.value as OrderBy)}
                                className="select select-bordered select-sm"
                            >
                                <option value="timeDesc">新着順</option>
                                <option value="timeAsc">古い順</option>
                                <option value="like">いいね順</option>
                            </select>
                        )}
                    </div>
                    <SearchResults searchResults={searchResults} />
                    <Pagination 
                        currentPage={searchResults.metadata.page}
                        totalPages={searchResults.metadata.totalPages}
                        onPageChange={handlePageChange}
                        totalCount={searchResults.metadata.count}
                    />
                </div>
            </div>
        </div>
    );
}

function SearchResults({ searchResults }: { searchResults: SearchResult }) {
    // 検索結果の表示は親コンポーネントのメタデータ部分で処理されるため、
    // ここでは結果リストのみを表示
    if (searchResults.metadata.count === 0) {
        return null;
    }

    return (
        <div className="search-results-container">
            {searchResults.results.map((result) => (
                <PostCard key={result.postId} {...result} />
            ))}
        </div>
    );
}

function Pagination({ 
    currentPage, 
    totalPages, 
    onPageChange, 
    totalCount 
}: { 
    currentPage: number; 
    totalPages: number; 
    onPageChange: (page: number) => void;
    totalCount: number;
}) {
    if (totalCount === 0) return null;

    return (
        <div className="search-navigation flex justify-center my-4">
            {totalPages >= 1 && (
                <div className="join">
                    <button
                        className="join-item btn btn-lg"
                        onClick={() => onPageChange(1)}
                        disabled={currentPage === 1}
                        type="button"
                    >
                        «
                    </button>
                    <button
                        className="join-item btn btn-lg"
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        type="button"
                    >
                        ‹
                    </button>
                    <div className="join-item bg-base-200 font-bold text-lg flex items-center justify-center min-w-[100px]">
                        {currentPage} / {totalPages}
                    </div>
                    <button
                        className="join-item btn btn-lg"
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        type="button"
                    >
                        ›
                    </button>
                    <button
                        className="join-item btn btn-lg"
                        onClick={() => onPageChange(totalPages)}
                        disabled={currentPage === totalPages}
                        type="button"
                    >
                        »
                    </button>
                </div>
            )}
        </div>
    );
}