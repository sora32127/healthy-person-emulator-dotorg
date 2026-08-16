import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface Tag {
  tagName: string;
  count: number;
  categoryCode?: string | null;
  categoryName?: string | null;
  displayOrder?: number | null;
}

interface TagSelectionBoxProps {
  onTagsSelected: (tags: string[]) => void;
  parentComponentStateValues: string[];
  allTagsOnlyForSearch: Tag[];
}

const CATEGORY_ORDER: { code: string; label: string; icon: string }[] = [
  { code: 'A', label: '推奨事項（型）', icon: '📌' },
  { code: 'B', label: '人物 (Who)', icon: '👤' },
  { code: 'C', label: '時期 (When)', icon: '🕒' },
  { code: 'D', label: '場所 (Where)', icon: '📍' },
  { code: 'E', label: '対象 (What)', icon: '💬' },
  { code: 'F', label: '状態・特性', icon: '🧠' },
  { code: 'G', label: '結果 (Then)', icon: '💭' },
  { code: 'H', label: '注意・リスク', icon: '⚠️' },
  { code: 'I', label: '作法・ノウハウ', icon: '💡' },
  { code: 'J', label: '健エミュ・運営', icon: '🏢' },
];

export default function TagSelectionBox({
  onTagsSelected,
  parentComponentStateValues,
  allTagsOnlyForSearch,
}: TagSelectionBoxProps) {
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');
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

  // カテゴリごとのタグ件数集計
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allTagsOnlyForSearch.length };
    for (const tag of allTagsOnlyForSearch) {
      const code = tag.categoryCode || 'other';
      counts[code] = (counts[code] || 0) + 1;
    }
    return counts;
  }, [allTagsOnlyForSearch]);

  // 検索・カテゴリフィルタリング
  const filteredTags = useMemo(() => {
    return allTagsOnlyForSearch
      .filter((tag) => {
        const matchesSearch =
          !searchText || tag.tagName.toLowerCase().includes(searchText.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || tag.categoryCode === selectedCategory;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        if (sortBy === 'count') {
          return b.count - a.count;
        }
        return a.tagName.localeCompare(b.tagName, 'ja');
      });
  }, [allTagsOnlyForSearch, searchText, selectedCategory, sortBy]);

  // グループ別表示用のデータ構造
  const groupedTags = useMemo(() => {
    const groups: {
      code: string;
      label: string;
      icon: string;
      tags: Tag[];
    }[] = [];

    const searchFiltered = allTagsOnlyForSearch.filter(
      (tag) => !searchText || tag.tagName.toLowerCase().includes(searchText.toLowerCase()),
    );

    for (const cat of CATEGORY_ORDER) {
      if (selectedCategory !== 'all' && selectedCategory !== cat.code) continue;

      const tagsInCat = searchFiltered
        .filter((t) => t.categoryCode === cat.code)
        .sort((a, b) => {
          if (sortBy === 'count') {
            return b.count - a.count;
          }
          return a.tagName.localeCompare(b.tagName, 'ja');
        });

      if (tagsInCat.length > 0) {
        groups.push({
          code: cat.code,
          label: cat.label,
          icon: cat.icon,
          tags: tagsInCat,
        });
      }
    }

    // 未分類
    const unclassified = searchFiltered.filter((t) => !t.categoryCode);
    if (unclassified.length > 0 && (selectedCategory === 'all' || selectedCategory === 'other')) {
      groups.push({
        code: 'other',
        label: 'その他・未分類',
        icon: '📁',
        tags: unclassified.sort((a, b) => b.count - a.count),
      });
    }

    return groups;
  }, [allTagsOnlyForSearch, searchText, selectedCategory, sortBy]);

  return (
    <div className="mb-8 bg-base-200 p-6 rounded-lg shadow-md">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
        <h3 className="text-xl font-bold">タグを選択してください</h3>
        <span className="text-sm text-base-content/70">
          選択中:{' '}
          <strong className="text-primary font-bold">{parentComponentStateValues.length}</strong> 件
        </span>
      </div>

      {/* 検索 & 絞り込みコントロール */}
      <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 mb-3">
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

        <div className="flex space-x-2">
          <select
            className="select select-bordered"
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as 'grouped' | 'flat')}
            aria-label="表示形式"
          >
            <option value="grouped">カテゴリ別表示</option>
            <option value="flat">一括一覧表示</option>
          </select>

          <select
            className="select select-bordered"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'count' | 'name')}
            aria-label="タグ並び替え"
          >
            <option value="count">タグ数順</option>
            <option value="name">五十音順</option>
          </select>
        </div>
      </div>

      {/* カテゴリ切り替えタブ（水平スクロール） */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-thin">
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={`btn btn-xs rounded-full whitespace-nowrap ${
            selectedCategory === 'all' ? 'btn-primary' : 'btn-ghost bg-base-100 hover:bg-base-300'
          }`}
        >
          すべて ({categoryCounts.all || 0})
        </button>
        {CATEGORY_ORDER.map((cat) => {
          const countInCat = categoryCounts[cat.code] || 0;
          if (countInCat === 0) return null;
          return (
            <button
              key={cat.code}
              type="button"
              onClick={() => setSelectedCategory(cat.code)}
              className={`btn btn-xs rounded-full whitespace-nowrap ${
                selectedCategory === cat.code
                  ? 'btn-primary'
                  : 'btn-ghost bg-base-100 hover:bg-base-300'
              }`}
            >
              <span className="mr-1">{cat.icon}</span>
              {cat.label} ({countInCat})
            </button>
          );
        })}
      </div>

      {/* タグ表示エリア */}
      <div className="h-96 overflow-y-auto p-4 bg-base-100 rounded-lg space-y-4">
        {viewMode === 'grouped' ? (
          // カテゴリ別グループ表示
          groupedTags.length === 0 ? (
            <div className="text-center text-base-content/60 py-12">
              該当するタグが見つかりませんでした
            </div>
          ) : (
            groupedTags.map((group) => (
              <div key={group.code} className="space-y-2">
                <div className="flex items-center gap-2 border-b border-base-200 pb-1 pt-1">
                  <span className="text-base">{group.icon}</span>
                  <h4 className="font-bold text-sm text-base-content/80">{group.label}</h4>
                  <span className="badge badge-sm badge-ghost text-xs">{group.tags.length} 件</span>
                </div>
                <div className="flex flex-wrap gap-2 pl-1">
                  <AnimatePresence>
                    {group.tags.map((tag) => (
                      <motion.button
                        key={tag.tagName}
                        layout
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={`px-3 py-1 rounded-full cursor-pointer text-sm transition-colors ${
                          parentComponentStateValues.includes(tag.tagName)
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
                              parentComponentStateValues.includes(tag.tagName)
                                ? 'bg-primary-content/20 text-primary-content'
                                : 'bg-base-300 text-base-content/70'
                            }`}
                          >
                            {tag.count}
                          </span>
                        </span>
                      </motion.button>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            ))
          )
        ) : (
          // 一括フラット表示
          <div className="flex flex-wrap gap-2">
            {filteredTags.length === 0 ? (
              <div className="w-full text-center text-base-content/60 py-12">
                該当するタグが見つかりませんでした
              </div>
            ) : (
              <AnimatePresence>
                {filteredTags.map((tag) => (
                  <motion.button
                    key={tag.tagName}
                    layout
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`px-3 py-1 rounded-full cursor-pointer text-sm ${
                      parentComponentStateValues.includes(tag.tagName)
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
                          parentComponentStateValues.includes(tag.tagName)
                            ? 'bg-primary-content/20 text-primary-content'
                            : 'bg-base-300 text-base-content/70'
                        }`}
                      >
                        {tag.count}
                      </span>
                    </span>
                  </motion.button>
                ))}
              </AnimatePresence>
            )}
          </div>
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
