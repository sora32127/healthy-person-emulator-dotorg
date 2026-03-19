interface TagPreviewBoxProps {
  selectedTags: string[];
  createdTags: string[];
}

export default function TagPreviewBox({ selectedTags, createdTags }: TagPreviewBoxProps) {
  return (
    <div className="mb-8">
      <h3 className="text-2xl font-bold mb-4">選択したタグ</h3>
      <p className="mb-4">以下のタグを付与します。</p>
      <div className="flex flex-wrap">
        {selectedTags.map((tag) => (
          <span
            key={tag}
            className="inline-block bg-secondary text-secondary-content rounded-full px-3 py-1 text-sm font-semibold mr-2 mb-2"
          >
            {tag}
          </span>
        ))}
        {createdTags.map((tag) => (
          <span
            key={tag}
            className="inline-block bg-success text-success-content rounded-full px-3 py-1 text-sm font-semibold mr-2 mb-2"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
