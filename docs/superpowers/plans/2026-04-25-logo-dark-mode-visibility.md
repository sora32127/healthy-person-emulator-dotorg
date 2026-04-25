# ロゴのダークモード視認性改善 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PCサイドバーとモバイルヘッダーに表示されるロゴを、ライト・ダーク両テーマでコントラストよく表示できるようにする。

**Architecture:** `<img src="/logo-*.svg">` を `fill="currentColor"` のインライン React SVG コンポーネントに置換し、Tailwind の `text-base-content` で daisyUI のテーマに自動追従させる。既存の `app/components/icons/` 配下のアイコンと同じパターンを踏襲する。

**Tech Stack:** React 19 / React Router 7 / Tailwind CSS 4 / daisyUI 5 / TypeScript

**Spec:** `docs/superpowers/specs/2026-04-25-logo-dark-mode-visibility-design.md`

---

## ファイル構成

| ファイル | 種類 | 役割 |
|---|---|---|
| `app/components/icons/LogoMark.tsx` | 新規 | シンボルマーク（折畳サイドバー用）。インライン SVG + currentColor |
| `app/components/icons/LogoType.tsx` | 新規 | ロゴタイプ（展開サイドバー・モバイルヘッダー用）。インライン SVG + currentColor |
| `app/routes/_layout.tsx` | 変更 | `<img>` 3箇所をコンポーネントに置換 |

`public/logo-mark.svg` / `public/logo-type.svg` / `public/favicon.svg` は **変更しない**（README とブラウザタブ用に黒のまま残す）。

既存規約に従い、プレゼンテーショナルなアイコンコンポーネントにはユニットテストを書かない（`app/components/icons/` 配下の既存コンポーネントもテストされていない）。検証は `pnpm lint` と手動のブラウザ確認で行う。

---

## Task 1: LogoMark コンポーネントを作成

**Files:**
- Create: `app/components/icons/LogoMark.tsx`

- [ ] **Step 1: 新規ファイルを作成**

`app/components/icons/LogoMark.tsx` を以下の内容で作成する。`d` 属性の値は `public/logo-mark.svg` の `<path>` の `d` をそのまま転記している。

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
        d="M118 100L207 7L212.414 12.4141L118 100H136L216 16L221.414 21.4141L136 100H154L225 25L230.414 30.4141L154 100H172L234 34L239.414 39.4141L172 100H190L243 43L248.414 48.4141L190 100H208L252 52L257.414 57.4141L208 100H226L261 61L266.414 66.4141L226 100H244L270 70L275.414 75.4141L244 100H262L279 79L284.414 84.4141L262 100H280L288 88L293.414 93.4141L280 100H300L200 200L150 150L100 200L0 100L100 0L150 50L200 0L203.414 3.41406L100.828 100H118ZM100 100V90L103.586 96.4141L107 93L100 90V72L112.586 87.4141L116 84L100 72V54L121.586 78.4141L125 75L100 54V36L130.586 69.4141L134 66L100 36V18L139.586 60.4141L143 57L100 18V2L4.82812 100H16L100 18L22.8281 100H34L100 36L40.8281 100H52L100 54L58.8281 100H70L100 72L76.8281 100H88L100 90L94.8281 100H100ZM100 180V191.656L143.828 143.828L141 141L100 180ZM100 162V173.656L134.828 134.828L132 132L100 162ZM100 144V155.656L125.828 125.828L123 123L100 144ZM100 126V137.656L116.828 116.828L114 114L100 126ZM100 108V119.656L107.828 107.828L105 105L100 108Z"
      />
    </svg>
  );
}
```

- [ ] **Step 2: lint 確認**

Run: `pnpm lint`
Expected: PASS（新規ファイル含めエラーなし）

- [ ] **Step 3: コミット**

```bash
git add app/components/icons/LogoMark.tsx
git commit -m "feat: ロゴマークのインライン SVG コンポーネントを追加

