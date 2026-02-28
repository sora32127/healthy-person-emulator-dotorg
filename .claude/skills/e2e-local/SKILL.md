---
name: e2e-local
description: ローカル開発サーバー（localhost:3000）に対して E2E テストを実行するスキル。`/e2e-local` と入力したとき、またはローカルの E2E テスト・動作確認を依頼されたときに必ずこのスキルを使うこと。
---

# e2e-local — ローカル E2E テスト

webapp-testing スキルを使って、ローカルの開発サーバーに対して E2E テストを実行する。

Playwright を使う際は **必ず headed モード**（`headless=False`）で起動すること。

- Python: `/usr/local/bin/python3`
- Playwright: インストール済み（`python3 -m playwright`）

```python
browser = p.chromium.launch(headless=False, slow_mo=200)
```

## 実行環境

- サーバー起動コマンド: `pnpm dev`
- URL: http://localhost:3000

テストを開始する前に、以下のセットアップが完了していることを確認すること。

---

## セットアップ（初回 / DB が空のとき）

### 1. Docker を起動する

Supabase local は Docker に依存している。Docker Desktop が起動していない場合は先に起動すること。

### 2. Supabase local を起動する

```bash
npx supabase start
```

ポート 54322 で PostgreSQL が起動する。

### 3. DB スキーマを適用する

```bash
pnpm reset:db
```

### 4. テストデータを投入する

`scripts/seed.sql` を Docker 経由でローカル DB に流す。

```bash
docker exec -i supabase_db_healthy-person-emulator-dotorg \
  psql -U postgres -d postgres \
  < .claude/skills/e2e-local/scripts/seed.sql
```

> **注意**: seed.sql は冪等ではない。再実行する場合は先に `pnpm reset:db` でリセットすること。

### 5. 開発サーバーを起動する

```bash
pnpm dev
```

`http://localhost:3000` が 200 を返すことを確認してからテストを開始する。

---

## テスト実行

シナリオの詳細は `reference/scenarios.md` を参照。
スクリプト本体は `scripts/e2e_test.py`。

```bash
/usr/local/bin/python3 .claude/skills/e2e-local/scripts/e2e_test.py
```

スクリーンショットの保存先を変えたい場合は環境変数で指定する。

```bash
E2E_OUTPUT_DIR=/path/to/outputs /usr/local/bin/python3 .claude/skills/e2e-local/scripts/e2e_test.py
```

---

## アーキテクチャ上の注意点（クイックリファレンス）

| 要素 | セレクター / 補足 |
|------|-----------------|
| トップページ各セクション | `.latest-posts` / `.voted-posts` / `.recent-comments` / `.community-posts` / `.famed-posts` |
| ランダムタブ | `/?tab=random`（`/random` はリダイレクト）、タイトルは「トップページ」 |
| フィードタブ切替 | `.feed-type-select select` に `select_option()` |
| 投稿フォーム 5W1H | `#who` / `#what` / `#when` / `#where` / `#why` / `#how` / `#then` |
| プレビューモーダル | `dialog.modal-open` |
| トースト通知 | `[role='status']` |
| 検索UI就緒 | `.search-input-form` が表示されるまで最大 30 秒待機 |
| `/search` ローカル | GCS 未設定 → 500 エラー → SKIP |
| `/post` 待機 | `domcontentloaded` + `form` セレクター待機（`networkidle` はタイムアウトする） |

---

## レポート形式

テスト完了後、各シナリオの合否（PASS / FAIL / SKIP）を表形式でまとめること。
FAIL の場合はエラー内容またはスクリーンショットを添付すること。
