import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface Tag {
  tagName: string;
  count: number;
  categoryName?: string | null;
}

interface TagSelectionBoxProps {
  onTagsSelected: (tags: string[]) => void;
  parentComponentStateValues: string[];
  allTagsOnlyForSearch: Tag[];
}

export default function TagSelectionBox({
  onTagsSelected,
  parentComponentStateValues,
  allTagsOnlyForSearch,
}: TagSelectionBoxProps) {
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState<'count' | 'name'>('count');

  const handleTagClick = (tagName: string) => {
    if (parentComponentStateValues.includes(tagName)) {
      onTagsSelected(parentComponentStateValues.filter((tag) => tag !== tagName));
    } else {
      onTagsSelected([...parentComponentStateValues, tagName]);
    }
  };

  const handleRemoveSelectedTag = (tagName: string) => {
    onTagsSelected(parentComponentStateValues.filter((tag) => tag !== tagName));
  };

  // 検索 & ソート
  const { recommendationTags, otherTags } = useMemo(() => {
    const q = searchText.toLowerCase().trim();
    const matches = (t: Tag) => !q || t.tagName.toLowerCase().includes(q);

    const sortFn = (a: Tag, b: Tag) => {
      if (sortBy === 'count') {
        return b.count - a.count;
      }
      return a.tagName.localeCompare(b.tagName, 'ja');
    };

    const recs: Tag[] = [];
    const others: Tag[] = [];

    for (const tag of allTagsOnlyForSearch) {
      if (!matches(tag)) continue;
      if (tag.categoryName) {
        recs.push(tag);
      } else {
        others.push(tag);
      }
    }

    return {
      recommendationTags: recs.sort(sortFn),
      otherTags: others.sort(sortFn),
    };
  }, [allTagsOnlyForSearch, searchText, sortBy]);

  const totalFilteredCount = recommendationTags.length + otherTags.length;

  return (
    <div className="mb-8 bg-base-200 p-6 rounded-lg shadow-md">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
        <h3 className="text-xl font-bold">タグを選択してください</h3>
        <span className="text-sm text-base-content/70">
          選択中:{' '}
          <strong className="text-primary font-bold">{parentComponentStateValues.length}</strong> 件
        </span>
      </div>

      {/* 検索 & ソート */}
      <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 mb-4">
        <div className="relative flex-grow">
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="タグを検索（例: やってはいけないこと、学校、ADHD...）"
            className="input input-bordered w-full py-2 pl-10 pr-3 placeholder-slate-500"
          />
          <svg
            className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-base-content/50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <title>タグを検索</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          {searchText && (
            <button
              type="button"
              onClick={() => setSearchText('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-base-content/50 hover:text-base-content text-xs bg-base-300 rounded-full w-5 h-5 flex items-center justify-center"
            >
              ✕
            </button>
          )}
        </div>
        <select
          className="select select-bordered w-full sm:w-auto"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'count' | 'name')}
          aria-label="タグ並び替え"
        >
          <option value="count">タグ数順</option>
          <option value="name">五十音順</option>
        </select>
      </div>

      {/* タグ表示エリア */}
      <div className="h-96 overflow-y-auto p-4 bg-base-100 rounded-lg space-y-4">
        {totalFilteredCount === 0 ? (
          <div className="text-center text-base-content/60 py-12">
            該当するタグが見つかりませんでした
          </div>
        ) : (
          <>
            {/* 1. 推奨事項分類の枠 */}
            {recommendationTags.length > 0 && (
              <div className="bg-base-200/50 p-3.5 rounded-lg border border-base-300">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="font-bold text-xs text-base-content/80 tracking-wide">
                    推奨事項分類
                  </span>
                  <span className="badge badge-xs badge-ghost text-xs">
                    {recommendationTags.length} 件
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <AnimatePresence>
                    {recommendationTags.map((tag) => {
                      const isSelected = parentComponentStateValues.includes(tag.tagName);
                      return (
                        <motion.button
                          key={tag.tagName}
                          layout
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className={`px-3 py-1 rounded-full cursor-pointer text-sm transition-colors ${
                            isSelected
                              ? 'bg-primary text-primary-content font-medium shadow-sm'
                              : 'bg-base-100 text-base-content hover:bg-base-300 border border-base-300'
                          }`}
                          onClick={() => handleTagClick(tag.tagName)}
                          type="button"
                        >
                          <span className="flex items-center">
                            <span>{tag.tagName}</span>
                            <span
                              className={`ml-2 px-1.5 py-0.2 rounded-full text-xs ${
                                isSelected
                                  ? 'bg-primary-content/20 text-primary-content'
                                  : 'bg-base-200 text-base-content/70'
                              }`}
                            >
                              {tag.count}
                            </span>
                          </span>
                        </motion.button>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* 2. その他のタグ */}
            {otherTags.length > 0 && (
              <div>
                {recommendationTags.length > 0 && (
                  <div className="flex items-center justify-between mb-2 pt-1">
                    <span className="font-bold text-xs text-base-content/60 tracking-wide">
                      その他のタグ
                    </span>
                    <span className="text-xs text-base-content/50">
                      {otherTags.length} 件
                    </span>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <AnimatePresence>
                    {otherTags.map((tag) => {
                      const isSelected = parentComponentStateValues.includes(tag.tagName);
                      return (
                        <motion.button
                          key={tag.tagName}
                          layout
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className={`px-3 py-1 rounded-full cursor-pointer text-sm transition-colors ${
                            isSelected
                              ? 'bg-primary text-primary-content font-medium shadow-sm'
                              : 'bg-base-200 text-base-content hover:bg-base-300'
                          }`}
                          onClick={() => handleTagClick(tag.tagName)}
                          type="button"
                        >
                          <span className="flex items-center">
                            <span>{tag.tagName}</span>
                            <span
                              className={`ml-2 px-1.5 py-0.2 rounded-full text-xs ${
                                isSelected
                                  ? 'bg-primary-content/20 text-primary-content'
                                  : 'bg-base-300 text-base-content/70'
                              }`}
                            >
                              {tag.count}
                            </span>
                          </span>
                        </motion.button>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 選択したタグの一覧 */}
      <div className="mt-4">
        <div className="flex justify-between items-center mb-2">
          <h4 className="font-semibold text-sm">選択したタグ:</h4>
          {parentComponentStateValues.length > 0 && (
            <button
              type="button"
              onClick={() => onTagsSelected([])}
              className="text-xs text-error hover:underline"
            >
              すべてクリア
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 min-h-[2.5rem] p-2 bg-base-100 rounded-lg border border-base-300">
          {parentComponentStateValues.length === 0 ? (
            <span className="text-xs text-base-content/50 self-center pl-1">
              タグが選択されていません（上のリストからクリックして選択）
            </span>
          ) : (
            parentComponentStateValues.map((tag) => (
              <motion.button
                key={tag}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="inline-flex items-center px-3 py-1 text-sm font-medium bg-primary text-primary-content rounded-full cursor-pointer shadow-sm"
                onClick={() => handleRemoveSelectedTag(tag)}
                type="button"
              >
                {tag}
                <svg
                  className="w-4 h-4 ml-1.5 text-primary-content/80 hover:text-primary-content"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <title>タグを削除</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </motion.button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