currentColor を使ってテーマカラーに追従させるため、
public/logo-mark.svg と等価な React コンポーネントを新設。"
```

---

## Task 2: LogoType コンポーネントを作成

**Files:**
- Create: `app/components/icons/LogoType.tsx`

`public/logo-type.svg` には 13 個の `<path>` 要素がある。これらをすべて React コンポーネントに転記する。各 `<path>` について以下の変換を行う：

- `fill-rule` → `fillRule`
- `clip-rule` → `clipRule`
- `fill="#1B1718"` 属性は **削除**（親 `<svg>` の `fill="currentColor"` を継承させる）
- `d` 属性の値は無編集でそのまま転記

- [ ] **Step 1: 新規ファイルを作成**

`app/components/icons/LogoType.tsx` の骨組みを以下の内容で作成する。

```tsx
type Props = { className?: string };

export default function LogoType({ className }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1887 163"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      {/* path 要素を Step 2 で挿入 */}
    </svg>
  );
}
```

- [ ] **Step 2: 13 個の path 要素を転記**

`public/logo-type.svg` を開き、ファイル内の 13 個の `<path>` 要素を順番にそのまま `<svg>` の中身として貼り付ける。貼り付け後、各 `<path>` について次の置換を行う：

1. ` fill="#1B1718"` を削除
2. `fill-rule="evenodd"` を `fillRule="evenodd"` に変更（該当する path のみ。最後の path に存在）
3. `clip-rule="evenodd"` を `clipRule="evenodd"` に変更（同上）

転記後、コメント行 `{/* path 要素を Step 2 で挿入 */}` は削除する。

完成イメージ（最初と最後の path を抜粋）：

```tsx
return (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 1887 163"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M1816.07 146V116.302C1811.58 119.944 ... " />
    <path d="M1648.94 144.319C1648.57 143.759 ... " />
    {/* ...（中略：他 9 個の path）... */}
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M95.875 81.25L168.188 5.6875L172.586 10.0864L95.875 81.25H110.5L175.5 13L179.899 17.3989L110.5 81.25H125.125L182.812 20.3125L187.211 24.7114L125.125 81.25H139.75L190.125 27.625L194.524 32.0239L139.75 81.25H154.375L197.438 34.9375L201.836 39.3364L154.375 81.25H169L204.75 42.25L209.149 46.6489L169 81.25H183.625L212.062 49.5625L216.461 53.9614L183.625 81.25H198.25L219.375 56.875L223.774 61.2739L198.25 81.25H212.875L226.688 64.1875L231.086 68.5864L212.875 81.25H227.5L234 71.5L238.399 75.8989L227.5 81.25H243.75L162.5 162.5L121.875 121.875L81.25 162.5L0 81.25L81.25 0L121.875 40.625L162.5 0L165.274 2.77393L81.9229 81.25H95.875ZM81.25 81.25V73.125L84.1636 78.3364L86.9375 75.5625L81.25 73.125V58.5L91.4761 71.0239L94.25 68.25L81.25 58.5V43.875L98.7886 63.7114L101.562 60.9375L81.25 43.875V29.25L106.101 56.3989L108.875 53.625L81.25 29.25V14.625L113.414 49.0864L116.188 46.3125L81.25 14.625V1.625L3.92285 81.25H13L81.25 14.625L18.5479 81.25H27.625L81.25 29.25L33.1729 81.25H42.25L81.25 43.875L47.7979 81.25H56.875L81.25 58.5L62.4229 81.25H71.5L81.25 73.125L77.0479 81.25H81.25ZM81.25 146.25V155.721L116.86 116.86L114.562 114.562L81.25 146.25ZM81.25 131.625V141.096L109.548 109.548L107.25 107.25L81.25 131.625ZM81.25 117V126.471L102.235 102.235L99.9375 99.9375L81.25 117ZM81.25 102.375V111.846L94.9229 94.9229L92.625 92.625L81.25 102.375ZM81.25 87.75V97.2207L87.6104 87.6104L85.3125 85.3125L81.25 87.75Z"
    />
  </svg>
);
```

- [ ] **Step 3: lint 確認**

Run: `pnpm lint`
Expected: PASS（XML 属性の置換が正しく済んでいれば JSX 構文エラーなし）

- [ ] **Step 4: コミット**

```bash
git add app/components/icons/LogoType.tsx
git commit -m "feat: ロゴタイプのインライン SVG コンポーネントを追加

