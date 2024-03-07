import { Badge } from 'react-bootstrap';

interface TagPreviewBoxProps {
  selectedTags: string[];
  createdTags: string[];
}

const TagPreviewBox: React.FC<TagPreviewBoxProps> = ({ selectedTags, createdTags}) => {
  return (
    <div>
      <h3>選択したタグ</h3>
      <p>以下のタグを付与します。</p>
      <div>
        {selectedTags.map(tag => (
          <Badge key={tag} pill className="mr-2">
            {tag}
          </Badge>
        ))}
        {createdTags.map(tag => (
          <Badge key={tag} pill className="mr-2">
            {tag}
        </Badge>
        ))}
      </div>
    </div>
  );
};

export default TagPreviewBox;