import { useLoaderData, Outlet, useNavigate, useLocation, redirect } from 'react-router';
import type { SearchOrderBy, SearchPostsResult } from '~/modules/db.server';
import { searchPosts } from '~/modules/db.server';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { debounce } from 'es-toolkit';
import PostCard from '~/components/PostCard';
import { useSearchParams, useFetcher } from 'react-router';
import { Accordion, AccordionItem } from '~/components/Accordion';
import TagSelectionBox from '~/components/SubmitFormComponents/TagSelectionBox';
import { H1 } from '~/components/Headings';
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from 'react-router';
import { commonMetaFunction } from '~/utils/commonMetafunction';

export const meta: MetaFunction = ({ location }) => {
  const searchParams = new URLSearchParams(location.search);
  const query = searchParams.get('q') ?? '';
  const tags = searchParams.get('tags')?.split(' ').filter(Boolean) ?? [];
  const orderby = (searchParams.get('orderby') as SearchOrderBy | null) ?? 'timeDesc';

  const convertOrderBy = (value: SearchOrderBy) => {
    switch (value) {
      case 'timeDesc':
        return '新着順';
      case 'timeAsc':
        return '古い順';
      case 'like':
        return 'いいね順';
      default:
        return '新着順';
    }
  };

  let pageTitle = '検索結果';
  if (query) {
    pageTitle += ` キーワード: ${query}`;
  }
  if (tags.length > 0) {
    pageTitle += ' タグ';
    pageTitle += `: ${tags.join(', ')}`;
  }
  if (orderby) {
    pageTitle += ` ${convertOrderBy(orderby)}`;
  }
  if (query === '' && tags.length === 0) {
    pageTitle = '検索する';
  }

  return commonMetaFunction({
    title: pageTitle,
    description: '検索',
    url: `https://healthy-person-emulator.org/search${location.search}`,
    image: null,
  });
};

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get('q') || '';
  const orderby = (url.searchParams.get('orderby') as SearchOrderBy) || 'timeDesc';
  const tags = url.searchParams.get('tags')?.split(' ').filter(Boolean) || [];
  const page = Number(url.searchParams.get('page')) || 1;
  const pageSize = Number(url.searchParams.get('pageSize')) || 10;

  const result = await searchPosts(query, orderby, page, tags, pageSize);
  return result;
}

export async function action({ request }: ActionFunctionArgs) {
  const body = await request.formData();
  const action = body.get('action');
  if (action === 'firstSearch') {
    const query = (body.get('query') as string) || '';
    return redirect(`/search?q=${encodeURIComponent(query)}`);
  }
  return null;
}

