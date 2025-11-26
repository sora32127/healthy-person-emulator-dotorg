import { Link } from '@remix-run/react';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

export function SNSLinks({
  tweetIdOfFirstTweet,
  blueskyPostUriOfFirstPost,
  misskeyNoteIdOfFirstNote,
}: {
  tweetIdOfFirstTweet: string | null;
  blueskyPostUriOfFirstPost: string | null;
  misskeyNoteIdOfFirstNote: string | null;
}) {
  if (
    !tweetIdOfFirstTweet &&
    !blueskyPostUriOfFirstPost &&
    !misskeyNoteIdOfFirstNote
  ) {
    return null;
  }

  return (
    <div className="collapse collapse-arrow bg-base-200 rounded-lg shadow-sm transition-all duration-300 mx-auto my-4 max-w-2xl w-full">
      <input type="checkbox" className="peer" />
      <div className="collapse-title font-medium flex items-center justify-between p-4 md:p-6">
        <span className="flex items-center gap-2">
          <span>投稿時の反応を見る</span>
        </span>
      </div>
      <div className="collapse-content px-4 md:px-6">
        <div className="grid gap-3 py-2">
          {tweetIdOfFirstTweet && (
            <a
              href={`https://twitter.com/x/status/${tweetIdOfFirstTweet}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-info flex items-center gap-2 hover:gap-3 hover:underline hover:underline-offset-4 transition-all duration-200"
            >
              Twitterでの反応を見る
              <ExternalLink className="h-4 w-4 md:h-5 md:w-5 fill-none stroke-current" />
            </a>
          )}
          {blueskyPostUriOfFirstPost && (
            <a
              href={`https://bsky.app/profile/helthypersonemu.bsky.social/post/${blueskyPostUriOfFirstPost.split('/').pop()}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-info flex items-center gap-2 hover:gap-3 hover:underline hover:underline-offset-4 transition-all duration-200"
            >
              Blueskyでの反応を見る
              <ExternalLink className="h-4 w-4 md:h-5 md:w-5 fill-none stroke-current" />
            </a>
          )}
          {misskeyNoteIdOfFirstNote && (
            <a
              href={`https://misskey.io/notes/${misskeyNoteIdOfFirstNote}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-info flex items-center gap-2 hover:gap-3 hover:underline hover:underline-offset-4 transition-all duration-200"
            >
              Misskeyでの反応を見る
              <ExternalLink className="h-4 w-4 md:h-5 md:w-5 fill-none stroke-current" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
