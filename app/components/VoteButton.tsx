import { ThumbsUp, ThumbsDown, HandHeart } from 'lucide-react';

export function VoteButton({
  type,
  count,
  isAnimating,
  isVoted,
  disabled,
  onClick,
}: {
  type: 'like' | 'dislike' | 'support';
  count: number;
  isAnimating: boolean;
  isVoted: boolean;
  disabled: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const label = type === 'like' ? 'いいね' : type === 'dislike' ? '良くないね' : '力になりたい';
  const Icon = type === 'like' ? ThumbsUp : type === 'dislike' ? ThumbsDown : HandHeart;

  return (
    <div>
      <button
        type="submit"
        className={`flex items-center rounded-md px-2 py-2 mx-1 transition-all duration-500 ${
          isAnimating
            ? 'animate-voteSpin bg-base-300'
            : isVoted
              ? `${type === 'support' ? 'text-info' : type === 'dislike' ? 'text-error' : 'text-secondary'} font-bold bg-base-300`
              : 'bg-base-300 hover:bg-base-200'
        }`}
        aria-label={`${label} ${count}件`}
        aria-pressed={isVoted}
        title={label}
        disabled={disabled}
        onClick={onClick}
      >
        <Icon className="fill-none stroke-current" aria-hidden="true" />
        <p className="ml-2">{count}</p>
      </button>
    </div>
  );
}