currentColor を使ってテーマカラーに追従させるため、
public/logo-type.svg と等価な React コンポーネントを新設。"
```

---

## Task 3: `_layout.tsx` の `<img>` 3箇所をコンポーネントに置換

**Files:**
- Modify: `app/routes/_layout.tsx`

- [ ] **Step 1: import 文を追加**

`app/routes/_layout.tsx` の冒頭、既存の icons import 群（3-6行目あたり）の直後に以下を追加する。

```tsx
import LogoMark from '~/components/icons/LogoMark';
import LogoType from '~/components/icons/LogoType';
```

- [ ] **Step 2: PCサイドバー（折畳時）のロゴマークを置換**

`app/routes/_layout.tsx` の以下の行を：

```tsx
<img src="/logo-mark.svg" alt="" className="h-8 w-auto group-hover:hidden 2xl:hidden" />
```

次のように置換する：

```tsx
<LogoMark className="h-8 w-auto text-base-content group-hover:hidden 2xl:hidden" />
```

- [ ] **Step 3: PCサイドバー（展開時）のロゴタイプを置換**

`app/routes/_layout.tsx` の以下の3行を：

```tsx
<img
  src="/logo-type.svg"
  alt="健常者エミュレータ事例集"
  className="h-4 w-auto hidden group-hover:block 2xl:block"
/>
```

次の1行に置換する：

```tsx
<LogoType className="h-4 w-auto text-base-content hidden group-hover:block 2xl:block" />
```

- [ ] **Step 4: モバイルヘッダーのロゴタイプを置換**

`app/routes/_layout.tsx` の以下の行を：

```tsx
<img src="/logo-type.svg" alt="健常者エミュレータ事例集" className="h-6 w-auto" />
```

次のように置換する：

```tsx
<LogoType className="h-6 w-auto text-base-content" />
```

- [ ] **Step 5: 残存する `/logo-mark.svg` / `/logo-type.svg` 参照がないことを確認**

Run: `grep -n "logo-mark\|logo-type" app/routes/_layout.tsx`
Expected: 出力なし（grep の終了コードは 1 でよい）

- [ ] **Step 6: lint 確認**

Run: `pnpm lint`
Expected: PASS

- [ ] **Step 7: コミット**

```bash
git add app/routes/_layout.tsx
git commit -m "refactor: レイアウトのロゴ <img> をインラインSVGコンポーネントに置換

ダークモードでロゴが視認できない問題を解消するため、
text-base-content + currentColor でテーマに自動追従させる。"
```

---

## Task 4: 動作検証

**Files:** なし（検証のみ）

- [ ] **Step 1: ローカル開発サーバー起動**

Run: `pnpm start:local`
ブラウザで `http://localhost:8787`（または出力されたURL）を開く。

- [ ] **Step 2: ライトモードでロゴ視認性を確認**

PC ビューポート（幅 1280px 以上）で：
- サイドバーが折り畳まれた状態（マウスホバーなし）でロゴマークが暗色で表示されることを確認
- マウスをサイドバーに乗せて展開し、ロゴタイプが暗色で表示されることを確認

モバイルビューポート（幅 768px 未満）で：
- ヘッダー左上にロゴタイプが暗色で表示されることを確認

- [ ] **Step 3: ダークモードでロゴ視認性を確認**

`ThemeSwitcher`（PCはサイドバー下部、モバイルはドロワー内）でダークテーマに切替え、Step 2 と同じ場所でロゴが淡色で十分なコントラストで表示されることを確認。テーマ切替時にちらつきが発生しないことも確認する。

- [ ] **Step 4: テスト実行**

Run: `pnpm test`
Expected: 既存テストすべて PASS（このPRでは新規テスト追加なし）

- [ ] **Step 5: フォーマット適用とコミット（必要時のみ）**

Run: `pnpm format`
変更が出た場合のみ：

```bash
git add -A
git commit -m "style: prettierによる自動整形を反映"
```

---

## 完了条件

- ライト／ダーク両モードで PC サイドバー（折畳・展開）とモバイルヘッダーのロゴが視認できる
- `pnpm lint` / `pnpm test` がパスする
- `app/routes/_layout.tsx` から `/logo-mark.svg` / `/logo-type.svg` への参照が消えている
- `public/logo-mark.svg` / `public/logo-type.svg` / `public/favicon.svg` は変更されていない
