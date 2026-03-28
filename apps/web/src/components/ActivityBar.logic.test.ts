import { describe, expect, it } from "vitest";

import {
  hasUsefulActivityHistoryEntry,
  resolveActivityBarActiveItem,
  resolveFirstActivityAction,
} from "./ActivityBar.logic";

describe("resolveActivityBarActiveItem", () => {
  it("highlights chat for the chat index route", () => {
    expect(resolveActivityBarActiveItem("/")).toBe("chat");
  });

  it("highlights chat for thread routes", () => {
    expect(resolveActivityBarActiveItem("/thread-123")).toBe("chat");
  });

  it("highlights settings for the settings route", () => {
    expect(resolveActivityBarActiveItem("/settings")).toBe("settings");
  });
});

describe("resolveFirstActivityAction", () => {
  it("uses history back on settings when there is a useful prior entry", () => {
    expect(resolveFirstActivityAction("/settings", { __TSR_index: 1 })).toBe("history-back");
  });

  it("falls back to the chat root on settings when history cannot go back", () => {
    expect(resolveFirstActivityAction("/settings", { __TSR_index: 0 })).toBe("navigate-root");
    expect(resolveFirstActivityAction("/settings", null)).toBe("navigate-root");
  });

  it("toggles the sidebar on chat routes", () => {
    expect(resolveFirstActivityAction("/", { __TSR_index: 3 })).toBe("toggle-sidebar");
    expect(resolveFirstActivityAction("/thread-123", { __TSR_index: 3 })).toBe("toggle-sidebar");
  });
});

describe("hasUsefulActivityHistoryEntry", () => {
  it("accepts positive TanStack Router history indexes only", () => {
    expect(hasUsefulActivityHistoryEntry({ __TSR_index: 2 })).toBe(true);
    expect(hasUsefulActivityHistoryEntry({ __TSR_index: 0 })).toBe(false);
    expect(hasUsefulActivityHistoryEntry({ __TSR_index: "2" })).toBe(false);
  });
});
