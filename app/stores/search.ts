import { atom } from 'jotai';
import type { OrderBy, SearchResult } from '~/modules/lightSearch.client';

// 基本的な検索状態（URL連携は親コンポーネントで行う）
export const searchQueryAtom = atom('');
export const currentPageAtom = atom(1);
export const orderByAtom = atom<OrderBy>('timeDesc');
export const selectedTagsAtom = atom<string[]>([]);

// 検索結果
export const searchResultsAtom = atom<SearchResult>({
  metadata: {
    query: '',
    count: 0,
    page: 1,
    totalPages: 0,
    orderby: 'timeDesc',
    hasMore: false,
  },
  tagCounts: [],
  results: [],
});

// 初期化状態
export const isSearchInitializedAtom = atom(false);

// 入力フィールドの値（デバウンス用）
export const searchInputValueAtom = atom('');
