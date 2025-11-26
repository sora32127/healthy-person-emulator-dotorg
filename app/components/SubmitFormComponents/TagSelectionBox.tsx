import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Tag {
  tagName: string;
  count: number;
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
  const [highlightedTag, setHighlightedTag] = useState<string | null>(null);

  const handleTagClick = (tagName: string) => {
    if (parentComponentStateValues.includes(tagName)) {
      onTagsSelected(
        parentComponentStateValues.filter((tag) => tag !== tagName),
      );
    } else {
      onTagsSelected([...parentComponentStateValues, tagName]);
    }
    // ここでソートを強制的に適用
    setSortBy((prevSort) => prevSort);
  };

  const handleRemoveSelectedTag = (tagName: string) => {
    onTagsSelected(parentComponentStateValues.filter((tag) => tag !== tagName));
  };

  const filteredTags = allTagsOnlyForSearch
    .filter((tag) =>
      tag.tagName.toLowerCase().includes(searchText.toLowerCase()),
    )
    .sort((a, b) => {
      if (sortBy === 'count') {
        return b.count - a.count;
      }
      return a.tagName.localeCompare(b.tagName, 'ja');
    });

  return (
    <div className="mb-8 bg-base-200 p-6 rounded-lg shadow-md">
      <h3 className="text-xl font-bold mb-4">タグを選択してください</h3>
      <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 mb-4">
        <div className="relative flex-grow">
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="タグを検索"
            className="input input-bordered w-full py-2 pl-10 pr-3 placeholder-slate-500"
          />
          <svg
            className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
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
        </div>
        <select
          className="select select-bordered w-full sm:w-auto"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'count' | 'name')}
        >
          <option value="count">タグ数順</option>
          <option value="name">五十音順</option>
        </select>
      </div>
      <div className="h-80 overflow-y-auto p-4 bg-base-100 rounded-lg">
        <div className="flex flex-wrap gap-2">
          <AnimatePresence>
            {filteredTags.map((tag) => (
              <motion.button
                key={tag.tagName}
                layout
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`px-3 py-1 rounded-full cursor-pointer text-sm ${
                  parentComponentStateValues.includes(tag.tagName)
                    ? 'bg-primary text-primary-content'
                    : 'bg-base-200 text-base-content'
                }`}
                onClick={() => handleTagClick(tag.tagName)}
                onMouseEnter={() => setHighlightedTag(tag.tagName)}
                onMouseLeave={() => setHighlightedTag(null)}
                type="button"
              >
                <span className="flex items-center">
                  <span>{tag.tagName}</span>
                  <span className="ml-2 bg-base-300 text-base-content px-2 py-0.5 rounded-full text-xs">
                    {tag.count}
                  </span>
                </span>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      </div>
      <div className="mt-4">
        <h4 className="font-semibold mb-2">選択したタグ:</h4>
        <div className="flex flex-wrap gap-2 min-h-[2.5rem]">
          {parentComponentStateValues.map((tag) => (
            <motion.button
              key={tag}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="inline-flex items-center px-3 py-1 text-sm font-medium bg-primary text-primary-content rounded-full cursor-pointer"
              onClick={() => handleRemoveSelectedTag(tag)}
              type="button"
            >
              {tag}
              <svg
                className="w-4 h-4 ml-2"
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
          ))}
        </div>
      </div>
    </div>
  );
}
