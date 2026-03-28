import "../index.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProjectId, ThreadId } from "@t3tools/contracts";
import { page, userEvent } from "vitest/browser";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import {
  DEFAULT_INTERACTION_MODE,
  DEFAULT_RUNTIME_MODE,
  type Project,
  type Thread,
} from "../types";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: ProjectId.makeUnsafe("project-1"),
    name: "Alpha",
    cwd: "/repo/alpha",
    defaultModelSelection: {
      provider: "codex",
      model: "gpt-5.4",
    },
    expanded: true,
    createdAt: "2026-03-09T10:00:00.000Z",
    updatedAt: "2026-03-09T10:00:00.000Z",
    scripts: [],
    ...overrides,
  };
}

function makeThread(overrides: Partial<Thread> = {}): Thread {
  return {
    id: ThreadId.makeUnsafe("thread-1"),
    codexThreadId: null,
    projectId: ProjectId.makeUnsafe("project-1"),
    title: "Thread",
    modelSelection: {
      provider: "codex",
      model: "gpt-5.4",
    },
    runtimeMode: DEFAULT_RUNTIME_MODE,
    interactionMode: DEFAULT_INTERACTION_MODE,
    session: null,
    messages: [],
    proposedPlans: [],
    error: null,
    createdAt: "2026-03-09T10:00:00.000Z",
    updatedAt: "2026-03-09T10:00:00.000Z",
    latestTurn: null,
    branch: null,
    worktreePath: null,
    turnDiffSummaries: [],
    activities: [],
    ...overrides,
  };
}

function findElementByText(text: string): HTMLElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLElement>("*")).find(
      (element) => element.textContent?.trim() === text,
    ) ?? null
  );
}

function getProjectsGroup(): HTMLElement {
  const projectsLabel = findElementByText("Projects");
  if (!projectsLabel) {
    throw new Error("Projects label not found");
  }
  const group = projectsLabel.closest<HTMLElement>("[data-slot='sidebar-group']");
  if (!group) {
    throw new Error("Projects group not found");
  }
  return group;
}

async function renderSidebar(options?: {
  isElectron?: boolean;
  isLinuxDesktop?: boolean;
  sortOrder?: "updated_at" | "manual";
  projects?: Project[];
  threads?: Thread[];
  pickFolderResult?: string | null;
}) {
  vi.resetModules();

  const dispatchCommand = vi.fn().mockResolvedValue(undefined);
  const pickFolder = vi.fn().mockResolvedValue(options?.pickFolderResult ?? null);
  const handleNewThread = vi.fn().mockResolvedValue(undefined);
  const updateSettings = vi.fn();
  const navigate = vi.fn();

  vi.doMock("../env", () => ({
    isElectron: options?.isElectron ?? false,
  }));
  vi.doMock("../nativeApi", () => ({
    readNativeApi: () => ({
      dialogs: {
        pickFolder,
      },
      orchestration: {
        dispatchCommand,
      },
      shell: {
        openExternal: vi.fn().mockResolvedValue(undefined),
      },
    }),
  }));
  vi.doMock("../lib/serverReactQuery", () => ({
    serverConfigQueryOptions: () => ({
      queryKey: ["server", "config"],
      queryFn: async () => ({
        keybindings: [],
      }),
    }),
  }));
  vi.doMock("../hooks/useHandleNewThread", () => ({
    useHandleNewThread: () => ({
      handleNewThread,
    }),
  }));
  vi.doMock("../lib/utils", async () => {
    const actual = await vi.importActual<typeof import("../lib/utils")>("../lib/utils");
    return {
      ...actual,
      isLinuxPlatform: () => options?.isLinuxDesktop ?? false,
    };
  });
  vi.doMock("~/hooks/useAppVersion", () => ({
    useAppVersion: () => ({
      appVersion: "0.0.0",
      appVersionLabel: "v0.0.0",
    }),
  }));
  vi.doMock("~/hooks/useCopyToClipboard", () => ({
    useCopyToClipboard: () => ({
      copyToClipboard: vi.fn(),
      copiedValue: null,
      isCopied: false,
    }),
  }));
  vi.doMock("~/hooks/useSettings", () => ({
    useSettings: () => ({
      sidebarProjectSortOrder: options?.sortOrder ?? "updated_at",
      sidebarThreadSortOrder: "updated_at",
      defaultThreadEnvMode: "worktree",
    }),
    useUpdateSettings: () => ({
      updateSettings,
    }),
  }));
  vi.doMock("@tanstack/react-router", async () => {
    const actual =
      await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
    return {
      ...actual,
      useNavigate: () => navigate,
      useLocation: ({ select }: { select?: (location: { pathname: string }) => unknown }) =>
        select ? select({ pathname: "/" }) : { pathname: "/" },
      useParams: ({
        select,
      }: {
        select?: (params: Record<string, string | undefined>) => unknown;
      }) => (select ? select({}) : {}),
    };
  });

  const [{ default: Sidebar }, { SidebarProvider }, { useStore }] = await Promise.all([
    import("./Sidebar"),
    import("./ui/sidebar"),
    import("../store"),
  ]);

  useStore.setState({
    projects: options?.projects ?? [],
    threads: options?.threads ?? [],
    threadsHydrated: true,
  });

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  const host = document.createElement("div");
  document.body.append(host);
  const screen = await render(
    <QueryClientProvider client={queryClient}>
      <SidebarProvider defaultOpen>
        <Sidebar />
      </SidebarProvider>
    </QueryClientProvider>,
    { container: host },
  );

  const cleanup = async () => {
    await screen.unmount();
    host.remove();
  };

  return {
    [Symbol.asyncDispose]: cleanup,
    cleanup,
    dispatchCommand,
    handleNewThread,
    navigate,
    pickFolder,
    updateSettings,
  };
}

