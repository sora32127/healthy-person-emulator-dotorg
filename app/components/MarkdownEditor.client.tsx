import MDEditor from '@uiw/react-md-editor';

interface MarkdownEditorProps {
    defaultValue: string;
    handleValueChange: (value?: string) => void;
}

export default function MarkdownEditor({ defaultValue, handleValueChange }: MarkdownEditorProps) {
  return (
    <div className="container">
      <MDEditor
        value={defaultValue}
        onChange={handleValueChange}
      />
    </div>
  );
}
