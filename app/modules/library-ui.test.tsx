import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { createRoutesStub } from "react-router";
import type { ActionFunctionArgs } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdminLibrary, { loader } from "~/routes/admin.library";
import { getLibraryPage } from "./library.server";

vi.mock("~/modules/admin.server", () => ({ requireAdmin: vi.fn() }));
vi.mock("~/modules/library.server", () => ({ getLibraryPage: vi.fn() }));

describe("管理者の事例集の履歴設定", () => {
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
      { path: "/admin/library", loader, Component: AdminLibrary },
      { path: "/api/admin-library", action },
    ]);
    render(<Stub initialEntries={["/admin/library"]} />);

    fireEvent.click(await screen.findByRole("button", { name: "履歴を無効にする" }));
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
});
