import { useQuery } from "@tanstack/react-query";

import { APP_VERSION, APP_VERSION_LABEL } from "../branding";
import { serverConfigQueryOptions } from "../lib/serverReactQuery";

export function useAppVersion() {
  const serverConfigQuery = useQuery(serverConfigQueryOptions());

  return {
    appVersion: serverConfigQuery.data?.appVersion ?? APP_VERSION,
    appVersionLabel: serverConfigQuery.data?.appVersionLabel ?? APP_VERSION_LABEL,
  } as const;
}
