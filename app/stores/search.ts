import { atom } from 'jotai';
import type { OrderBy, SearchResult } from '~/modules/lightSearch.client';

// 基本的な検索状態（URL連携は親コンポーネントで行う）
const searchQueryAtom = atom('');
const currentPageAtom = atom(1);
const orderByAtom = atom<OrderBy>('timeDesc');
const selectedTagsAtom = atom<string[]>([]);

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
