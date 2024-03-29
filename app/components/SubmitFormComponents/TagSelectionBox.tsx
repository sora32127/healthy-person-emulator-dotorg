import { useState, useEffect } from 'react';
import axios from 'axios';
import { Form } from "@remix-run/react";

interface Tag {
    count: number;
    name: string;
}

interface TagSelectionBoxProps {
    onTagsSelected: (tags: string[]) => void;
    parentComponentStateValues: string[];
}

const TagSelectionBox = ({ onTagsSelected, parentComponentStateValues }: TagSelectionBoxProps): JSX.Element => {
    const [tags, setTags] = useState<Tag[]>([]);
    const [searchText, setSearchText] = useState('');
    const [sortBy, setSortBy] = useState<'count' | 'name'>('count');

    useEffect(() => {
        const getTags = async () => {
            let allTags: Tag[] = [];
            let page = 1;
            let hasMore = true;

            while (hasMore) {
                try {
                    const response = await axios.get(`https://healthy-person-emulator.org/wp-json/wp/v2/tags?per_page=100&page=${page}`);
                    allTags = [...allTags, ...response.data];
                    if (response.data.length < 100) {
                        hasMore = false;
                    } else {
                        page += 1;
                    }
                } catch (error) {
                    console.error(error);
                    hasMore = false;
                }
            }

            setTags(allTags);
        };

        getTags();
    }, []);

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

    const filteredTags = tags
        .filter(tag => tag.name.includes(searchText))
        .sort((a, b) => {
            if (sortBy === 'count') {
                return b.count - a.count;
            } else {
                return a.name.localeCompare(b.name, 'ja');
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
                    <li
                        key={tag.name}
                        className={`px-4 py-2 rounded-lg cursor-pointer ${
                            parentComponentStateValues.includes(tag.name)
                                ? 'text-white bg-blue-500'
                                : 'text-gray-700 bg-gray-200 hover:bg-gray-300'
                        }`}
                        onClick={() => handleTagClick(tag.name)}
                    >
                        {tag.name} ({tag.count})
                    </li>
                ))}
            </ul>
            <div className="mt-4">
                <h4 className="text-xl font-bold mb-2">選択したタグ:</h4>
                <div className="flex flex-wrap">
                    {parentComponentStateValues.map(tag => (
                        <span
                            key={tag}
                            className="inline-flex items-center px-2 py-1 mr-2 mb-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-full cursor-pointer"
                            onClick={() => handleRemoveSelectedTag(tag)}
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

export default TagSelectionBox;
