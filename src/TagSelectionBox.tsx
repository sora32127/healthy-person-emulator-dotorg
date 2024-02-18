import { useState, useEffect } from 'react';
import axios from 'axios';

interface Tag {
    count: number;
    name: string;
}

const TagSelectionBox = (): JSX.Element => {
    const [tags, setTags] = useState<Tag[]>([]);
    const [searchText, setSearchText] = useState('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);

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
        if (selectedTags.includes(tagName)) {
            setSelectedTags(selectedTags.filter(tag => tag !== tagName));
        } else {
            setSelectedTags([...selectedTags, tagName]);
        }
    };

    const filteredTags = tags.filter(tag => tag.name.includes(searchText));

    return (
        <div>
            <input
                type="text"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
            />
            <div className="TagSelectionBox">
                {filteredTags.map(tag => (
                    <div
                        key={tag.name}
                        style={{
                            cursor: 'pointer',
                            backgroundColor: selectedTags.includes(tag.name) ? 'lightblue' : 'transparent',
                        }}
                        onClick={() => handleTagClick(tag.name)}
                    >
                        {tag.name} ({tag.count})
                    </div>
                ))}
            </div>
        </div>
    );
}

export default TagSelectionBox;
