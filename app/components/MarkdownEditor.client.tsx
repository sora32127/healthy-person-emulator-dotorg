import MDEditor, { commands } from '@uiw/react-md-editor';
import rehypeSanitize from "rehype-sanitize";


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
        previewOptions={{
          rehypePlugins: [[rehypeSanitize]],
        }}
        preview='edit'
        commands={[ commands.title3, commands.bold, commands.italic, commands.link, commands.unorderedListCommand, commands.orderedListCommand, commands.table  ]}
        extraCommands={[commands.codeEdit]}
      />
      <MDEditor.Markdown source={defaultValue}  />
    </div>
  );
}
