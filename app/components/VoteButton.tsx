import { ThumbsUp, ThumbsDown } from 'lucide-react';


export function VoteButton({ type, count, isAnimating, isVoted, disabled, onClick }: { type: "like" | "dislike", count: number, isAnimating: boolean, isVoted: boolean, disabled: boolean, onClick: (event: React.MouseEvent<HTMLButtonElement>) => void }) {
  return (
    <div>
      <button
        type="submit"
        className={`flex items-center rounded-md px-2 py-2 mx-1 transition-all duration-500 ${
          isAnimating
            ? 'animate-voteSpin bg-base-300'
            : isVoted
            ? `text-${type === 'like' ? 'blue' : 'red'}-500 font-bold bg-base-300`
            : 'bg-base-300 hover:bg-base-200'
        }`}
        disabled={disabled}
        onClick={onClick}
      >
        {type === 'like' ? <ThumbsUp className="fill-none stroke-current" /> : <ThumbsDown className="fill-none stroke-current" />}
        <p className="ml-2">
          {count}
        </p>
      </button>
    </div>
  );
}