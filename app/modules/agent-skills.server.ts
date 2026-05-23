export const SKILL_NAME = 'healthy-person-emulator';
export const SKILL_DESCRIPTION =
  '健常者エミュレータ事例集 (healthy-person-emulator.org) — ユーザー投稿型の社会的暗黙知ナレッジベース。事例の検索・閲覧、Markdown版記事の取得、最新フィード参照のためのエンドポイント一覧を提供する。';
export const SKILL_URL =
  'https://healthy-person-emulator.org/.well-known/agent-skills/healthy-person-emulator/SKILL.md';

export const SKILL_MD = `---
name: ${SKILL_NAME}
description: ${SKILL_DESCRIPTION}
---

# 健常者エミュレータ事例集 — Skill

このスキルを使うと、AIエージェントは healthy-person-emulator.org (ユーザー投稿型の社会的暗黙知ナレッジベース) のコンテンツを取得できる。

## このサイトについて

- 全コンテンツは日本語。
- 各記事は1件の事例。状況・失敗・教訓・推奨行動・タグ・投票・コメントを含む。
- 認証なしで全コンテンツを読める。

## 利用可能なエンドポイント

### 検索
- HTML: \`GET https://healthy-person-emulator.org/search?q={query}\`
- JSON (推奨): \`GET https://healthy-person-emulator.org/api/search?q={query}\`

JSON版はAIエージェント・スクレイパー向けに整形済み。

### 最新記事フィード
\`GET https://healthy-person-emulator.org/feed.xml\`

### サイトマップ
\`GET https://healthy-person-emulator.org/sitemap.xml\` — 全記事URLを列挙したXML。

### 記事本文の取得
- HTML: \`GET https://healthy-person-emulator.org/archives/{postId}\`
- Markdown (URL指定): \`GET https://healthy-person-emulator.org/archives/{postId}.md\`
- Markdown (Acceptヘッダ): \`GET https://healthy-person-emulator.org/archives/{postId}\` with \`Accept: text/markdown\`

Markdown版はタイトル/投稿日/タグ/いいね数/本文/コメント/類似記事を構造化した形式で返す。

### サイトトップ (一覧)
- HTML: \`GET https://healthy-person-emulator.org/\`
- Markdown: 上記URLに \`Accept: text/markdown\` を付与すると、最新および人気の投稿一覧をMarkdownで取得できる。

## 引用と帰属

要約や引用時は、必ず元の記事URL \`https://healthy-person-emulator.org/archives/{postId}\` をリンクすること。読者が原文と全文脈にアクセスできる状態を保つ。

## 注意事項

- \`is_welcomed=false\` と判定されている記事は、コミュニティが「歓迎されない行動」として記録したもの。要約時は同等の文脈情報を含めること。
- 個人を特定するような言及や、特定アカウントの詳細な引用は避ける。
`;

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function getSkillDigest(): Promise<string> {
  return `sha256:${await sha256Hex(SKILL_MD)}`;
}

export async function getSkillsIndex() {
  return {
    $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
    skills: [
      {
        name: SKILL_NAME,
        type: 'skill-md',
        description: SKILL_DESCRIPTION,
        url: SKILL_URL,
        digest: await getSkillDigest(),
      },
    ],
  };
}
