import React, { useState, useRef, useCallback, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { IconType } from 'react-icons';
import { FaHeading, FaBold, FaItalic, FaLink, FaListUl, FaListOl, FaEye, FaEdit, FaQuestionCircle, FaStrikethrough } from 'react-icons/fa';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
}

interface ToolbarItem {
  label: string;
  icon: IconType;
  action: () => void;
}

export function MarkdownEditor({ value, onChange }: MarkdownEditorProps) {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [showGuide, setShowGuide] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const htmlElement = document.documentElement;
    const observer = new MutationObserver(() => setIsDarkMode(htmlElement.dataset.theme === 'dark'));
    observer.observe(htmlElement, { attributes: true, attributeFilter: ['data-theme'] });
    setIsDarkMode(htmlElement.dataset.theme === 'dark');
    return () => observer.disconnect();
  }, []);

  const insertMarkdown = useCallback((prefix: string, suffix: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const { selectionStart, selectionEnd } = textarea;
    const newText = `${value.slice(0, selectionStart)}${prefix}${value.slice(selectionStart, selectionEnd)}${suffix}${value.slice(selectionEnd)}`;

    onChange(newText);
    textarea.focus();
    textarea.setSelectionRange(selectionStart + prefix.length, selectionEnd + prefix.length);
  }, [value, onChange]);

  const toolbarItems: ToolbarItem[] = [
    { label: '見出し1', icon: FaHeading, action: () => insertMarkdown('# ') },
    { label: '太字', icon: FaBold, action: () => insertMarkdown('**', '**') },
    { label: '斜体', icon: FaItalic, action: () => insertMarkdown('*', '*') },
    { label: '打ち消し線', icon: FaStrikethrough, action: () => insertMarkdown('~~', '~~') },
    { label: 'リンク', icon: FaLink, action: () => insertMarkdown('[', '](url)') },
    { label: '箇条書き', icon: FaListUl, action: () => insertMarkdown('- ') },
    { label: '番号付きリスト', icon: FaListOl, action: () => insertMarkdown('1. ') },
  ];

  const renderToolbarButton = (item: ToolbarItem, index: number) => (
    <div key={index} className="tooltip" data-tip={item.label}>
      <button onClick={item.action} type="button" className="btn btn-sm btn-ghost">
        <item.icon />
      </button>
    </div>
  );

  const renderModeButton = (modeType: 'edit' | 'preview', icon: IconType, tooltip: string) => (
    <div className="tooltip" data-tip={tooltip}>
      <button
        onClick={() => setMode(modeType)}
        type="button"
        className={`btn btn-sm ${mode === modeType ? 'btn-secondary' : 'btn-ghost'}`}
      >
        {React.createElement(icon)}
      </button>
    </div>
  );

  return (
    <div className="card w-full bg-base-100 border">
      <div className="card-body">
        <div className="flex flex-wrap items-center space-x-2 mb-4">
          {toolbarItems.map(renderToolbarButton)}
          <div className="ml-auto flex items-center space-x-2">
            {renderModeButton('edit', FaEdit, 'エディタに切り替え')}
            {renderModeButton('preview', FaEye, 'プレビューに切り替え')}
            <div className="tooltip" data-tip="Markdown記法ガイドを表示">
              <button
                onClick={() => setShowGuide(!showGuide)}
                type="button"
                className={`btn btn-sm ${showGuide ? 'btn-secondary' : 'btn-ghost'}`}
              >
                <FaQuestionCircle />
              </button>
            </div>
          </div>
        </div>
        
        {showGuide && (
          <div className="bg-base-200 p-4 rounded-lg mb-4">
            <h3 className="text-lg font-bold mb-2">Markdown記法ガイド</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold">見出し</h4>
                <p><code># 見出し1</code> - 大見出し</p>
                <p><code>## 見出し2</code> - 中見出し</p>
                <p><code>### 見出し3</code> - 小見出し</p>
              </div>
              <div>
                <h4 className="font-semibold">テキストスタイル</h4>
                <p><code>**太字**</code> - <strong>太字</strong></p>
                <p><code>*斜体*</code> - <em>斜体</em></p>
                <p><code>~~打ち消し線~~</code> - <del>打ち消し線</del></p>
              </div>
              <div>
                <h4 className="font-semibold">リスト</h4>
                <p><code>- 項目</code> or <code>* 項目</code> - 箇条書き</p>
                <p><code>1. 項目</code> - 番号付きリスト</p>
              </div>
              <div>
                <h4 className="font-semibold">その他</h4>
                <p><code>[リンクテキスト](URL)</code> - リンク</p>
              </div>
            </div>
          </div>
        )}
        
        <div className="w-full">
          {mode === 'edit' ? (
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="textarea textarea-bordered w-full min-h-[32rem]"
            />
          ) : (
            <div className="max-w-none markdownEditorPreview">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}