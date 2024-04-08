import { MetaFunction } from "@remix-run/node";
import { NavLink } from "@remix-run/react";
import { H1, H2, H3 } from "~/components/Headings";

export default function Component() {
    return (
        <div className="postContent md:shadow md:px-4 py-4">
            <H1>サイト説明</H1>
            <H2>健常者エミュレータ事例集とは</H2>
            <ul>
                <li>このサイトは、現実世界に存在する暗黙の知識を集積することで、知識のギャップを解消し、ユーザー全体でよりよい生活を築いていくために生まれました</li>
                <li>暗黙の知識を言語化して集積し、健常者エミュレータを動作させ、現実世界を生きる糧とするのが目的です</li>
                <li>健常者エミュレータが何なのかは<a href="https://contradiction29.hatenablog.com/entry/2021/06/30/210154">管理人が書いた文章</a>を参照してください</li>
                <li>問い合わせは管理人<a href="https://twitter.com/contradiction29">@contradiction29のXのDM</a>までお願いします</li>
            </ul>
            <H2>ユーザーガイドライン</H2>
            <p>健常者エミュレータ事例集に対して、記事やコメントの投稿、記事の編集を行うユーザーに対しては、以下のガイドラインに則って行動することが求められます。</p>
            <H3>新規記事の投稿について</H3>
            <ul>
                <li>誰もが新規ページを作成することが可能です。我々は集合体として、健常者エミュレータを完成させるための個別事例を強く欲しています。ぜひあなたの経験を投稿してください。</li>
                <li>以下の要素を含む投稿を行ってはいけません。</li>
                <ul>
                    <li>基本的人権の否定や、誹謗中傷、暴言、プライバシー違反を含む投稿</li>
                    <li>経験知の集積そのものを否定する行為</li>
                    <li>荒らし行為に該当する投稿</li>
                    <li>経験談ではない記事を投稿すること。自分の経験であるか他人の経験であるかは問わない</li>
                    <li>幼児的かつ性的な表現</li>
                </ul>
                <li>健常者エミュレータ事例集の理念にそぐわないと判断される場合、管理人の裁量に基づき、ページが削除されることがあります。</li>
                <li>ページ作成時は、以下の方針にのっとり記事を作成することを推奨します。</li>
                <ul>
                    <li>暗黙の前提を明らかにする</li>
                    <li>経験値を共有する</li>
                    <li>基本的人権を侵害しない</li>
                </ul>
                <li>テンプレートに沿って投稿を行う場合、<NavLink to="/post">投稿フォーム</NavLink>を利用してください</li>
                <li>テンプレートに沿わず投稿を行う場合、<NavLink to="freeStylePost">自由投稿フォーム</NavLink>を利用して下さい</li>
            </ul>
            <H3>コメントの投稿について</H3>
            <ul>
                <li>コメント投稿時のガイドラインは、投稿時のガイドラインに準ずるものとします</li>
            </ul>
            <H3>記事の編集について</H3>
            <ul>
                <li>記事を編集するためには<NavLink to="/signup">ユーザー登録</NavLink>および<NavLink to="/login">ログイン</NavLink>が必要です</li>
                <li>編集内容に議論がある場合、コメントで議論を行ってから編集をしてください</li>
                <li>自分の主張を裏付けるための編集、荒らし、白紙化を行った場合はガイドライン違反とみなし、ユーザーが無効化されることがあります。</li>
            </ul>
        <H2>Discordコミュニティについて</H2>
        <ul>
            <li><a href="https://t.co/SOg8HEB1Ga">Discordの招待リンク</a>から入ることが可能です。判断に迷った場合や、議論したいことがある場合などに使ってください。</li>
            <li>このサーバーでは、おすすめの記事を紹介しあったり、どのように行動するべきか議論が行われたりしています。</li>
        </ul>
        <H2>開発について</H2>
        <ul>
            <li>健常者エミュレータ事例集のコードは、GPL-3.0ライセンスの元公開されています。誰もが開発に参加することが可能です。</li>
            <li>詳細は<a href="https://github.com/sora32127/healthy-person-emulator-dotorg">GitHub</a>をご覧ください</li>
        </ul>
        <H2>よくある質問</H2>
        <ul>
            <li>Q : ライフハックを投稿してもかまいませんか？</li>
            <li>A : 大丈夫です。ライフハックにより確保される「健康」は、健常者として生活するために必要な要素です</li>
        </ul>
        <br></br>
        <ul>
            <li>Q:投稿しても大丈夫かどうか不安です</li>
            <li>A : まずは投稿してみてください。あとから編集することが可能です。詳しくは当ガイドラインをご覧ください。</li>
        </ul>
        <br></br>
        <ul>
            <li>Q: ウケ狙いで書いている奴がいてキモいんですが...</li>
            <li>A: 集合知の構築という目的の前では、動機の違いなど電子顕微鏡で覗かないと気づかないようなミジンコ未満の些細な違いでしかありません。我々は書かれたものそれ自体のみを考慮するべきです。ウケ狙いで書かれた名文もあるし、正義のために書かれた駄文もあるのです。評価は歴史が行ってくれるでしょう。ウケ狙いでも気にせず投稿してください。それはそれとしてガイドラインに違反したものは管理人の方で削除します。</li>
        </ul>
        <br></br>
        <ul>
            <li>Q: 言論の自由を否定する自由はありますか？</li>
            <li>A: ありません。言論の自由を否定するような投稿は管理人により削除されます。</li>
        </ul>
        <br></br>
        <ul>
            <li>Q:人間から「健常性」を一つずつはぎ取っていくと何が残りますか？</li>
            <li>A: 悪</li>
        </ul>
        <br></br>
        <ul>
            <li>Q: 投稿したページのタイトルを変えたいです。</li>
            <li>A: 編集することが可能です。詳しくは当ガイドラインをご覧ください。</li>
        </ul>
        <br></br>
        <ul>
            <li>Q: 投稿したページを削除したいです。</li>
            <li>A: 管理人のTwitterのDMにご一報ください。</li>
        </ul>
        <br></br>
        <ul>
            <li>Q: 経験をうまく整理できず、記事にできません。どうすればいいですか？</li>
            <li>A: 一案ですが、コミュニティで相談してみてはいかがでしょうか。詳しくは当ガイドラインをご覧ください。</li>
        </ul>
        </div>
    )
}

