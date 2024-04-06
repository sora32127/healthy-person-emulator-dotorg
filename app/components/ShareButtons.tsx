export default function ShareButtons() {
    return (
        <div className="flex justify-center space-x-4">
            <a
                href="https://twitter.com/share?ref_src=twsrc%5Etfw" className="twitter-share-button" 
                data-show-count="false">Tweet</a><script async src="https://platform.twitter.com/widgets.js"></script>
            <a
                href="https://b.hatena.ne.jp/entry/" 
                className="hatena-bookmark-button" 
                data-hatena-bookmark-layout="vertical-normal" 
                data-hatena-bookmark-lang="ja" title="このエントリーをはてなブックマークに追加">
                <img
                    src="https://b.st-hatena.com/images/v4/public/entry-button/button-only@2x.png"
                    alt="このエントリーをはてなブックマークに追加" 
                    width="20"
                    height="20"
                    />
            </a>
                <script type="text/javascript" src="https://b.st-hatena.com/js/bookmark_button.js"></script>
        </div>
    );
}