import { useEffect } from "react";

export default function ShareButtons() {
    useEffect(() => {
        const twitterScript = document.createElement("script");
        twitterScript.src = "https://platform.twitter.com/widgets.js";
        twitterScript.async = true;
        document.body.appendChild(twitterScript);

        const hatenaScript = document.createElement("script");
        hatenaScript.src = "https://b.st-hatena.com/js/bookmark_button.js";
        hatenaScript.type = "text/javascript";
        hatenaScript.dataset.scripttype = "module";
        document.body.appendChild(hatenaScript);

        return () => {
            document.body.removeChild(twitterScript);
            document.body.removeChild(hatenaScript);
        };
    }, []);

    return (
        <div className="flex justify-center items-center space-x-4">
            <a
                href="https://twitter.com/share?ref_src=twsrc%5Etfw"
                className="twitter-share-button"
                data-size="large"
                data-lang="ja"
                data-show-count="false"
            >
                Tweet
            </a>
            <a
                href="https://b.hatena.ne.jp/entry/"
                className="hatena-bookmark-button"
                data-hatena-bookmark-layout="vertical-normal"
                data-hatena-bookmark-lang="ja"
                title="このエントリーをはてなブックマークに追加"
            >
                <img
                    src="https://b.st-hatena.com/images/v4/public/entry-button/button-only@2x.png"
                    alt="このエントリーをはてなブックマークに追加"
                    width="20"
                    height="20"
                />
            </a>
        </div>
    );
}