describe("Sidebar add-project row", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    window.localStorage.clear();
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("renders the dashed add-project row first and keeps it out of the header", async () => {
    await using _ = await renderSidebar({
      sortOrder: "manual",
      projects: [
        makeProject({
          id: ProjectId.makeUnsafe("project-1"),
          name: "Alpha",
        }),
        makeProject({
          id: ProjectId.makeUnsafe("project-2"),
          name: "Beta",
          cwd: "/repo/beta",
        }),
      ],
      threads: [
        makeThread(),
        makeThread({
          id: ThreadId.makeUnsafe("thread-2"),
          projectId: ProjectId.makeUnsafe("project-2"),
          title: "Thread 2",
        }),
      ],
    });

    await vi.waitFor(() => {
      expect(page.getByRole("button", { name: "Add project" })).toBeTruthy();
    });

    const projectsGroup = getProjectsGroup();
    const headerRow = findElementByText("Projects")?.parentElement;
    if (!headerRow) {
      throw new Error("Projects header row not found");
    }

    expect(headerRow.querySelector('[aria-label="Add project"]')).toBeNull();

    const menuItems = Array.from(
      projectsGroup.querySelectorAll<HTMLElement>(
        "[data-slot='sidebar-menu'] > [data-slot='sidebar-menu-item']",
      ),
    );

    expect(menuItems[0]?.textContent).toContain("+ Add project");
    expect(menuItems[1]?.textContent).toContain("Alpha");
    expect(menuItems[2]?.textContent).toContain("Beta");
  });

  it("shows the add-project row with the empty-state copy when there are no projects", async () => {
    await using _ = await renderSidebar();

    await vi.waitFor(() => {
      expect(findElementByText("No projects yet")).not.toBeNull();
    });

    const projectsGroup = getProjectsGroup();
    const menuItems = Array.from(
      projectsGroup.querySelectorAll<HTMLElement>(
        "[data-slot='sidebar-menu'] > [data-slot='sidebar-menu-item']",
      ),
    );

    expect(menuItems).toHaveLength(1);
    expect(menuItems[0]?.textContent).toContain("+ Add project");
    expect(findElementByText("No projects yet")).not.toBeNull();
  });

  it("toggles the inline add-project form below the row on web", async () => {
    await using _ = await renderSidebar({
      projects: [makeProject()],
      threads: [makeThread()],
    });

    const addProjectButton = page.getByRole("button", { name: "Add project" });
    await addProjectButton.click();

    await vi.waitFor(() => {
      expect(document.querySelector('input[placeholder="/path/to/project"]')).not.toBeNull();
    });

    const addProjectRow = findElementByText("Cancel add project");
    const pathInput = document.querySelector<HTMLInputElement>(
      'input[placeholder="/path/to/project"]',
    );
    if (!addProjectRow || !pathInput) {
      throw new Error("Expected add-project row and inline form");
    }

    expect(pathInput.compareDocumentPosition(addProjectRow)).toBe(Node.DOCUMENT_POSITION_PRECEDING);
    expect(document.querySelector('[aria-label="Cancel add project"]')).not.toBeNull();
    expect(
      document.querySelector('[aria-label="Cancel add project"]')?.getAttribute("aria-pressed"),
    ).toBe("true");

    await page.getByRole("button", { name: "Cancel add project" }).click();

    await vi.waitFor(() => {
      expect(document.querySelector('input[placeholder="/path/to/project"]')).toBeNull();
    });
  });

  it("supports keyboard activation and submits the relocated form", async () => {
    await using mounted = await renderSidebar();

    const addProjectButton = document.querySelector<HTMLButtonElement>(
      '[aria-label="Add project"]',
    );
    if (!addProjectButton) {
      throw new Error("Add project button not found");
    }
    addProjectButton.focus();
    await userEvent.keyboard("{Space}");

    await vi.waitFor(() => {
      expect(document.querySelector('input[placeholder="/path/to/project"]')).not.toBeNull();
    });

    const input = document.querySelector<HTMLInputElement>('input[placeholder="/path/to/project"]');
    if (!input) {
      throw new Error("Project path input not found");
    }

    await page.getByRole("textbox").fill("/repo/new-project");
    await page.getByRole("button", { name: "Add" }).click();

    await vi.waitFor(() => {
      expect(mounted.dispatchCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "project.create",
          workspaceRoot: "/repo/new-project",
        }),
      );
      expect(mounted.handleNewThread).toHaveBeenCalledTimes(1);
    });
  });

  it("opens inline entry on Linux Electron", async () => {
    await using _ = await renderSidebar({
      isElectron: true,
      isLinuxDesktop: true,
    });

    await page.getByRole("button", { name: "Add project" }).click();

    await vi.waitFor(() => {
      expect(document.querySelector('input[placeholder="/path/to/project"]')).not.toBeNull();
    });
  });

  it("uses the native folder picker on macOS and Windows Electron", async () => {
    await using mounted = await renderSidebar({
      isElectron: true,
      isLinuxDesktop: false,
    });

    await page.getByRole("button", { name: "Add project" }).click();

    await vi.waitFor(() => {
      expect(mounted.pickFolder).toHaveBeenCalledTimes(1);
    });
    expect(document.querySelector('input[placeholder="/path/to/project"]')).toBeNull();
  });
});
