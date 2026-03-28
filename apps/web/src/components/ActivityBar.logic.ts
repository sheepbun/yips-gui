export type ActivityBarItem = "chat" | "settings";
export type FirstActivityAction = "history-back" | "navigate-root" | "toggle-sidebar";

type HistoryStateWithIndex = {
  __TSR_index?: unknown;
};

export function resolveActivityBarActiveItem(pathname: string): ActivityBarItem {
  return pathname === "/settings" ? "settings" : "chat";
}

export function hasUsefulActivityHistoryEntry(historyState: unknown): boolean {
  if (typeof historyState !== "object" || historyState === null) {
    return false;
  }

  const { __TSR_index } = historyState as HistoryStateWithIndex;
  return typeof __TSR_index === "number" && __TSR_index > 0;
}

export function resolveFirstActivityAction(
  pathname: string,
  historyState: unknown,
): FirstActivityAction {
  if (pathname !== "/settings") {
    return "toggle-sidebar";
  }

  return hasUsefulActivityHistoryEntry(historyState) ? "history-back" : "navigate-root";
}
