import { useLocation, useNavigate } from "@tanstack/react-router";
import { PanelLeftIcon, SettingsIcon } from "lucide-react";
import type { ReactNode, SVGProps } from "react";

import { isElectron } from "../env";
import { cn } from "../lib/utils";
import { isMacPlatform } from "../lib/utils";
import { resolveActivityBarActiveItem, resolveFirstActivityAction } from "./ActivityBar.logic";
import { Button } from "./ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "./ui/tooltip";
import { useSidebar } from "./ui/sidebar";

function PanelOutlineIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      {...props}
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
    </svg>
  );
}

function ActivityBarButton(props: {
  current?: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  pressed?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            size="icon"
            variant="ghost"
            aria-current={props.current ? "page" : undefined}
            aria-label={props.label}
            aria-pressed={props.pressed}
            className="size-10 rounded-xl border border-transparent text-sidebar-foreground/68 transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-ring"
            onClick={props.onClick}
          />
        }
      >
        {props.icon}
      </TooltipTrigger>
      <TooltipPopup side="right">{props.label}</TooltipPopup>
    </Tooltip>
  );
}

export default function ActivityBar() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const navigate = useNavigate();
  const { isMobile, open, openMobile, toggleSidebar } = useSidebar();
  const activeItem = resolveActivityBarActiveItem(pathname);
  const isChatRoute = activeItem === "chat";
  const isChatSidebarOpen = isMobile ? openMobile : open;
  const shouldShowMacTitlebarInset = isElectron && isMacPlatform(navigator.platform);

  const handleFirstActivityClick = () => {
    const action = resolveFirstActivityAction(pathname, window.history.state);

    if (action === "toggle-sidebar") {
      toggleSidebar();
      return;
    }

    if (action === "history-back") {
      window.history.back();
      return;
    }

    void navigate({ to: "/" });
  };

  const handleSettingsClick = () => {
    if (pathname === "/settings") {
      return;
    }

    void navigate({ to: "/settings" });
  };

  return (
    <aside className="relative z-20 flex h-dvh w-[var(--activity-bar-width)] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground max-md:z-[60]">
      {shouldShowMacTitlebarInset ? <div className="drag-region h-[52px] shrink-0" /> : null}
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col items-center px-1.5 pb-2",
          shouldShowMacTitlebarInset ? "pt-2" : "pt-1.5",
        )}
      >
        <ActivityBarButton
          icon={
            isChatRoute && isChatSidebarOpen ? (
              <PanelLeftIcon className="size-5" />
            ) : (
              <PanelOutlineIcon className="size-5" />
            )
          }
          label="Chat"
          onClick={handleFirstActivityClick}
          {...(isChatRoute ? { pressed: isChatSidebarOpen } : {})}
        />
        <div className="mt-auto">
          <ActivityBarButton
            current={activeItem === "settings"}
            icon={<SettingsIcon className="size-5" />}
            label="Settings"
            onClick={handleSettingsClick}
          />
        </div>
      </div>
    </aside>
  );
}
