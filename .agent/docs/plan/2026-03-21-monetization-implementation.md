# 収益化 実装計画

**Spec:** `.agent/docs/plan/2026-03-21-monetization-design.md`

---

## 全体の実装順序

```
フェーズ1: フリーミアムAPI + CLI
  1-A. APIキー基盤（スキーマ・発行・認証）
  1-B. 公開APIエンドポイント
  1-C. CLIパッケージ
         ↓
フェーズ2: プレミアムサブスク（レートリミット緩和）
  2-A. Stripe課金基盤 ← 全フェーズで共有。早めに作る
  2-B. プレミアム状態管理 + レートリミット切り替え
  2-C. 特商法表記・利用規約
         ↓
フェーズ3: プレミアムバッジ
  3-A. バッジ表示（Web）
         ↓
フェーズ4: コンテンツライセンス販売
  4-A. テーマ別記事ページ
  4-B. ライセンス購入フロー（Stripe Checkout再利用）
  4-C. ライセンス証書PDF + メール送信
  4-D. 記事制作
```

---

## フェーズ1: フリーミアムAPI + CLI

課金なし。利用者獲得フェーズ。

### 1-A. APIキー基盤

- D1に `dim_api_keys` テーブルを追加（userId, apiKey, isPremium, createdAt）
- Webの設定ページ（`/settings/api`）からAPIキーを発行・再生成できるようにする
- API認証ミドルウェア: `Authorization: Bearer <key>` でリクエストを検証

### 1-B. 公開APIエンドポイント

既存のリポジトリ層（`d1.server.ts` の `searchPosts`, `getFeedPosts`, `getTagsCounts` 等）をそのまま使い、JSONレスポンスを返すルートを追加するだけ。

- `GET /api/v1/posts` — `getFeedPosts` をラップ
- `GET /api/v1/posts/:postId` — `getPostByPostId` をラップ
- `GET /api/v1/search` — `searchPosts` をラップ
- `GET /api/v1/tags` — `getTagsCounts` をラップ
- `GET /api/v1/tags/:tagName/posts` — `searchPosts`（タグ指定）をラップ

### 1-C. CLIパッケージ

`packages/cli` にnpmパッケージを作成。APIのラッパー。出力はJSON。

---

## フェーズ2: プレミアムサブスク（レートリミット緩和）

### 2-A. Stripe課金基盤

**フェーズ4のライセンス販売でもStripeを再利用するので、ここでしっかり作る。**

- Stripe Subscriptions（月額定期課金）
- Stripe Customer Portal（解約セルフサーブ）
- Webhook受信エンドポイント（署名検証、冪等性制御）
- シークレットはCloudflare Secrets Storeに保管（既存パターンに合わせる）

### 2-B. プレミアム状態管理 + レートリミット切り替え

- D1にプレミアム状態テーブル（userId, stripeCustomerId, status, currentPeriodEnd）
- `dim_api_keys.isPremium` をStripeサブスク状態と連動
- レートリミット: 無料10req/min → プレミアム60req/min
- 429レスポンスにプレミアムへの導線を含める

### 2-C. 特商法表記・利用規約

- 特定商取引法に基づく表記ページを新設
- 利用規約にサブスクリプション・APIキーに関する条項を追加

---

## フェーズ3: プレミアムバッジ

### 3-A. バッジ表示（Web）

- フェーズ2のプレミアム状態テーブルを参照して判定
- 投稿・コメント表示コンポーネントにバッジを追加
- 開発量は小さい。フェーズ2のStripe基盤が完成していれば短時間で実装可能

---

## フェーズ4: コンテンツライセンス販売

### 4-A. テーマ別記事ページ

- 新規ルート（`/guides/:slug`）
- D1に記事テーブル（タイトル、本文Markdown、テーマ、公開日）
- SSRで全文公開（SEOクローラブル）

### 4-B. ライセンス購入フロー

- **フェーズ2で構築したStripe基盤を再利用。** Checkout Session（単品決済 + 月額サブスク）を追加
- D1にライセンステーブル

### 4-C. ライセンス証書PDF + メール送信

- pdf-lib でPDF生成（Workers内）
- Resend でメール送信

### 4-D. 記事制作

- 月1〜2本のペースで積み上げ
- BigQuery + D1のデータからいいね数の多い投稿をテーマ別に抽出 → 運営がキュレーション+解説を執筆

---

## 判断ポイント

| 判断 | 理由 |
|---|---|
| Stripe基盤はフェーズ2で作る（フェーズ1では不要） | フェーズ1は課金なし。ただしフェーズ2に入ったら最初にStripeを作ること。フェーズ4でも再利用するため |
| APIは `/api/v1/` にバージョニングする | 将来のAPI変更時の後方互換性のため |
| レートリミットはCloudflare Rate Limiting Rulesで実装 | アプリレベルのカウンターよりもインフラ層で制御した方がシンプル。APIキー単位の制限はフェーズ2で`isPremium`フラグと組み合わせてアプリ層で実装 |
| CLIは最小限で出す | 出力はJSON。human-readableにする必要はない。AIツールが加工する前提 |
| フェーズ3は軽量 | フェーズ2完了後なら数時間で実装可能。独立フェーズにしているのはリリースを分けるため |
