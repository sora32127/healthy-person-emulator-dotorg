import MDEditor, { commands } from '@uiw/react-md-editor';
import rehypeSanitize from "rehype-sanitize";
import { H2 } from './Headings';


interface MarkdownEditorProps {
    defaultValue: string;
    handleValueChange: (value?: string) => void;
}


export default function MarkdownEditor({ defaultValue, handleValueChange }: MarkdownEditorProps) {
  return (
    <div className="container" data-color-mode="light">
      <MDEditor
        value={defaultValue}
        onChange={handleValueChange}
        previewOptions={{
          rehypePlugins: [[rehypeSanitize]],
        }}
        preview='edit'
        commands={[ commands.title1, commands.title2, commands.title3, commands.bold, commands.italic, commands.link, commands.unorderedListCommand, commands.orderedListCommand, commands.table  ]}
        extraCommands={[commands.codeEdit]}
        height={600}
      />
      <H2>変更プレビュー</H2>
      <MDEditor.Markdown
        source={defaultValue}
        style={{
          padding: 16
        }}
        className='markdownEditorPreview'
      />
    </div>
  );
}
