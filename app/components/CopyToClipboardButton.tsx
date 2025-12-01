import toast from 'react-hot-toast';
import ClipboardIcon from './icons/ClipboardIcon';
import { useMemo } from 'react';

type CopyToClipboardButtonProps = {
  textToCopy: string;
  variant?: 'comment' | 'post';
};

export const CopyToClipboardButton = ({
  textToCopy,
  variant = 'post',
}: CopyToClipboardButtonProps) => {
  const copy = async (textToCopy: string) => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      toast.success('クリップボードにコピーしました。');
    } catch (error) {
      toast.error('クリップボードにコピーできませんでした。');
    }
  };

  const buttonClass = useMemo(
    () =>
      variant === 'comment'
        ? 'btn btn-circle btn-sm btn-ghost'
        : 'hover:bg-base-300 rounded-full p-2 transition-colors duration-300',
    [variant],
  );

  const iconClass = variant === 'comment' ? 'w-4 h-4' : '';

  return (
    <div className="tooltip" data-tip="URLをクリップボードにコピー">
      <button
        type="button"
        onClick={() => copy(textToCopy)}
        className={buttonClass}
      >
        <ClipboardIcon className={iconClass} />
      </button>
    </div>
  );
};
