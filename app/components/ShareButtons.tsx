import XLogo from "~/src/assets/X_logo_2023_(white).png";
import MastodonLogo from "~/src/assets/mastodon_logo.svg"
import MisskeyLogo from "~/src/assets/misskey_icon.png"
import CopyToClipBoard from "./icons/CopyToClipboard";
import ShareButtonAPI from "./icons/ShareButtonAPI";
import toast from "react-hot-toast";

interface ShareButtonsProps {
    currentURL: string;
    postTitle: string;
}

export default function ShareButtons({ currentURL, postTitle }: ShareButtonsProps) {
    const socialShareText = encodeURIComponent(`${postTitle}-健常者エミュレータ事例集`);
    const url = new URL(currentURL);
    const hatenaBlogUrl = url.hostname + url.pathname;
    const copy = async (currentURL: string) => {
        try {
            await navigator.clipboard.writeText(currentURL);
            toast.success("クリップボードにコピーしました。");
        } catch (error) {
            toast.error("クリップボードにコピーできませんでした。");
        }
    }

    const invokeShareAPI = async (currentURL: string, postTitle: string) => {
        try {
            await navigator.share({ url: currentURL, title: postTitle });
        } catch (error) {
            console.error("シェアAPIが使えませんでした", error);
        }
    }


    return (
        <div className="flex justify-center items-center space-x-4">
            <button type="button" className="bg-black flex items-center justify-center space-x-2 px-4 py-2 rounded-full">
                <a
                    href={`https://twitter.com/intent/tweet?text=${socialShareText}&url=${encodeURIComponent(currentURL)}`}
                    className="flex items-center"
                >
                    <img src={XLogo} alt="X" width="20" height="20" />
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
            <button type="button" className="bg-violet-800 flex items-center justify-center space-x-2 px-4 py-2 rounded-full">
                <a
                    href={`https://donshare.net/share.html?text=${socialShareText}&url=${encodeURIComponent(currentURL)}`}
                    className="flex items-center"
                >
                    <img src={MastodonLogo} alt="donshare" width="20" height="20" />
                </a>
            </button>
            <button type="button" className="bg-green-200 flex items-center justify-center space-x-2 px-4 py-2 rounded-full">
                <a
                    href={`https://misskeyshare.link/share.html?text=${socialShareText}&url=${encodeURIComponent(currentURL)}`}
                    className="flex items-center"
                >
                    <img src={MisskeyLogo} alt="misskeyshare" width="20" height="20" />
                </a>
            </button>
            <div className="tooltip" data-tip ="URLをクリップボードにコピー">
                <button 
                    type="button" 
                    onClick={() => copy(currentURL)}
                    className="hover:bg-base-300 rounded-full p-2 transition-colors duration-300"
                >
                    <CopyToClipBoard />
                </button>
            </div>
            <div className="tooltip" data-tip ="シェアする">
                <button type="button" onClick={() => invokeShareAPI(currentURL, postTitle)} className="hover:bg-base-300 rounded-full p-2 transition-colors duration-300">
                    <ShareButtonAPI />
                </button>
            </div>
        </div>
    );
}
