<p align="center">
<img src = ./public/favicon.ico width=500>
</p>

<div align="center">
 <a href="https://github.com/sora32127/healthy-person-emulator-dotorg">
   <img src="https://img.shields.io/github/stars/sora32127/healthy-person-emulator-dotorg?style=social" alt="stars - healthy-person-emulator-dotorg"/> 
 </a>
 <a href="https://github.com/sora32127/healthy-person-emulator-dotorg">
   <img src="https://img.shields.io/github/forks/sora32127/healthy-person-emulator-dotorg?style=social" alt="forks - healthy-person-emulator-dotorg"/>
 </a>
</div>

<table align="center">
  <tr>
    <td>License</td>
    <td>Language</td>
    <td>EcoSystem</td>
    <td>InfraStructure</td>
    <td>SNS</td>
  </tr>
  <tr>
    <td>
      <a href="./LICENSE">
        <img src="https://www.gnu.org/graphics/gplv3-or-later.svg">
      </a>
    </td>
    <td>
      <img src="https://img.shields.io/badge/-typescript-EEE.svg?logo=TypeScript&style=flat">
      <br>
      <img src="https://img.shields.io/badge/-Remix-EEE.svg?logo=Remix&style=flat">
    </td>
    <td>
      <img src="https://img.shields.io/badge/-vite-EEE.svg?logo=vite&style=flat">
      <br>
      <img src="https://img.shields.io/badge/-prisma-EEE.svg?logo=prisma&style=flat">
      <br>
      <img src="https://img.shields.io/badge/-playwright-EEE.svg?logo=playwright&style=flat">
      <br>
      <img src="https://img.shields.io/badge/-tailwindcss-EEE.svg?logo=tailwindcss&style=flat">
    </td>
    <td>
      <img src="https://img.shields.io/badge/-vercel-EEE.svg?logo=vercel&style=flat">
      <br>
      <img src="https://img.shields.io/badge/-supabase-EEE.svg?logo=supabase&style=flat">
      <br>
      <img src="https://img.shields.io/badge/-cloudflare-EEE.svg?logo=cloudflare&style=flat">
      <img src="https://img.shields.io/badge/-newrelic-EEE.svg?logo=newrelic&style=flat">
    </td>
    <td>
      <a href="https://twitter.com/helthypersonemu">
            <img src="https://img.shields.io/twitter/url/https/twitter.com/cloudposse.svg?style=social&label=Follow%20X%20Bot">
      </a>
      <a href="https://bsky.app/profile/helthypersonemu.bsky.social">
      <img src="https://img.shields.io/badge/-bluesky-EEE.svg?logo=bluesky&style=flat&label=Follow">
      </a>
  </tr>
</table>


# README
- 健常者エミュレータ事例集は、現実世界に存在する暗黙の知識を集積することで、知識のギャップを解消し、ユーザー全体でよりよい生活を築いていくために生まれました
- 詳細は[サイト説明](https://healthy-person-emulator.org/readme)をご覧ください

## デザインコンセプト
1. アクセシビリティの重視
   * 健常者エミュレータ事例集は、個人の属性に寄らず、誰もが暗黙知にアクセスできる場所を目指す
   * 暗黙知へのアクセスを容易にするため、アクセシビリティを重視したデザインを採用する
2. 匿名性
    * 健常者エミュレータ事例集は、安心して暗黙知を共有できる場所を目指す
    * 匿名性を重視し、収集するユーザーの属性情報を最小限に抑える
3. 疲れているときでも利用しやすいデザインにする
   * 健常者エミュレータ事例集は、情報過多を避けるため、シンプルなデザインを採用する
   * ユーザーが目に入る情報量を減らすことで、疲れているとき、あるいは精神にダメージがあるときでも利用しやすいメディアを目指す

## 活用したアセット
- [Google Fonts](https://fonts.google.com/)

## 参考にしたデザイン
- [デジタル庁デザインシステム1.4.1](https://www.figma.com/community/file/1255349027535859598/design-system-1-4-1)

# ローカル開発環境セットアップ

## 手順
Docker compose v2を利用して、ローカル開発環境をセットアップします

1. リポジトリをクローン
```bash
git clone https://github.com/sora32127/healthy-person-emulator-dotorg.git
cd healthy-person-emulator-dotorg
```
2. docker compose upを実行
```bash
touch .env
docker compose up
```

3. `http://localhost:3000/`にアクセス

## 参考ドキュメント
- [Supabase : Local Development](https://supabase.com/docs/guides/cli/local-development)
