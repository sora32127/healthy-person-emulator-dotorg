import toast from 'react-hot-toast';
import ShareIcon from './icons/ShareIcon';
import { useMemo } from 'react';

type ShareButtonProps = {
  url: string;
  title: string;
  variant?: 'comment' | 'post';
};

export const ShareApiButton = ({
  url,
  title,
  variant = 'post',
}: ShareButtonProps) => {
  const share = async (url: string, title: string) => {
    try {
      await navigator.share({ url, title });
      toast.success('シェアしました。');
    } catch (error) {
      toast.error('シェアできませんでした。');
    }
  };

  const buttonClass = useMemo(
    () =>
      variant === 'comment'
        ? 'btn btn-circle btn-sm btn-ghost'
        : 'hover:bg-base-300 rounded-full p-2 transition-colors duration-300',
    [variant],
  );

  const iconClass = useMemo(
    () => (variant === 'comment' ? 'w-4 h-4' : ''),
    [variant],
  );

  return (
    <div className="tooltip" data-tip="シェアする">
      <button
        type="button"
        onClick={() => share(url, title)}
        className={buttonClass}
      >
        <ShareIcon className={iconClass} />
      </button>
    </div>
  );
};