export const meta: MetaFunction = () => {
    const title = "サイト説明";
    const description = "サイトの趣旨の説明";
    const ogLocale = "ja_JP";
    const ogSiteName = "健常者エミュレータ事例集";
    const ogType = "article";
    const ogTitle = title;
    const ogDescription = description;
    const ogUrl = `https://healthy-person-emulator.org/readme`;
    const twitterCard = "summary"
    const twitterSite = "@helthypersonemu"
    const twitterTitle = title
    const twitterDescription = description
    const twitterCreator = "@helthypersonemu"
    const twitterImage = "https://qc5axegmnv2rtzzi.public.blob.vercel-storage.com/favicon-CvNSnEUuNa4esEDkKMIefPO7B1pnip.png"
  
    return [
      { title },
      { description },
      { property: "og:title", content: ogTitle },
      { property: "og:description", content: ogDescription },
      { property: "og:locale", content: ogLocale },
      { property: "og:site_name", content: ogSiteName },
      { property: "og:type", content: ogType },
      { property: "og:url", content: ogUrl },
      { name: "twitter:card", content: twitterCard },
      { name: "twitter:site", content: twitterSite },
      { name: "twitter:title", content: twitterTitle },
      { name: "twitter:description", content: twitterDescription },
      { name: "twitter:creator", content: twitterCreator },
      { name: "twitter:image", content: twitterImage },
    ];
  };
  