import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { createRoutesStub, useNavigate } from "react-router";
import type { ActionFunctionArgs } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import History, { loader } from "~/routes/_layout.history";
import { getLibraryPage } from "./library.server";

vi.mock("~/modules/library.server", () => ({ getLibraryPage: vi.fn() }));

const entry = {
  postId: 42,
  postTitle: "テスト事例",
  commentId: null,
};
const events = [
  {
    ...entry,
    kind: "comment_dislike" as const,
    occurredAt: "2026-10-10T00:05:00.000Z",
    commentId: 102,
  },
  {
    ...entry,
    kind: "comment_like" as const,
    occurredAt: "2026-10-10T00:04:00.000Z",
    commentId: 101,
  },
  { ...entry, kind: "dislike" as const, occurredAt: "2026-10-10T00:03:00.000Z" },
  { ...entry, kind: "like" as const, occurredAt: "2026-10-10T00:02:00.000Z" },
  { ...entry, kind: "view" as const, occurredAt: "2026-10-10T00:01:00.000Z" },
];

function page(entries = events, historyEnabled = true) {
  return { entries, page: 1, totalPages: 1, total: entries.length, historyEnabled };
}

describe("履歴の表示と検索", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("すべての種類を並べ、検索窓だけで絞り込みと解除ができる", async () => {
    vi.mocked(getLibraryPage).mockImplementation(async (_request, options) =>
      page(options.query === "本文タグ" ? [events[0]] : events),
    );
    const Stub = createRoutesStub([{ path: "/history", loader, Component: History }]);
    render(<Stub initialEntries={["/history"]} />);

    const search = await screen.findByRole("searchbox", { name: "履歴を検索" });
    expect(screen.getAllByRole("link", { name: "テスト事例" })).toHaveLength(5);
    expect(screen.getByText(/^コメントを逆評価 ·/)).toBeInTheDocument();
    expect(screen.getByText(/^コメントを評価 ·/)).toBeInTheDocument();
    expect(screen.getByText(/^良くないね ·/)).toBeInTheDocument();
    expect(screen.getByText(/^いいね ·/)).toBeInTheDocument();
    expect(screen.getByText(/^閲覧 ·/)).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: "テスト事例" });
    expect(links[0]).toHaveAttribute("href", "/archives/42#comment-102");
    expect(links[1]).toHaveAttribute("href", "/archives/42#comment-101");
    expect(links[4]).toHaveAttribute("href", "/archives/42");
    expect(screen.queryByText(/保存|メモ/)).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "表示する" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "本文タグ" } });
    await waitFor(() =>
      expect(screen.getAllByRole("link", { name: "テスト事例" })).toHaveLength(1),
    );
    expect(search).toHaveValue("本文タグ");
    expect(getLibraryPage).toHaveBeenLastCalledWith(expect.any(Request), expect.objectContaining({
      query: "本文タグ",
    }));

    fireEvent.change(search, { target: { value: "" } });
    await waitFor(() =>
      expect(screen.getAllByRole("link", { name: "テスト事例" })).toHaveLength(5),
    );
    expect(search).toHaveValue("");
    expect(screen.queryByText(/管理者限定|管理画面/)).not.toBeInTheDocument();
  });

  it("IMEの未確定文字では検索せず、確定した文字で検索する", async () => {
    vi.mocked(getLibraryPage).mockResolvedValue(page([]));
    const Stub = createRoutesStub([{ path: "/history", loader, Component: History }]);
    render(<Stub initialEntries={["/history"]} />);
    const search = await screen.findByRole("searchbox", { name: "履歴を検索" });

    fireEvent.compositionStart(search);
    fireEvent.change(search, { target: { value: "けんさく" } });
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(getLibraryPage).toHaveBeenCalledTimes(1);
    fireEvent.change(search, { target: { value: "検索" } });
    fireEvent.compositionEnd(search);
    await waitFor(() =>
      expect(getLibraryPage).toHaveBeenLastCalledWith(expect.any(Request), expect.objectContaining({
        query: "検索",
      })),
    );
  });

  it("先の検索結果が届いても、その後に入力した文字を上書きしない", async () => {
    let releaseFirst: (() => void) | undefined;
    vi.mocked(getLibraryPage).mockImplementation(async (_request, options) => {
      if (options.query === "先の検索") {
        await new Promise<void>((resolve) => {
          releaseFirst = resolve;
        });
      }
      return page([]);
    });
    const Stub = createRoutesStub([{ path: "/history", loader, Component: History }]);
    render(<Stub initialEntries={["/history"]} />);
    const search = await screen.findByRole("searchbox", { name: "履歴を検索" });
    fireEvent.change(search, { target: { value: "先の検索" } });
    await waitFor(() => expect(releaseFirst).toBeDefined());
    fireEvent.change(search, { target: { value: "次の検索" } });
    releaseFirst?.();
    await screen.findByText("該当する履歴はありません。");
    expect(search).toHaveValue("次の検索");
    await waitFor(() =>
      expect(getLibraryPage).toHaveBeenLastCalledWith(expect.any(Request), expect.objectContaining({
        query: "次の検索",
      })),
    );
    expect(search).toHaveValue("次の検索");
  });

  it("前後のページに検索語を引き継ぎ、検索を変更すると先頭ページに戻る", async () => {
    vi.mocked(getLibraryPage).mockImplementation(async (_request, options) => ({
      ...page(),
      page: options.page || 1,
      total: 105,
      totalPages: 3,
    }));
    function WithBack() {
      const navigate = useNavigate();
      return (
        <>
          <button type="button" onClick={() => void navigate(-1)}>戻る</button>
          <History />
        </>
      );
    }
    const Stub = createRoutesStub([{ path: "/history", loader, Component: WithBack }]);
    render(<Stub initialEntries={["/history?page=2&q=%E6%9C%AC%E6%96%87"]} />);

    const search = await screen.findByRole("searchbox", { name: "履歴を検索" });
    expect(search).toHaveValue("本文");
    expect(screen.getByRole("link", { name: "前へ" })).toHaveAttribute(
      "href",
      "/history?page=1&q=%E6%9C%AC%E6%96%87",
    );
    expect(screen.getByRole("link", { name: "次へ" })).toHaveAttribute(
      "href",
      "/history?page=3&q=%E6%9C%AC%E6%96%87",
    );
    fireEvent.click(screen.getByRole("link", { name: "次へ" }));
    await screen.findByText("3 / 3");
    expect(screen.queryByRole("link", { name: "次へ" })).not.toBeInTheDocument();
    expect(getLibraryPage).toHaveBeenLastCalledWith(expect.any(Request), {
      query: "本文",
      page: 3,
    });

    fireEvent.click(screen.getByRole("link", { name: "前へ" }));
    await screen.findByText("2 / 3");
    expect(search).toHaveValue("本文");
    expect(getLibraryPage).toHaveBeenLastCalledWith(expect.any(Request), {
      query: "本文",
      page: 2,
    });

    fireEvent.change(search, { target: { value: "コメント" } });
    await screen.findByText("1 / 3");
    expect(screen.queryByRole("link", { name: "前へ" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "次へ" })).toHaveAttribute(
      "href",
      "/history?page=2&q=%E3%82%B3%E3%83%A1%E3%83%B3%E3%83%88",
    );
    expect(getLibraryPage).toHaveBeenLastCalledWith(expect.any(Request), expect.objectContaining({
      query: "コメント",
    }));
    expect(search).toHaveValue("コメント");
    fireEvent.click(screen.getByRole("button", { name: "戻る" }));
    await screen.findByText("3 / 3");
    await waitFor(() => expect(search).toHaveValue("本文"));
  });

  it("再取得した設定から切り替え、更新失敗時は現在の状態を保つ", async () => {
    let cloudHistoryEnabled = true;
    let rejectUpdate = false;
    vi.mocked(getLibraryPage).mockImplementation(async () => page([], cloudHistoryEnabled));
    const submittedSettings: string[] = [];
    const action = vi.fn(async ({ request }: ActionFunctionArgs) => {
      const form = await request.formData();
      expect(form.get("intent")).toBe("setHistoryEnabled");
      const enabled = String(form.get("enabled"));
      submittedSettings.push(enabled);
      if (rejectUpdate) return Response.json({ success: false, error: "設定を更新できませんでした" }, { status: 500 });
      cloudHistoryEnabled = enabled === "true";
      return { success: true };
    });
    const Stub = createRoutesStub([
      { path: "/history", loader, Component: History },
      { path: "/api/library", action },
    ]);
    render(<Stub initialEntries={["/history"]} />);
    const initialDisable = await screen.findByRole("button", { name: "履歴を無効にする" });
    expect(screen.getByRole("status")).toHaveTextContent("履歴の記録：有効");
    fireEvent.click(initialDisable);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "履歴を有効にする" })).toBeEnabled(),
    );
    expect(submittedSettings).toEqual(["false"]);
    expect(screen.getByRole("status")).toHaveTextContent("履歴の記録：無効");

    cloudHistoryEnabled = true;
    fireEvent.change(screen.getByRole("searchbox", { name: "履歴を検索" }), {
      target: { value: "再取得" },
    });
    const disable = await screen.findByRole("button", { name: "履歴を無効にする" });
    await waitFor(() => expect(disable).toBeEnabled());
    expect(screen.getByRole("status")).toHaveTextContent("履歴の記録：有効");
    fireEvent.click(disable);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "履歴を有効にする" })).toBeEnabled(),
    );
    expect(submittedSettings).toEqual(["false", "false"]);
    expect(cloudHistoryEnabled).toBe(false);
    expect(screen.getByRole("status")).toHaveTextContent("履歴の記録：無効");

    rejectUpdate = true;
    fireEvent.click(screen.getByRole("button", { name: "履歴を有効にする" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("設定を更新できませんでした");
    expect(screen.getByRole("status")).toHaveTextContent("履歴の記録：無効");
    expect(screen.getByRole("button", { name: "履歴を有効にする" })).toBeEnabled();
    expect(submittedSettings).toEqual(["false", "false", "true"]);
  });

  it("消去確認を開く、キャンセル、ESC、外側で閉じる操作では送信しない", async () => {
    vi.mocked(getLibraryPage).mockResolvedValue(page());
    const action = vi.fn(async () => ({ success: true }));
    const Stub = createRoutesStub([
      { path: "/history", loader, Component: History },
      { path: "/api/library", action },
    ]);
    render(<Stub initialEntries={["/history"]} />);
    const trigger = await screen.findByRole("button", { name: "履歴を消去" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "履歴を消去しますか？" });
    expect(dialog).toHaveAttribute("open");
    expect(dialog).toHaveAccessibleDescription("すべての履歴を消去します。");
    expect(action).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "キャンセル" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(trigger);
    const escapedDialog = await screen.findByRole("dialog", { name: "履歴を消去しますか？" });
    fireEvent(escapedDialog, new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(trigger);
    const outsideDialog = await screen.findByRole("dialog", { name: "履歴を消去しますか？" });
    fireEvent.click(within(outsideDialog).getByRole("button", { name: "確認を閉じる" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "テスト事例の履歴を消去（閲覧）" }));
    const entryDialog = await screen.findByRole("dialog", { name: "履歴を消去しますか？" });
    expect(entryDialog).toHaveAccessibleDescription("「テスト事例」の履歴（閲覧 · 2026/10/10 9:01:00）を消去します。");
    fireEvent.click(within(entryDialog).getByRole("button", { name: "キャンセル" }));
    fireEvent.click(trigger);
    expect(await screen.findByRole("dialog")).toHaveAccessibleDescription("すべての履歴を消去します。");
    expect(action).not.toHaveBeenCalled();
  });

  it("選んだコメント評価だけを消去し、他の履歴と検索語を保つ", async () => {
    let remaining = events;
    vi.mocked(getLibraryPage).mockImplementation(async () => page(remaining, false));
    const action = vi.fn(async ({ request }: ActionFunctionArgs) => {
      const form = await request.formData();
      expect(Object.fromEntries(form)).toEqual({
        intent: "clearEntry",
        kind: "comment_dislike",
        targetId: "102",
        occurredAt: events[0].occurredAt,
      });
      remaining = remaining.filter((event) => event !== events[0]);
      return { success: true };
    });
    const Stub = createRoutesStub([
      { path: "/history", loader, Component: History },
      { path: "/api/library", action },
    ]);
    render(<Stub initialEntries={["/history?q=%E6%9C%AC%E6%96%87"]} />);
    fireEvent.click(await screen.findByRole("button", { name: "テスト事例の履歴を消去（コメントを逆評価）" }));
    const dialog = await screen.findByRole("dialog", { name: "履歴を消去しますか？" });
    expect(dialog).toHaveAccessibleDescription("「テスト事例」の履歴（コメントを逆評価 · 2026/10/10 9:05:00）を消去します。");
    expect(action).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "消去する" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(action).toHaveBeenCalledOnce();
    expect(screen.getAllByRole("link", { name: "テスト事例" })).toHaveLength(4);
    expect(screen.queryByText(/^コメントを逆評価 ·/)).not.toBeInTheDocument();
    expect(screen.getByText(/^コメントを評価 ·/)).toBeInTheDocument();
    expect(screen.getByText(/^閲覧 ·/)).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "履歴を検索" })).toHaveValue("本文");
    expect(screen.getByRole("status")).toHaveTextContent("履歴の記録：無効");
  });

  it("確認後だけ消去を送り、送信中は閉じず、成功後に閉じて再度開ける", async () => {
    vi.mocked(getLibraryPage).mockResolvedValue(page());
    let finish!: (result: { success: boolean }) => void;
    const response = new Promise<{ success: boolean }>((resolve) => {
      finish = resolve;
    });
    const action = vi.fn(async ({ request }: ActionFunctionArgs) => {
      const form = await request.formData();
      expect(form.get("intent")).toBe("clearHistory");
      return response;
    });
    const Stub = createRoutesStub([
      { path: "/history", loader, Component: History },
      { path: "/api/library", action },
    ]);
    render(<Stub initialEntries={["/history"]} />);
    const trigger = await screen.findByRole("button", { name: "履歴を消去" });
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "履歴を消去しますか？" });
    const form = within(dialog).getByRole("button", { name: "消去する" }).closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    expect(within(dialog).getByRole("button", { name: "消去中..." })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "キャンセル" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "確認を閉じる" })).toBeDisabled();
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    fireEvent.click(within(dialog).getByRole("button", { name: "確認を閉じる" }));
    expect(dialog).toHaveAttribute("open");
    expect(action).toHaveBeenCalledOnce();

    finish({ success: true });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    fireEvent.click(trigger);
    const reopened = await screen.findByRole("dialog", { name: "履歴を消去しますか？" });
    expect(reopened).toHaveAttribute("open");
    expect(action).toHaveBeenCalledOnce();
    fireEvent.click(within(reopened).getByRole("button", { name: "キャンセル" }));
  });

  it("消去失敗は確認内に表示して開いたまま保ち、再試行の成功後に閉じる", async () => {
    vi.mocked(getLibraryPage).mockResolvedValue(page());
    const action = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ success: false, error: "履歴を消去できませんでした" }, { status: 500 }),
      )
      .mockResolvedValueOnce({ success: true });
    const Stub = createRoutesStub([
      { path: "/history", loader, Component: History },
      { path: "/api/library", action },
    ]);
    render(<Stub initialEntries={["/history"]} />);
    fireEvent.click(await screen.findByRole("button", { name: "履歴を消去" }));
    const dialog = await screen.findByRole("dialog", { name: "履歴を消去しますか？" });
    fireEvent.click(within(dialog).getByRole("button", { name: "消去する" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("履歴を消去できませんでした");
    expect(dialog).toHaveAttribute("open");
    const retry = within(dialog).getByRole("button", { name: "消去する" });
    expect(retry).toBeEnabled();
    expect(within(dialog).getByRole("button", { name: "キャンセル" })).toBeEnabled();

    fireEvent.click(retry);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(action).toHaveBeenCalledTimes(2);
  });
});
