import { MetaFunction } from "@remix-run/node";
import { H1, H2 } from "~/components/Headings";

export default function PrivacyPolicy(){
    return (
        <div className="templateSubmitForm">
        <H1>プライバシーポリシー・免責事項</H1>
        <H2>個人情報の利用目的</H2>
        <ul>
            <li>健常者エミュレータ事例集(以下当サイト)では、アカウント登録の際にメールアドレスの入力を求めています。</li>
            <li>メールアドレスはアカウントの識別、およびパスワード復旧のためのみに利用され、それ以外の目的で利用されることはありません。</li>
        </ul>
        <H2>個人情報の第三者への開示</H2>
        <ul>
            <li>当サイトでは、個人情報は適切に管理し、以下に該当する場合を除いて第三者に開示することはありません</li>
            <li>本人の同意がある場合</li>
            <li>法令に基づく場合</li>
            <li>ご本人からの個人データの開示、訂正、追加、削除、利用停止のご希望の場合には、ご本人であることを確認させていただいた上、速やかに対応させていただきます。</li>
        </ul>
        <H2>アクセス解析ツールについて</H2>
        <ul>
            <li>当サイトでは、Googleによるアクセス解析ツール「Googleアナリティクス」を利用しています。</li>
            <li>このGoogleアナリティクスはトラフィックデータの収集のためにCookieを使用しています。このトラフィックデータは匿名で収集されており、個人を特定するものではありません。この機能はCookieを無効にすることで収集を拒否することが出来ますので、お使いのブラウザの設定をご確認ください。</li>
        </ul>
        <H2>Cookieの利用について</H2>
        <ul>
            <li>当サイトでは、以下の用途でCookieを利用しています</li>
            <li>アクセス解析ツールの利用(匿名)</li>
            <li>ユーザー認証</li>
        </ul>
        <H2>免責事項</H2>
        <ul>
            <li>当サイトからリンクやバナーなどによって他のサイトに移動された場合、移動先サイトで提供される情報、サービス等について一切の責任を負いません。</li>
            <li>当サイトのコンテンツ・情報につきまして、ユーザー投稿型メディアという特性上、誤情報が入り込んだり、情報が古くなっていることもございます。</li>
            <li>当サイトに掲載された内容によって生じた損害等の一切の責任を負いかねますのでご了承ください。</li>
        </ul>
        <H2>著作権について</H2>
        <ul>
            <li>当サイトの著作権は、すべてサイト管理者に帰属します</li>
        </ul>
        <H2>リンクについて</H2>
        <ul>
            <li>当サイトは基本的にリンクフリーです。リンクを行う場合の許可や連絡は不要です。</li>
        </ul>
        </div>
    );
}


export const meta: MetaFunction = () => {
    const title = "プライバシーポリシー";
    const description = "プライバシーポリシーについて";
    const ogLocale = "ja_JP";
    const ogSiteName = "健常者エミュレータ事例集";
    const ogType = "article";
    const ogTitle = title;
    const ogDescription = description;
    const ogUrl = `https://healthy-person-emulator.org/privacyPolicy`;
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
  