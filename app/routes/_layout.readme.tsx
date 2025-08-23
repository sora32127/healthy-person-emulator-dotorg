import type { MetaFunction } from "@remix-run/node";
import { NavLink } from "@remix-run/react";
import ReactMarkdown from 'react-markdown';
import { H1, H2, H3 } from "~/components/Headings";
import { commonMetaFunction } from "~/utils/commonMetafunction";

// FAQデータの型定義
interface FAQItem {
    question: string;
    answer: string;
}

// FAQデータを配列として管理
const faqData: FAQItem[] = [
    {
        question: "ライフハックを投稿してもかまいませんか？",
        answer: "大丈夫です。ライフハックにより確保される「健康」は、健常者として生活するために必要な要素です"
    },
    {
        question: "投稿しても大丈夫かどうか不安です",
        answer: "まずは投稿してみてください。あとから編集することが可能です。詳しくは当ガイドラインをご覧ください。"
    },
    {
        question: "ウケ狙いで書いている奴がいてキモいんですが...",
        answer: "集合知の構築という目的の前では、動機の違いなど電子顕微鏡で覗かないと気づかないようなミジンコ未満の些細な違いでしかありません。我々は書かれたものそれ自体のみを考慮するべきです。ウケ狙いで書かれた名文もあるし、正義のために書かれた駄文もあるのです。評価は歴史が行ってくれるでしょう。ウケ狙いでも気にせず投稿してください。それはそれとしてガイドラインに違反したものは管理人の方で削除します。"
    },
    {
        question: "言論の自由を否定する自由はありますか？",
        answer: "ありません。言論の自由を否定するような投稿は管理人により削除されます。"
    },
    {
        question: "人間から「健常性」を一つずつはぎ取っていくと何が残りますか？",
        answer: "**悪**"
    },
    {
        question: "投稿したページのタイトルを変えたいです。",
        answer: "編集することが可能です。ユーザー登録を実施し、編集を行ってください。詳しくは当ガイドラインをご覧ください。"
    },
    {
        question: "投稿したページを削除したいです。",
        answer: "管理人のTwitterのDMにご一報ください。"
    },
    {
        question: "経験をうまく整理できず、記事にできません。どうすればいいですか？",
        answer: "一案ですが、コミュニティで相談してみてはいかがでしょうか。詳しくは当ガイドラインをご覧ください。または、投稿フォームから「知識募集」のフォーマットで投稿してみるといいかもしれません。"
    },
    {
        question: "荒らしに対してどのような対策を行っていますか？",
        answer: `2024年12月31日現在、複数種類の対策を組み合わせて荒らし対策を実施しています。

- IPアドレスブロック：故意にガイドラインを違反する企図のある投稿が繰り返し行われた場合、投稿者のIPアドレスをブロックし、サイトへのアクセスを遮断します。
- AIによるガイドライン違反の自動検知：投稿内容をAIにより自動的に分析し、ガイドライン違反と判断された場合、SNSへの自動投稿が停止されます。
- 投稿フォームに対するストップワード機能：特定の単語が含まれている場合、投稿することができないようになっています。
- リクエスト検証の実施：リクエストの正当性を確認するための検証を実施し、プログラマティックなPOSTリクエストを遮断します。`
    },
    {
        question: "サイトの表示が崩れているのを発見しました。どこに連絡すればよいでしょうか？",
        answer: "発見ありがとうございます！[Discord](https://t.co/SOg8HEB1Ga)（当ガイドラインに招待リンクがあります）の「#エンジニアリング議論」チャンネルで連絡をいただくか、[GitHub](https://github.com/sora32127/healthy-person-emulator-dotorg)上で直接Issueを立てていただけると助かります。"
    }
];

// FAQアイテムコンポーネント
function FAQItem({ faq, isLast }: { faq: FAQItem; isLast: boolean }) {
    return (
        <div>
            <ul>
                <li>
                    <ReactMarkdown>{`Q: ${faq.question}`}</ReactMarkdown>
                </li>
                <li>
                    <ReactMarkdown>{`A: ${faq.answer}`}</ReactMarkdown>
                </li>
            </ul>
            {!isLast && (
                <hr className="my-6 border-gray-300" />
            )}
        </div>
    );
}

