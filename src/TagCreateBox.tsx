import React, { useState } from 'react';
import { Form, Button, Badge } from 'react-bootstrap';

interface TagCreateBoxProps {
  onTagCreated: (tag: string) => void;
  onTagRemoved: (tag: string) => void;
}

const TagCreateBox: React.FC<TagCreateBoxProps> = ({ onTagCreated, onTagRemoved }) => {
  const [tagInput, setTagInput] = useState('');
  const [createdTags, setCreatedTags] = useState<string[]>([]);

  const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTagInput(e.target.value);
  };

  const handleCreateTag = () => {
    if (tagInput.trim() !== '') {
      const newTag = tagInput.trim();
      setCreatedTags([...createdTags, newTag]);
      onTagCreated(newTag);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    const updatedTags = createdTags.filter((t) => t !== tag);
    setCreatedTags(updatedTags);
    onTagRemoved(tag);
  };

  return (
    <div>
      <h3>タグ作成</h3>
      <Form.Group controlId="tagInput">
        <Form.Label>新しいタグを入力してください</Form.Label>
        <Form.Control
          type="text"
          value={tagInput}
          onChange={handleTagInputChange}
          placeholder="タグを入力..."
        />
      </Form.Group>
      <Button variant="primary" onClick={handleCreateTag}>
        タグを作成
      </Button>
      <div className="mt-3">
        <h4>作成したタグ:</h4>
        {createdTags.map((tag) => (
          <Badge
            key={tag}
            pill
            className="mr-2"
            style={{ cursor: 'pointer' }}
            onClick={() => handleRemoveTag(tag)}
          >
            {tag} x
          </Badge>
        ))}
      </div>
    </div>
  );
};

export default TagCreateBox;