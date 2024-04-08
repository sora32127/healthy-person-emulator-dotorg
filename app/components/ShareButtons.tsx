import XLogo from "~/src/assets/X_logo_2023_(white).png";

interface ShareButtonsProps {
    currentURL: string;
    postTitle: string;
}

export default function ShareButtons({ currentURL, postTitle }: ShareButtonsProps) {
    const twitterShareText = encodeURIComponent(`${postTitle}-健常者エミュレータ事例集`);
    const url = new URL(currentURL);
    const hatenaBlogUrl = url.hostname + url.pathname;

    return (
        <div className="flex justify-center items-center space-x-4">
            <button type="button" className="bg-black flex items-center justify-center space-x-2 px-4 py-2 rounded-full">
                <a
                    href={`https://twitter.com/intent/tweet?text=${twitterShareText}&url=${encodeURIComponent(currentURL)}`}
                    className="flex items-center"
                >
                    <img src={XLogo} alt="X" width="20" height="20" />
                    <p className="text-white pl-2">シェア</p>
                </a>
           </button>
           <button type="button">
                <a
                    href={`https://b.hatena.ne.jp/entry/s/${hatenaBlogUrl}`}
                >
                    <img
                        src="https://b.st-hatena.com/images/v4/public/entry-button/button-only@2x.png"
                        alt="このエントリーをはてなブックマークに追加"
                        width="40"
                        height="40"
                    />
                </a>
            </button>
        </div>
    );
}