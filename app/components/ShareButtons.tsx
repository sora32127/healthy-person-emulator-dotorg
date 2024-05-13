import { useState } from "react";
import XLogo from "~/src/assets/X_logo_2023_(white).png";
import MastodonLogo from "~/src/assets/mastodon_logo_black.svg"
import MisskeyLogo from "~/src/assets/misskey_icon.png"
import CopyToClipBoard from "./icons/CopyToClipboard";
import ShareButtonAPI from "./icons/ShareButtonAPI";

interface ShareButtonsProps {
    currentURL: string;
    postTitle: string;
}

export default function ShareButtons({ currentURL, postTitle }: ShareButtonsProps) {
    const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
    const socialShareText = encodeURIComponent(`${postTitle}-健常者エミュレータ事例集`);
    const url = new URL(currentURL);
    const hatenaBlogUrl = url.hostname + url.pathname;
    const copy = async (currentURL: string) => {
        await navigator.clipboard.writeText(currentURL);
        setCopyStatus("copied");
        setTimeout(() => {
            setCopyStatus("idle");
        }, 2000);
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
            <button type="button" className="bg-green-500 flex items-center justify-center space-x-2 px-4 py-2 rounded-full">
                <a
                    href={`https://misskeyshare.link/share.html?text=${socialShareText}&url=${encodeURIComponent(currentURL)}`}
                    className="flex items-center"
                >
                    <img src={MisskeyLogo} alt="misskeyshare" width="20" height="20" />
                </a>
            </button>
            <div className="relative inline-block group">
                <button 
                    type="button" 
                    onClick={() => copy(currentURL)}
                    className="hover:bg-base-300 rounded-full p-2 transition-colors duration-300"
                >
                    <CopyToClipBoard />
                </button>
                <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 bg-base-200 text-xs py-1 px-2 rounded opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none whitespace-nowrap">
                    {copyStatus === "idle" ? "クリップボードにコピー" : "クリップボードにコピーしました"}
                </span>
            </div>
            <div className="relative inline-block group">
                <button type="button" onClick={() => invokeShareAPI(currentURL, postTitle)} className="hover:bg-base-300 rounded-full p-2 transition-colors duration-300">
                    <ShareButtonAPI />
                </button>
                <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 bg-base-200 text-xs py-1 px-2 rounded opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none whitespace-nowrap">
                    シェアする
                </span>
            </div>
        </div>
    );
}
