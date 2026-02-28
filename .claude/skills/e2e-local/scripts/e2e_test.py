from playwright.sync_api import sync_playwright
import time
import os

OUTPUT_DIR = os.environ.get("E2E_OUTPUT_DIR", "/tmp/e2e_outputs")
BASE_URL = "http://localhost:3000"
results = []

def check(name, passed, detail=""):
    status = "PASS" if passed else "FAIL"
    results.append((name, status, detail))
    print(f"[{status}] {name}" + (f" — {detail}" if detail else ""))

def skip(name, detail=""):
    results.append((name, "SKIP", detail))
    print(f"[SKIP] {name}" + (f" — {detail}" if detail else ""))

def toast_text(page):
    t = page.locator("[role='status']").first
    return t.inner_text() if t.count() > 0 else ""

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False, slow_mo=200)
    page = browser.new_page(viewport={"width": 1280, "height": 900})

    # ── シナリオ 1: トップページ ──────────────────────────────
    print("\n=== シナリオ 1: トップページ ===")
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
    check("タイトルに「トップページ」", "トップページ" in page.title(), page.title())
    for sel, label in [(".latest-posts", "最新投稿"), (".voted-posts", "最近いいね"),
                       (".recent-comments", "コメント"), (".community-posts", "コミュニティ"),
                       (".famed-posts", "殿堂入り")]:
        check(f"セクション: {label}", page.locator(sel).count() > 0)

    # ── シナリオ 2: フィードページ ────────────────────────────
    print("\n=== シナリオ 2: フィードページ ===")
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
    page.get_by_text("最新の投稿を見る").click()
    page.wait_for_load_state("networkidle")
    check("フィードへ遷移", "フィード" in page.title(), page.title())
    posts = page.locator(".feed-posts section").count()
    check("投稿一覧が表示される", posts > 0, f"{posts}件")
    check("ページネーション表示", page.get_by_text("›").count() > 0 or page.get_by_text("‹").count() > 0)
    feed_sel = page.locator(".feed-type-select select")
    feed_sel.select_option("likes")
    page.wait_for_load_state("networkidle")
    check("いいね順タブ切替", "いいね" in page.title(), page.title())
    feed_sel.select_option("unboundedLikes")
    page.wait_for_load_state("networkidle")
    check("無期限いいね順タブ切替", "無期限" in page.title(), page.title())
    feed_sel.select_option("timeDesc")
    page.wait_for_load_state("networkidle")
    check("新着順タブ切替", "フィード" in page.title(), page.title())

    # ── シナリオ 3: ランダムページ ───────────────────────────
    # /random は /?tab=random にリダイレクトされる
    print("\n=== シナリオ 3: ランダムページ ===")
    page.goto(f"{BASE_URL}/?tab=random")
    page.wait_for_load_state("networkidle")
    check("ランダムタブ表示", "トップページ" in page.title(), page.title())
    check("ランダム投稿セクション", page.locator(".random-posts").count() > 0)
    check("ランダムコメントセクション", page.locator(".recent-comments").count() > 0)

    # ── シナリオ 4: サイト説明ページ ────────────────────────
    print("\n=== シナリオ 4: サイト説明ページ ===")
    page.goto(f"{BASE_URL}/readme")
    page.wait_for_load_state("networkidle")
    check("タイトルに「サイト説明」", "サイト説明" in page.title(), page.title())

    # ── シナリオ 5: 検索ページ ───────────────────────────────
    # GCS 環境変数未設定の場合、loader が 500 を返す → SKIP
    print("\n=== シナリオ 5: 検索ページ ===")
    page.goto(f"{BASE_URL}/search", wait_until="domcontentloaded")
    title = page.title()
    if "検索" not in title and title == "":
        skip("検索ページ表示", "GCS 環境変数未設定のため 500 エラー（ローカル dev では SKIP）")
        skip("キーワード検索結果表示", "検索ページ 500 エラーのためスキップ")
        skip("タグ検索結果表示", "検索ページ 500 エラーのためスキップ")
    else:
        check("検索ページ表示", "検索" in title, title)
        try:
            page.wait_for_selector(".search-input-form", timeout=30000)  # DuckDB-WASM 初期化待ち
            check("検索UI初期化完了", True)
            page.locator("input[name='q']").fill("Twitter")
            time.sleep(3)
            result_cards = page.locator(".search-results .post-title").count()
            check("キーワード検索結果表示", result_cards > 0, f"{result_cards}件")
        except Exception as e:
            page.screenshot(path=f"{OUTPUT_DIR}/fail_search.png")
            check("検索UI初期化完了", False, str(e)[:80])
            check("キーワード検索結果表示", False, "初期化失敗のためスキップ")
        try:
            page.goto(f"{BASE_URL}/search", wait_until="domcontentloaded")
            page.wait_for_selector(".search-input-form", timeout=30000)
            page.get_by_text("タグ選択").click()
            time.sleep(1)
            tag_input = page.locator("input[placeholder*='タグ']").first
            if tag_input.count() > 0:
                tag_input.fill("やってはいけないこと")
                time.sleep(1)
                page.get_by_text("やってはいけないこと").first.click()
                time.sleep(3)
                result_cards = page.locator(".search-results .post-title").count()
                check("タグ検索結果表示", result_cards > 0, f"{result_cards}件")
            else:
                check("タグ検索結果表示", False, "タグ入力フィールドが見つからない")
        except Exception as e:
            page.screenshot(path=f"{OUTPUT_DIR}/fail_tag_search.png")
            check("タグ検索結果表示", False, str(e)[:80])

    # ── シナリオ 6: 投稿フォーム ─────────────────────────────
    # 全フィールドを上から順に入力し「投稿する」でプレビューモーダルが開くことを確認
    print("\n=== シナリオ 6: 投稿フォーム ===")
    page.goto(f"{BASE_URL}/post", wait_until="domcontentloaded")
    try:
        page.wait_for_selector("form", timeout=15000)
        check("投稿ページ表示", "投稿" in page.title(), page.title())
    except Exception as e:
        check("投稿ページ表示", False, str(e)[:80])
    try:
        page.locator("#who").fill("テストユーザーが")
        page.locator("#what").fill("友人に")
        page.locator("#when").fill("昨日")
        page.locator("#where").fill("公園で")
        page.locator("#why").fill("面白そうだったから")
        page.locator("#how").fill("冗談を言った")
        page.locator("#then").fill("空気が悪くなった")
        check("5W1H フィールド入力", True)
        page.get_by_placeholder("友人の言動は冗談だという事に気が付く必要があった").fill("気をつけるべきだった")
        page.get_by_placeholder("冗談に対してただ笑うべきだった").fill("笑うだけにすべきだった")
        page.get_by_placeholder("タイトル").fill("テスト投稿タイトル")
        page.get_by_role("button", name="投稿する").click()
        try:
            page.wait_for_selector("dialog.modal-open", timeout=10000)
            modal_visible = True
        except Exception:
            modal_visible = False
        toast = toast_text(page)
        no_error = "必須" not in toast and "エラー" not in toast
        check("フォーム送信（エラーなし）", no_error, f"toast: {toast[:60]!r}")
        check("プレビューモーダル表示", modal_visible or "/archives/" in page.url,
              f"modal={modal_visible}")
        page.screenshot(path=f"{OUTPUT_DIR}/post_submit_result.png")
    except Exception as e:
        page.screenshot(path=f"{OUTPUT_DIR}/fail_post_submit.png")
        check("5W1H フィールド入力", False, str(e)[:80])
        check("フォーム送信（エラーなし）", False, "入力失敗のためスキップ")
        check("プレビューモーダル表示", False, "入力失敗のためスキップ")

    browser.close()

# ── レポート出力 ─────────────────────────────────────────────
pass_count = sum(1 for _, s, _ in results if s == "PASS")
fail_count = sum(1 for _, s, _ in results if s == "FAIL")
skip_count = sum(1 for _, s, _ in results if s == "SKIP")
lines = [
    "# E2E テスト結果レポート\n",
    f"**合計: {len(results)} / PASS: {pass_count} / FAIL: {fail_count} / SKIP: {skip_count}**\n",
    "| シナリオ | 結果 | 備考 |",
    "|---------|------|------|",
]
for name, status, detail in results:
    icon = {"PASS": "✅", "FAIL": "❌", "SKIP": "⏭️"}.get(status, "")
    lines.append(f"| {name} | {icon} {status} | {detail} |")
report = "\n".join(lines)
print("\n\n" + report)
os.makedirs(OUTPUT_DIR, exist_ok=True)
with open(f"{OUTPUT_DIR}/report.md", "w") as f:
    f.write(report)
print(f"\nレポート保存: {OUTPUT_DIR}/report.md")
