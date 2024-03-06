import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Form, ListGroup, Button, Badge } from 'react-bootstrap';
import styled from 'styled-components';

interface Tag {
    count: number;
    name: string;
}

interface TagSelectionBoxProps {
    onTagsSelected: (tags: string[]) => void;
    createdTags: string[];
}

const TagListGroup = styled(ListGroup)`
    height: 300px;
    overflow-y: auto;
`;

const TagSelectionBox = ({ onTagsSelected, createdTags }: TagSelectionBoxProps): JSX.Element => {
    const [tags, setTags] = useState<Tag[]>([]);
    const [searchText, setSearchText] = useState('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
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
        if (selectedTags.includes(tagName)) {
            setSelectedTags(selectedTags.filter(tag => tag !== tagName));
        } else {
            setSelectedTags([...selectedTags, tagName]);
        }
    };

    const handleRemoveSelectedTag = (tagName: string) => {
        setSelectedTags(selectedTags.filter(tag => tag !== tagName));
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

    const handleTagsSelected = useCallback(() => {
        const allSelectedTags = [...selectedTags, ...createdTags];
        onTagsSelected(allSelectedTags);
    }, [selectedTags, createdTags, onTagsSelected]);
    
    useEffect(() => {
        handleTagsSelected();
    }, [handleTagsSelected]);

    return (
        <div>
            <h3>タグ選択</h3>
            <p>タグを選択してください。</p>
            <Form.Control
                type="text"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                placeholder="タグを検索..."
            />
            <div className="mt-3">
                <Button
                    variant={sortBy === 'count' ? 'primary' : 'outline-primary'}
                    onClick={() => setSortBy('count')}
                >
                    タグ数順で並び替え
                </Button>{' '}
                <Button
                    variant={sortBy === 'name' ? 'primary' : 'outline-primary'}
                    onClick={() => setSortBy('name')}
                >
                    五十音順で並び替え
                </Button>
            </div>
            <TagListGroup className="mt-3">
                {filteredTags.map(tag => (
                    <ListGroup.Item
                        key={tag.name}
                        action
                        active={selectedTags.includes(tag.name) || createdTags.includes(tag.name)}
                        onClick={() => handleTagClick(tag.name)}
                    >
                        {tag.name} ({tag.count})
                    </ListGroup.Item>
                ))}
            </TagListGroup>
            <div className="mt-3">
                <h4>選択したタグ:</h4>
                {[...selectedTags, ...createdTags].map(tag => (
                    <Badge
                        key={tag}
                        pill
                        className="mr-2"
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleRemoveSelectedTag(tag)}
                    >
                        {tag} x
                    </Badge>
                ))}
            </div>
        </div>
    );
}

export default TagSelectionBox;