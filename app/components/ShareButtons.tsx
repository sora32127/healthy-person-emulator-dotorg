import { useState } from "react";
import XLogo from "~/src/assets/X_logo_2023_(white).png";
import CopyToClipBoard from "./icons/CopyToClipboard";
import ShareButtonAPI from "./icons/ShareButtonAPI";

interface ShareButtonsProps {
    currentURL: string;
    postTitle: string;
}

export default function ShareButtons({ currentURL, postTitle }: ShareButtonsProps) {
    const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
    const twitterShareText = encodeURIComponent(`${postTitle}-健常者エミュレータ事例集`);
    const url = new URL(currentURL);
    const hatenaBlogUrl = url.hostname + url.pathname;
    const copy = async (currentURL: string) => {
        await navigator.clipboard.writeText(currentURL);
        setCopyStatus("copied");
        setTimeout(() => {
            setCopyStatus("idle");
        }, 2000);
    }

    const invokeShareAPI = async (url: string) => {
        try {
            await navigator.share({ url });
        } catch (error) {
            console.error("シェアAPIが使えませんでした", error);
        }
    }


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
                <button type="button" onClick={() => invokeShareAPI(currentURL)} className="hover:bg-base-300 rounded-full p-2 transition-colors duration-300">
                    <ShareButtonAPI />
                </button>
                <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 bg-base-200 text-xs py-1 px-2 rounded opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none whitespace-nowrap">
                    シェアする
                </span>
            </div>
        </div>
    );
}