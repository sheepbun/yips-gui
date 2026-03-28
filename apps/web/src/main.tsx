import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { createHashHistory, createBrowserHistory } from "@tanstack/react-router";

import "@xterm/xterm/css/xterm.css";
import "./index.css";

import { isElectron } from "./env";
import { getRouter } from "./router";
import { APP_DISPLAY_NAME } from "./branding";
import { serverConfigQueryOptions } from "./lib/serverReactQuery";
import { readNativeApi } from "./nativeApi";

// Electron loads the app from a file-backed shell, so hash history avoids path resolution issues.
const history = isElectron ? createHashHistory() : createBrowserHistory();

const router = getRouter(history);

document.title = APP_DISPLAY_NAME;

async function bootstrap() {
  if (readNativeApi()) {
    // Warm server config before first paint so runtime metadata does not flash
    // stale build-time fallbacks during startup.
    await router.options.context.queryClient
      .ensureQueryData(serverConfigQueryOptions())
      .catch(() => undefined);
  }

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <RouterProvider router={router} />
    </React.StrictMode>,
  );
}

void bootstrap();
