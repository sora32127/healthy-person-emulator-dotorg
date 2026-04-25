# ロゴのダークモード視認性改善 設計ドキュメント

## 背景

PR #348 でサイトのアイコン・ロゴを差し替えた結果、`public/logo-mark.svg` / `public/logo-type.svg` の `fill` が `#1B1718`（ほぼ黒）でハードコードされた状態になっている。一方、daisyUI のダークテーマは `--color-base-100: #0F0F0F` / `--color-base-200: #1A1A1A` という暗背景を使うため、ダークモードに切り替えるとロゴが背景に溶けて視認できない。

## ゴール

サイト内（PCサイドバー・モバイルヘッダー）に表示されるロゴが、ライト／ダーク両テーマでそれぞれ十分なコントラストで表示されること。テーマ切替時にちらつきが発生しないこと。

## 非ゴール（スコープ外）

- `public/favicon.svg` / `public/favicon.ico` / `public/apple-touch-icon.png`（ブラウザタブ・iOS ホーム画面のアイコン）の対応
- README で参照される `public/logo-type.svg` の見た目変更
- `app/components/icons/` 配下の既存アイコン（既に `fill="currentColor"` 採用済みのため対応不要）

## アプローチ

既存の `app/components/icons/PostIcon.tsx` 等が採用している **インライン React SVG コンポーネント + `fill="currentColor"`** パターンに揃える。`<img>` タグでは `currentColor` を継承できないため、`<img>` を React コンポーネントに置換する必要がある。

色は Tailwind の `text-base-content` クラスで指定する。daisyUI が `--color-base-100` から自動導出する補色のため、ライト時は濃色・ダーク時は淡色になり、両モードで自動的にコントラストが確保される。CSS 変数ベースなので、テーマ切替時にちらつきが発生せず、SSR 時点から正しい色で描画される。

## 詳細設計

### 新規コンポーネント

#### `app/components/icons/LogoMark.tsx`

```tsx
type Props = { className?: string };

export default function LogoMark({ className }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 300 200"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="..."
      />
    </svg>
  );
}
```

`d` 属性の値は `public/logo-mark.svg` の `<path>` の `d` をそのまま転記する。

#### `app/components/icons/LogoType.tsx`

`viewBox="0 0 1887 163"`、13 個の `<path>` 要素を持つ同構造のコンポーネント。各 path の `d` は `public/logo-type.svg` から転記する。

### API

両コンポーネントとも `className` のみを受け取る。`aria-hidden="true"` を固定で付与する（呼び出し元の `NavLink` に既に `aria-label="健常者エミュレータ事例集 トップへ"` があり、ロゴ自身を補助技術が読み上げる必要がないため）。

### 呼び出し側の変更（`app/routes/_layout.tsx`）

| 行 | 旧 | 新 |
|---|---|---|
| 46 | `<img src="/logo-mark.svg" alt="" className="h-8 w-auto group-hover:hidden 2xl:hidden" />` | `<LogoMark className="h-8 w-auto text-base-content group-hover:hidden 2xl:hidden" />` |
| 48-51 | `<img src="/logo-type.svg" alt="健常者エミュレータ事例集" className="h-4 w-auto hidden group-hover:block 2xl:block" />` | `<LogoType className="h-4 w-auto text-base-content hidden group-hover:block 2xl:block" />` |
| 121 | `<img src="/logo-type.svg" alt="健常者エミュレータ事例集" className="h-6 w-auto" />` | `<LogoType className="h-6 w-auto text-base-content" />` |

`alt` 属性に持たせていたサイト名は、いずれも親 `NavLink` の `aria-label` で重複していたため、SVG 側を `aria-hidden="true"` にしても情報損失はない。

### 残置するファイル

`public/logo-mark.svg` / `public/logo-type.svg` / `public/favicon.svg` は変更しない。GitHub の README は SVG を `<img>` 経由で表示するため `currentColor` が効かず、ファイル側を変えても意味がないため。

## 検証

- `pnpm start:local` でローカル起動
- PC ビュー（サイドバー折畳時／展開時）でテーマ切替し、両モードでロゴが視認できることを目視確認
- モバイルビュー（ヘッダー）で同様に確認
- `pnpm lint` がパスすること

## トレードオフ

- `logo-type.svg` のパスデータ（約 14KB）が JSX バンドルに乗る点。ただし当該レイアウトは全ページの最上位ルートで読み込まれるため、結局はキャッシュされる。HTTP リクエスト 2 件分（`logo-mark.svg` / `logo-type.svg`）を削減できるため、トータルでは中立〜微減。
- `public/logo-*.svg` と React コンポーネントで path data が二重管理になる。デザイン変更時は両方を更新する必要があるが、頻度は低く、変更コストは許容範囲。
