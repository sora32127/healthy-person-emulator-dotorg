import { useState } from 'react';

interface Tag {
    tagName: string;
    count: number;
}

interface TagSelectionBoxProps {
    onTagsSelected: (tags: string[]) => void;
    parentComponentStateValues: string[];
    allTagsOnlyForSearch: Tag[];
}

const TagSelectionBox = ({
    onTagsSelected,
    parentComponentStateValues,
    allTagsOnlyForSearch,
}: TagSelectionBoxProps): JSX.Element => {
    const [searchText, setSearchText] = useState('');
    const [sortBy, setSortBy] = useState<'count' | 'name'>('count');


    const handleTagClick = (tagName: string) => {
        if (parentComponentStateValues.includes(tagName)) {
            onTagsSelected(parentComponentStateValues.filter(tag => tag !== tagName));
        } else {
            onTagsSelected([...parentComponentStateValues, tagName]);
        }
    };

    const handleRemoveSelectedTag = (tagName: string) => {
        onTagsSelected(parentComponentStateValues.filter(tag => tag !== tagName));
    };

    const filteredTags = allTagsOnlyForSearch
        .filter(tag => tag.tagName.includes(searchText))
        .sort((a, b) => {
            if (sortBy === 'count') {
                return b.count - a.count;
            } else {
                return a.tagName.localeCompare(b.tagName, 'ja');
            }
        });

    return (
        <div className="mb-8">
            <h3 className="text-2xl font-bold mb-4">タグ選択</h3>
            <p className="text-gray-600 mb-4">タグを選択してください。</p>
            <input
                type="text"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                placeholder="タグを検索..."
                className="w-full px-3 py-2 text-gray-700 border rounded-lg focus:outline-none mb-4"
            />
            <div className="flex space-x-2 mb-4">
                <button
                    type="button"
                    className={`px-4 py-2 rounded-lg focus:outline-none ${
                        sortBy === 'count'
                            ? 'text-white bg-blue-500 hover:bg-blue-600'
                            : 'text-gray-700 bg-gray-200 hover:bg-gray-300'
                    }`}
                    onClick={() => setSortBy('count')}
                >
                    タグ数順で並び替え
                </button>
                <button
                    type="button"
                    className={`px-4 py-2 rounded-lg focus:outline-none ${
                        sortBy === 'name'
                            ? 'text-white bg-blue-500 hover:bg-blue-600'
                            : 'text-gray-700 bg-gray-200 hover:bg-gray-300'
                    }`}
                    onClick={() => setSortBy('name')}
                >
                    五十音順で並び替え
                </button>
            </div>
            <ul className="space-y-2 max-h-80 overflow-y-auto">
            {filteredTags.map(tag => (
            <button
                key={`${tag.tagName}-${tag.count}`}
                className={`px-4 py-2 rounded-lg cursor-pointer focus:outline-none ${
                parentComponentStateValues.includes(tag.tagName)
                    ? 'text-white bg-blue-500'
                    : 'text-gray-700 bg-gray-200 hover:bg-gray-300'
                }`}
                onClick={() => handleTagClick(tag.tagName)}
                type="button"
            >
                {tag.tagName} ({tag.count})
            </button>
            ))}
            </ul>
            <div className="mt-4">
                <h4 className="text-xl font-bold mb-2">選択したタグ:</h4>
                <div className="flex flex-wrap">
                {parentComponentStateValues.map(tag => (
                    <button
                        key={tag}
                        className="inline-flex items-center px-2 py-1 mr-2 mb-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-full cursor-pointer focus:outline-none"
                        onClick={() => handleRemoveSelectedTag(tag)}
                        type="button"
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
                    </button>
                ))}
                </div>
            </div>
        </div>
    );
};

export default TagSelectionBox;
