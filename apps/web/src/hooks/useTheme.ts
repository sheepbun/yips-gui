import { useCallback, useEffect, useSyncExternalStore } from "react";

import { DEFAULT_SERVER_SETTINGS, type DesktopTheme } from "@t3tools/contracts";
import type { AppTheme } from "@t3tools/contracts/settings";
import { useQuery } from "@tanstack/react-query";
import { serverConfigQueryOptions } from "~/lib/serverReactQuery";
import { useUpdateSettings } from "./useSettings";

type Theme = AppTheme;

const STORAGE_KEY = "t3code:theme";
const MEDIA_QUERY = "(prefers-color-scheme: dark)";

let lastDesktopTheme: DesktopTheme | null = null;
let hasMigratedLegacyTheme = false;

function getSystemDark(): boolean {
  return window.matchMedia(MEDIA_QUERY).matches;
}

function getStoredTheme(): Theme {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === "light" || raw === "dark" || raw === "system" || raw === "black") return raw;
  return "system";
}

function setStoredTheme(theme: Theme) {
  localStorage.setItem(STORAGE_KEY, theme);
}

function applyTheme(theme: Theme, suppressTransitions = false) {
  if (suppressTransitions) {
    document.documentElement.classList.add("no-transitions");
  }
  const isDark = theme === "dark" || theme === "black" || (theme === "system" && getSystemDark());
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.classList.toggle("theme-black", theme === "black");
  syncDesktopTheme(theme);
  if (suppressTransitions) {
    // Force a reflow so the no-transitions class takes effect before removal
    // oxlint-disable-next-line no-unused-expressions
    document.documentElement.offsetHeight;
    requestAnimationFrame(() => {
      document.documentElement.classList.remove("no-transitions");
    });
  }
}

function syncDesktopTheme(theme: Theme) {
  const desktopTheme: DesktopTheme = theme === "black" ? "dark" : theme;
  const bridge = window.desktopBridge;
  if (!bridge || lastDesktopTheme === desktopTheme) {
    return;
  }

  lastDesktopTheme = desktopTheme;
  void bridge.setTheme(desktopTheme).catch(() => {
    if (lastDesktopTheme === desktopTheme) {
      lastDesktopTheme = null;
    }
  });
}

// Apply immediately on module load to prevent flash
applyTheme(getStoredTheme());

function subscribeSystemDark(listener: () => void): () => void {
  const mq = window.matchMedia(MEDIA_QUERY);
  mq.addEventListener("change", listener);
  return () => {
    mq.removeEventListener("change", listener);
  };
}

export function useTheme() {
  const { updateSettings } = useUpdateSettings();
  const serverConfigQuery = useQuery(serverConfigQueryOptions());
  const systemDark = useSyncExternalStore(subscribeSystemDark, getSystemDark);
  const storedTheme = getStoredTheme();
  const serverTheme = serverConfigQuery.data?.settings.theme;
  const theme =
    serverConfigQuery.status === "success" &&
    serverTheme === DEFAULT_SERVER_SETTINGS.theme &&
    storedTheme !== DEFAULT_SERVER_SETTINGS.theme &&
    !hasMigratedLegacyTheme
      ? storedTheme
      : (serverTheme ?? storedTheme);

  const resolvedTheme: "light" | "dark" =
    theme === "system" ? (systemDark ? "dark" : "light") : theme === "black" ? "dark" : theme;

  const setTheme = useCallback(
    (next: Theme) => {
      setStoredTheme(next);
      applyTheme(next, true);
      updateSettings({ theme: next });
    },
    [updateSettings],
  );

  useEffect(() => {
    if (
      hasMigratedLegacyTheme ||
      serverConfigQuery.status !== "success" ||
      serverTheme === undefined ||
      serverTheme !== DEFAULT_SERVER_SETTINGS.theme
    ) {
      return;
    }

    const legacyTheme = getStoredTheme();
    hasMigratedLegacyTheme = true;
    if (legacyTheme === DEFAULT_SERVER_SETTINGS.theme) {
      return;
    }

    updateSettings({ theme: legacyTheme });
  }, [serverConfigQuery.status, serverTheme, updateSettings]);

  // Keep DOM in sync on mount/change
  useEffect(() => {
    setStoredTheme(theme);
    applyTheme(theme);
  }, [theme]);

  return { theme, setTheme, resolvedTheme } as const;
}
