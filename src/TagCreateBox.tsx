import React, { useState } from 'react';
import { Form, Button, Badge } from 'react-bootstrap';

interface TagCreateBoxProps {
  handleTagCreated: (tag: string) => void;
  handleTagRemoved: (tag: string) => void;
  parentComponentStateValues: string[];
}

const TagCreateBox: React.FC<TagCreateBoxProps> = ({ handleTagCreated, handleTagRemoved, parentComponentStateValues}) => {
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
        {parentComponentStateValues.map((tag) => (
          <Badge
            key={tag}
            pill
            className="mr-2"
            style={{ cursor: 'pointer' }}
            onClick={() => handleTagRemoved(tag)}
          >
            {tag} x
          </Badge>
        ))}
      </div>
    </div>
  );
};

export default TagCreateBox;