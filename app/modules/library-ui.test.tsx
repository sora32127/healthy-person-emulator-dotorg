import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { createRoutesStub } from "react-router";
import type { ActionFunctionArgs } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import History, { loader } from "~/routes/_layout.history";
import { getLibraryPage } from "./library.server";

vi.mock("~/modules/library.server", () => ({ getLibraryPage: vi.fn() }));

describe("履歴の設定", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("別画面で設定が変更されたら再取得した値を表示し、次の送信も最新値から切り替える", async () => {
    let cloudHistoryEnabled = true;
    vi.mocked(getLibraryPage).mockImplementation(async () => ({
      entries: [],
      page: 1,
      totalPages: 1,
      total: 0,
      historyEnabled: cloudHistoryEnabled,
    }));
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

    const disableInitially = await screen.findByRole("button", { name: "履歴を無効にする" });
    expect(screen.getByRole("heading", { level: 1, name: "履歴" })).toBeInTheDocument();
    expect(screen.getByLabelText("表示")).toHaveValue("history");
    expect(getLibraryPage).toHaveBeenCalledWith(expect.any(Request), {
      view: "history",
      query: "",
      page: 1,
    });
    expect(screen.queryByText(/管理者限定|管理画面/)).not.toBeInTheDocument();
    fireEvent.click(disableInitially);
    expect(await screen.findByText("現在: 無効")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "履歴を有効にする" })).toBeEnabled(),
    );
    expect(submittedSettings).toEqual(["false"]);

    cloudHistoryEnabled = true;
    fireEvent.change(screen.getByLabelText("タイトル・メモから検索"), {
      target: { value: "再取得" },
    });
    fireEvent.click(screen.getByRole("button", { name: "表示する" }));

    expect(await screen.findByText("現在: 有効")).toBeInTheDocument();
    const disable = await screen.findByRole("button", { name: "履歴を無効にする" });
    expect(disable).toBeEnabled();
    fireEvent.click(disable);

    expect(await screen.findByText("現在: 無効")).toBeInTheDocument();
    expect(submittedSettings).toEqual(["false", "false"]);
    expect(cloudHistoryEnabled).toBe(false);
  });

  it("通常の履歴ページから保存・メモを検索し、事例と保存済みメモを表示する", async () => {
    const entry = {
      postId: 42,
      postTitle: "テスト事例",
      isSaved: true,
      note: "読み返したいメモ",
      savedAt: "2026-10-10T00:00:00.000Z",
      lastViewedAt: "2026-10-10T00:00:00.000Z",
    };
    vi.mocked(getLibraryPage).mockImplementation(async (_request, options) => ({
      entries: options.view === "saved" && options.query === "読み返したい" ? [entry] : [],
      page: 1,
      totalPages: 1,
      total: options.view === "saved" && options.query === "読み返したい" ? 1 : 0,
      historyEnabled: true,
    }));
    const Stub = createRoutesStub([{ path: "/history", loader, Component: History }]);
    render(<Stub initialEntries={["/history"]} />);

    const view = await screen.findByLabelText("表示");
    expect(view).toHaveValue("history");
    fireEvent.change(view, { target: { value: "saved" } });
    fireEvent.change(screen.getByLabelText("タイトル・メモから検索"), {
      target: { value: "読み返したい" },
    });
    fireEvent.click(screen.getByRole("button", { name: "表示する" }));

    expect(await screen.findByRole("link", { name: "テスト事例" })).toHaveAttribute(
      "href",
      "/archives/42",
    );
    expect(screen.getByLabelText("表示")).toHaveValue("saved");
    expect(screen.getByLabelText("タイトル・メモから検索")).toHaveValue("読み返したい");
    expect(screen.getByLabelText("自分用のメモ")).toHaveValue("読み返したいメモ");
    expect(screen.getByRole("button", { name: "保存を解除" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(getLibraryPage).toHaveBeenLastCalledWith(expect.any(Request), {
      view: "saved",
      query: "読み返したい",
      page: 1,
    });
    expect(screen.queryByText(/管理者限定|管理画面/)).not.toBeInTheDocument();
  });
});