export default function LightSearch() {
  const loaderData = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isAccordionOpen, setIsAccordionOpen] = useState(false);

  // 記事表示用の状態
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  // URL から現在の状態を取得
  const query = searchParams.get('q') || '';
  const orderby = (searchParams.get('orderby') as SearchOrderBy) || 'timeDesc';
  const selectedTags = searchParams.get('tags')?.split(' ').filter(Boolean) || [];
  const postId = searchParams.get('postId') || null;

  // UI用の状態（デバウンス検索用）
  const [inputValue, setInputValue] = useState(query);

  // 無限スクロール用：ページをまたいだ累積結果
  const [allResults, setAllResults] = useState<SearchPostsResult['results']>(loaderData.results);
  const [currentSearchResult, setCurrentSearchResult] = useState<SearchPostsResult>(loaderData);
  const [currentPage, setCurrentPage] = useState(1);

  // fetcher for infinite scroll
  const fetcher = useFetcher<SearchPostsResult>();

  // スクロール復元を有効にする
  useEffect(() => {
    if (history.scrollRestoration) {
      history.scrollRestoration = 'manual';
    }
    return () => {
      if (history.scrollRestoration) {
        history.scrollRestoration = 'auto';
      }
    };
  }, []);

  // URLのpostIdパラメータと状態を同期
  useEffect(() => {
    setSelectedPostId(postId);
  }, [postId]);

  // URLパラメータが変更された時に入力フィールドを同期
  useEffect(() => {
    setInputValue(query);
  }, [query]);

  // loader データが変わったら累積結果をリセット
  const searchKey = useMemo(
    () => JSON.stringify({ query, orderby, selectedTags: [...selectedTags].sort() }),
    [query, orderby, selectedTags],
  );
  const prevSearchKeyRef = useRef(searchKey);

  useEffect(() => {
    if (searchKey !== prevSearchKeyRef.current) {
      // 検索条件が変わった → リセット
      setAllResults(loaderData.results);
      setCurrentSearchResult(loaderData);
      setCurrentPage(1);
      prevSearchKeyRef.current = searchKey;
    } else {
      // 同じ検索条件で loader が再実行された場合（初回ロード含む）
      setAllResults(loaderData.results);
      setCurrentSearchResult(loaderData);
      setCurrentPage(1);
      prevSearchKeyRef.current = searchKey;
    }
  }, [loaderData, searchKey]);

  // fetcher のレスポンスを受け取って累積結果に追加
  useEffect(() => {
    if (fetcher.data && fetcher.state === 'idle') {
      const newData = fetcher.data;
      setAllResults((prev) => {
        const existingIds = new Set(prev.map((r) => r.postId));
        const newResults = newData.results.filter((r) => !existingIds.has(r.postId));
        return [...prev, ...newResults];
      });
      setCurrentSearchResult(newData);
      setCurrentPage(newData.metadata.page);
    }
  }, [fetcher.data, fetcher.state]);

  const hasMore = currentSearchResult.metadata.hasMore;
  const isLoadingMore = fetcher.state === 'loading';

  // 次のページを読み込む
  const loadMore = useCallback(() => {
    if (isLoadingMore || !hasMore) return;

    const nextPage = currentPage + 1;
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (orderby !== 'timeDesc') params.set('orderby', orderby);
    if (selectedTags.length > 0) params.set('tags', selectedTags.join(' '));
    params.set('page', String(nextPage));

    fetcher.load(`/search?${params.toString()}`);
  }, [isLoadingMore, hasMore, currentPage, query, orderby, selectedTags, fetcher]);

  // URL更新関数
  const updateSearchParams = useCallback(
    (newQuery: string, newOrderby: SearchOrderBy, newTags: string[], newPostId?: string | null) => {
      const params = new URLSearchParams();
      if (newQuery) params.set('q', newQuery);
      if (newOrderby !== 'timeDesc') params.set('orderby', newOrderby);
      if (newTags.length > 0) params.set('tags', newTags.join(' '));
      if (newPostId) params.set('postId', newPostId);
      setSearchParams(params, { preventScrollReset: true });
    },
    [setSearchParams],
  );

  // デバウンス検索
  const debouncedSearch = useMemo(
    () =>
      debounce(
        (searchQuery: string, currentOrderby: SearchOrderBy, currentSelectedTags: string[]) => {
          updateSearchParams(searchQuery, currentOrderby, currentSelectedTags);
        },
        1000,
      ),
    [],
  );

  // ハンドラー関数
  const handleSearch = useCallback(
    (value: string) => {
      setInputValue(value);
      debouncedSearch(value, orderby, selectedTags);
    },
    [debouncedSearch, orderby, selectedTags],
  );

  const handleSortOrderChange = useCallback(
    (newOrderby: SearchOrderBy) => {
      updateSearchParams(query, newOrderby, selectedTags);
    },
    [updateSearchParams, query, selectedTags],
  );

  const handleTagsSelected = useCallback(
    (newTags: string[]) => {
      updateSearchParams(query, orderby, newTags);
    },
    [updateSearchParams, query, orderby],
  );

  // 記事選択ハンドラー（ナビゲーションを使用）
  const navigate = useNavigate();
  const location = useLocation();

  const handlePostSelect = useCallback((postId: string) => {
    const url = `/archives/${postId}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  // 検索画面に戻るハンドラー
  const handleBackToSearch = useCallback(() => {
    const searchParamsObj = new URLSearchParams(location.search);
    searchParamsObj.delete('postId');
    if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate(`/search?${searchParamsObj.toString()}`);
    }
  }, [navigate, location.search]);

  // 現在記事が選択されているかどうか
  const isPostSelected = location.pathname.includes('/search/');

  return (
    <div className="md:flex md:h-screen">
      {/* 検索結果パネル */}
      <div
        className={`${isPostSelected ? 'md:w-1/2 hidden md:block' : 'w-full'} transition-all duration-300 overflow-y-auto pr-2`}
      >
        <div>
          <H1>検索</H1>
          <div className="container">
            <div className="search-input-form w-full">
              <form onSubmit={(e) => e.preventDefault()}>
                <input
                  type="text"
                  name="q"
                  placeholder="テキストを入力..."
                  className="input input-bordered w-full placeholder-slate-500"
                  onChange={(e) => handleSearch(e.target.value)}
                  value={inputValue}
                />
                <div className="my-4">
                  <Accordion>
                    <AccordionItem
                      title="タグ選択"
                      isOpen={isAccordionOpen}
                      setIsOpen={setIsAccordionOpen}
                    >
                      <TagSelectionBox
                        allTagsOnlyForSearch={currentSearchResult.tagCounts}
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
                {currentSearchResult.metadata.query !== '' || selectedTags.length > 0 ? (
                  <div className="h-full flex flex-col justify-center">
                    <p>
                      検索結果: {currentSearchResult.metadata.count}件 (表示中: {allResults.length}
                      件)
                    </p>
                    {currentSearchResult.metadata.query && (
                      <p className="truncate">キーワード: {currentSearchResult.metadata.query}</p>
                    )}
                    {selectedTags.length > 0 && (
                      <p className="truncate">タグ: {selectedTags.join(', ')}</p>
                    )}
                    {currentSearchResult.metadata.count === 0 && <p>検索結果がありません</p>}
                  </div>
                ) : (
                  <div className="h-full flex flex-col justify-center">
                    <p>検索キーワードを入力してください</p>
                  </div>
                )}
              </div>
              <div className="search-sort-order py-2 flex gap-2 items-center">
                {currentSearchResult.metadata.count > 0 && (
                  <select
                    value={orderby}
                    onChange={(e) => handleSortOrderChange(e.target.value as SearchOrderBy)}
                    className="select select-bordered select-sm"
                  >
                    <option value="timeDesc">新着順</option>
                    <option value="timeAsc">古い順</option>
                    <option value="like">いいね順</option>
                  </select>
                )}
              </div>
              <InfiniteScrollResults
                allResults={allResults}
                hasMore={hasMore}
                isLoading={isLoadingMore}
                onLoadMore={loadMore}
                onPostSelect={handlePostSelect}
                selectedPostId={selectedPostId}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 記事表示パネル（Outlet使用） */}
      {isPostSelected && (
        <div className="w-full md:w-1/2 md:border-l border-neutral overflow-y-auto relative">
          <div className="md:absolute md:top-4 md:left-4 md:z-10 block md:block p-4 md:p-0">
            <button
              onClick={handleBackToSearch}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors bg-white px-3 py-1 rounded-full shadow-md"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              検索に戻る
            </button>
          </div>
          <div className="p-4 md:pt-4">
            <Outlet />
          </div>
        </div>
      )}
    </div>
  );
}

function InfiniteScrollResults({
  allResults,
  hasMore,
  isLoading,
  onLoadMore,
  onPostSelect,
  selectedPostId,
}: {
  allResults: SearchPostsResult['results'];
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  onPostSelect: (postId: string) => void;
  selectedPostId: string | null;
}) {
  const observerRef = useRef<IntersectionObserver>();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver の設定
  useEffect(() => {
    if (!loadMoreRef.current || isLoading || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      {
        threshold: 0,
        rootMargin: '100px',
      },
    );

    observer.observe(loadMoreRef.current);
    observerRef.current = observer;

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [onLoadMore, isLoading, hasMore]);

  if (allResults.length === 0) {
    return null;
  }

  return (
    <div className="infinite-scroll-results">
      {/* 検索結果のリスト */}
      <div className="results-list">
        {allResults.map((result) => (
          <div
            key={result.postId}
            className={`cursor-pointer transition-colors ${
              selectedPostId === result.postId.toString() ? 'bg-blue-50' : 'hover:bg-gray-50'
            }`}
            onClickCapture={(e) => {
              const target = e.target as HTMLElement | null;
              const anchor =
                target && 'closest' in target
                  ? (target.closest('a') as HTMLAnchorElement | null)
                  : null;
              if (anchor) {
                const href = anchor.getAttribute('href') || '';
                if (href.startsWith('/archives/')) {
                  e.preventDefault();
                  e.stopPropagation();
                  onPostSelect(result.postId.toString());
                  return;
                }
                return;
              }
              onPostSelect(result.postId.toString());
            }}
          >
            <PostCard
              postId={result.postId}
              postTitle={result.postTitle}
              postDateGmt={new Date(result.postDateGmt)}
              countLikes={result.countLikes}
              countDislikes={result.countDislikes}
              tagNames={result.tagNames}
              countComments={result.countComments}
            />
          </div>
        ))}
      </div>

      {/* ローディングトリガー */}
      {hasMore && (
        <div ref={loadMoreRef} className="loading-trigger flex justify-center py-8">
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              <span className="text-gray-600">読み込み中...</span>
            </div>
          ) : (
            <div className="text-gray-400">ここまで読み込みました</div>
          )}
        </div>
      )}

      {/* 読み込み完了メッセージ */}
      {!hasMore && allResults.length > 0 && (
        <div className="text-center py-8">
          <div className="text-gray-500">すべての結果を表示しました</div>
          <div className="text-sm text-gray-400 mt-1">({allResults.length}件)</div>
        </div>
      )}
    </div>
  );
}
