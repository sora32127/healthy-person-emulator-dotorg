import XLogo from '~/src/assets/X_logo_2023_(white).png';
import MastodonLogo from '~/src/assets/mastodon_logo.svg';
import MisskeyLogo from '~/src/assets/misskey_icon.png';
import { CopyToClipboardButton } from './CopyToClipboardButton';
import { ShareApiButton } from './ShareApiButton';
import { useMemo } from 'react';

interface ShareButtonsProps {
  currentURL: string;
  postTitle: string;
}

export default function PostShareButtonGroup({
  currentURL,
  postTitle,
}: ShareButtonsProps) {
  const socialShareText = useMemo(
    () => `${postTitle} - 健常者エミュレータ事例集`,
    [postTitle],
  );
  const url = new URL(currentURL);
  const hatenaBlogUrl = url.hostname + url.pathname;

  return (
    <div className="flex justify-center items-center space-x-4">
      <button
        type="button"
        className="bg-black flex items-center justify-center space-x-2 px-4 py-2 rounded-full"
      >
        <a
          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(socialShareText)}&url=${encodeURIComponent(currentURL)}`}
          className="flex items-center"
        >
          <img src={XLogo} alt="X" width="20" height="20" />
        </a>
      </button>
      <button type="button">
        <a href={`https://b.hatena.ne.jp/entry/s/${hatenaBlogUrl}`}>
          <img
            src="https://b.st-hatena.com/images/v4/public/entry-button/button-only@2x.png"
            alt="このエントリーをはてなブックマークに追加"
            width="40"
            height="40"
          />
        </a>
      </button>
      <button
        type="button"
        className="bg-violet-800 flex items-center justify-center space-x-2 px-4 py-2 rounded-full"
      >
        <a
          href={`https://donshare.net/share.html?text=${encodeURIComponent(socialShareText)}&url=${encodeURIComponent(currentURL)}`}
          className="flex items-center"
        >
          <img src={MastodonLogo} alt="donshare" width="20" height="20" />
        </a>
      </button>
      <button
        type="button"
        className="bg-green-200 flex items-center justify-center space-x-2 px-4 py-2 rounded-full"
      >
        <a
          href={`https://misskeyshare.link/share.html?text=${encodeURIComponent(socialShareText)}&url=${encodeURIComponent(currentURL)}`}
          className="flex items-center"
        >
          <img src={MisskeyLogo} alt="misskeyshare" width="20" height="20" />
        </a>
      </button>

      <CopyToClipboardButton textToCopy={currentURL} variant="post" />
      <ShareApiButton url={currentURL} title={socialShareText} variant="post" />
    </div>
  );
}
