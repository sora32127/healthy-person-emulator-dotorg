import React, { useState } from 'react';
import { Form } from "@remix-run/react";

interface TagCreateBoxProps {
  handleTagCreated: (tag: string) => void;
  handleTagRemoved: (tag: string) => void;
  parentComponentStateValues: string[];
}

const TagCreateBox: React.FC<TagCreateBoxProps> = ({ handleTagCreated, handleTagRemoved, parentComponentStateValues }) => {
  const [tagInput, setTagInput] = useState('');

  const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTagInput(e.target.value);
  };

  const handleCreateTag = () => {
    if (tagInput.trim() !== '') {
      const newTag = tagInput.trim();
      handleTagCreated(newTag);
      setTagInput('');
    }
  };

  return (
    <div className="mb-8">
      <h3 className="text-2xl font-bold mb-4">タグ作成</h3>
      <div className="mb-4">
        <label htmlFor="tagInput" className="block font-bold mb-2">
          新しいタグを入力してください
        </label>
        <input
          type="text"
          id="tagInput"
          value={tagInput}
          onChange={handleTagInputChange}
          placeholder="タグを入力..."
          className="w-full px-3 py-2 placeholder-slate-500 border rounded-lg focus:outline-none tag-create-box-input"
        />
      </div>
      <button
        type="button"
        onClick={handleCreateTag}
        className="px-4 py-2 font-bold text-white bg-blue-600 rounded-full focus:outline-none focus:shadow-outline"
      >
        タグを作成
      </button>
      <div className="mt-4">
        <h4 className="text-xl font-bold mb-2">作成したタグ:</h4>
        <div className="flex flex-wrap">
          {parentComponentStateValues.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-2 py-1 mr-2 mb-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-full cursor-pointer"
              onClick={() => handleTagRemoved(tag)}
            >
              {tag}
              <svg
                className="w-4 h-4 ml-1"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TagCreateBox;
