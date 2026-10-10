import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  isSaved: true,
  note: "読み返したいメモ",
  savedAt: "2026-10-10T00:00:00.000Z",
  lastViewedAt: "2026-10-10T00:00:00.000Z",
};
const events = [
  { ...entry, kind: "note" as const, occurredAt: "2026-10-10T00:03:00.000Z" },
  { ...entry, kind: "saved" as const, occurredAt: "2026-10-10T00:02:00.000Z" },
  { ...entry, kind: "view" as const, occurredAt: "2026-10-10T00:01:00.000Z" },
];

function page(entries = events, historyEnabled = true) {
  return { entries, page: 1, totalPages: 1, total: entries.length, historyEnabled };
}

describe("履歴の表示と検索", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("すべての種類を並べ、検索窓だけで絞り込みと解除ができる", async () => {
    vi.mocked(getLibraryPage).mockImplementation(async (_request, options) =>
      page(options.query === "本文タグ" ? [events[0]] : events),
    );
    const Stub = createRoutesStub([{ path: "/history", loader, Component: History }]);
    render(<Stub initialEntries={["/history?view=saved"]} />);

    const search = await screen.findByRole("searchbox", { name: "履歴を検索" });
    expect(screen.getAllByRole("link", { name: "テスト事例" })).toHaveLength(3);
    expect(screen.getByText(/^メモ ·/)).toBeInTheDocument();
    expect(screen.getByText(/^保存 ·/)).toBeInTheDocument();
    expect(screen.getByText(/^閲覧 ·/)).toBeInTheDocument();
    expect(screen.getByText("読み返したいメモ")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "表示する" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(getLibraryPage).toHaveBeenCalledWith(expect.any(Request), { query: "", page: 1 });

    fireEvent.change(search, { target: { value: "本文タグ" } });
    await waitFor(() =>
      expect(screen.getAllByRole("link", { name: "テスト事例" })).toHaveLength(1),
    );
    expect(search).toHaveValue("本文タグ");
    expect(getLibraryPage).toHaveBeenLastCalledWith(expect.any(Request), {
      query: "本文タグ",
      page: 1,
    });

    fireEvent.change(search, { target: { value: "" } });
    await waitFor(() =>
      expect(screen.getAllByRole("link", { name: "テスト事例" })).toHaveLength(3),
    );
    expect(search).toHaveValue("");
    expect(getLibraryPage).toHaveBeenLastCalledWith(expect.any(Request), { query: "", page: 1 });
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
      expect(getLibraryPage).toHaveBeenLastCalledWith(expect.any(Request), {
        query: "検索",
        page: 1,
      }),
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
      expect(getLibraryPage).toHaveBeenLastCalledWith(expect.any(Request), {
        query: "次の検索",
        page: 1,
      }),
    );
    expect(search).toHaveValue("次の検索");
  });

  it("戻る操作でURLの検索語を復元し、ページ移動にも検索語を引き継ぐ", async () => {
    vi.mocked(getLibraryPage).mockImplementation(async (_request, options) => ({
      ...page([]),
      page: options.page,
      totalPages: 2,
    }));
    function WithBack() {
      const navigate = useNavigate();
      return (
        <>
          <button type="button" onClick={() => void navigate(-1)}>
            戻る
          </button>
          <History />
        </>
      );
    }
    const Stub = createRoutesStub([{ path: "/history", loader, Component: WithBack }]);
    render(<Stub initialEntries={["/history?q=最初", "/history?q=次"]} initialIndex={1} />);
    const search = await screen.findByRole("searchbox", { name: "履歴を検索" });
    expect(search).toHaveValue("次");
    fireEvent.click(screen.getByRole("button", { name: "戻る" }));
    await waitFor(() => expect(search).toHaveValue("最初"));
    expect(screen.getByRole("link", { name: "次へ" })).toHaveAttribute(
      "href",
      "/history?page=2&q=%E6%9C%80%E5%88%9D",
    );
  });

  it("再取得した設定を表示し、次の設定変更も最新値から切り替える", async () => {
    let cloudHistoryEnabled = true;
    vi.mocked(getLibraryPage).mockImplementation(async () => page([], cloudHistoryEnabled));
    const submittedSettings: string[] = [];
    const action = vi.fn(async ({ request }: ActionFunctionArgs) => {
      const form = await request.formData();
      expect(form.get("intent")).toBe("setHistoryEnabled");
      const enabled = String(form.get("enabled"));
      submittedSettings.push(enabled);
      cloudHistoryEnabled = enabled === "true";
      return { success: true, historyEnabled: cloudHistoryEnabled };
    });
    const Stub = createRoutesStub([
      { path: "/history", loader, Component: History },
      { path: "/api/library", action },
    ]);
    render(<Stub initialEntries={["/history"]} />);
    fireEvent.click(await screen.findByRole("button", { name: "履歴を無効にする" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "履歴を有効にする" })).toBeEnabled(),
    );
    expect(submittedSettings).toEqual(["false"]);

    cloudHistoryEnabled = true;
    fireEvent.change(screen.getByRole("searchbox", { name: "履歴を検索" }), {
      target: { value: "再取得" },
    });
    const disable = await screen.findByRole("button", { name: "履歴を無効にする" });
    await waitFor(() => expect(disable).toBeEnabled());
    fireEvent.click(disable);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "履歴を有効にする" })).toBeEnabled(),
    );
    expect(submittedSettings).toEqual(["false", "false"]);
    expect(cloudHistoryEnabled).toBe(false);
    expect(disable).toHaveClass("shadow-none");
  });
});