// FAQセクションコンポーネント
function FAQSection() {
    return (
        <div>
            <H2>よくある質問</H2>
            {faqData.map((faq, index) => (
                <FAQItem 
                    key={index} 
                    faq={faq} 
                    isLast={index === faqData.length - 1} 
                />
            ))}
        </div>
    );
}

export default function Component() {
    return (
        <div className="postContent">
            <H1>サイト説明</H1>
            <H2>健常者エミュレータ事例集とは</H2>
            <ul>
                <li>このサイトは、現実世界に存在する暗黙の知識を集積することで、知識のギャップを解消し、ユーザー全体でよりよい生活を築いていくために生まれました</li>
                <li>暗黙の知識を言語化して集積し、健常者エミュレータを動作させ、現実世界を生きる糧とするのが目的です</li>
                <li>健常者エミュレータが何なのかは<a href="https://contradiction29.hatenablog.com/entry/2021/06/30/210154">管理人が書いた文章</a>を参照してください</li>
                <li>問い合わせは管理人<a href="https://www.twitter.com/messages/compose?recipient_id=1249916069344473088">@contradiction29のXのDM</a>までお願いします</li>
            </ul>
            <H2>ユーザーガイドライン</H2>
            <p>健常者エミュレータ事例集に対して、記事やコメントの投稿、記事の編集を行うユーザーに対しては、以下のガイドラインに則って行動することが求められます。</p>
            <H3>新規記事の投稿について</H3>
            <ul>
                <li>誰もが新規ページを作成することが可能です。我々は集合体として、健常者エミュレータを完成させるための個別事例を強く欲しています。ぜひあなたの経験を投稿してください。</li>
                <li>以下の要素を含む投稿を行ってはいけません。
                   <ul>
                       <li>基本的人権の否定や、誹謗中傷、暴言、プライバシー違反を含む投稿</li>
                       <li>経験知の集積そのものを否定する行為</li>
                       <li>荒らし行為に該当する投稿</li>
                       <li>経験談ではない記事を投稿すること。自分の経験であるか他人の経験であるかは問わない</li>
                       <li>幼児的かつ性的な表現</li>
                   </ul>
               </li>
                <li>健常者エミュレータ事例集の理念にそぐわないと判断される場合、管理人の裁量に基づき、ページが削除されることがあります。</li>
                <li>悪質な投稿を行った場合、管理人の裁量に基づき、アクセスを遮断することがあります。</li>
                <li>ページ作成時は、以下の方針にのっとり記事を作成することを推奨します。
                <ul>
                    <li>暗黙の前提を明らかにする</li>
                    <li>経験値を共有する</li>
                    <li>基本的人権を侵害しない</li>
                </ul>
                </li>
                <li>テンプレートに沿って投稿を行う場合、<NavLink to="/post">投稿フォーム</NavLink>を利用してください</li>
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
        <H2>SNS連携について</H2>
        <ul>
            <li>健常者エミュレータ事例集に投稿された記事は、以下の経路でSNSにも自動投稿されます
            <ul>
                <li><a href="https://twitter.com/helthypersonemu">Twitter/X</a></li>
                <li><a href="https://bsky.app/profile/helthypersonemu.bsky.social">Bluesky</a></li>
                <li><a href="https://misskey.io/@helthypersonemu">Misskey.io(ActivityPub対応版)</a></li>
            </ul>
            </li>
            <li>SNSに投稿される際は、5W1H+Then状況説明の箇所が画像として表示されます</li>
            <li>10分に一回の頻度で更新されます</li>
        </ul>


        <H2>開発について</H2>
        <ul>
            <li>健常者エミュレータ事例集のコードは、GPL-3.0ライセンスの元公開されています。誰もが開発に参加することが可能です。</li>
            <li>詳細は<a href="https://github.com/sora32127/healthy-person-emulator-dotorg">GitHub</a>をご覧ください</li>
        </ul>
        
        <FAQSection />
        </div>
    )
}

export const meta: MetaFunction = () => {
    const commonMeta = commonMetaFunction({
        title : "サイト説明",
        description : "サイトの趣旨の説明",
        url: "https://healthy-person-emulator.org/readme",
        image: null
    }); 
    return commonMeta;
  };
  