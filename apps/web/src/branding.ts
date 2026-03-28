export const APP_BASE_NAME = "Yips GUI";
export const APP_DISPLAY_NAME = APP_BASE_NAME;
export const APP_VERSION = import.meta.env.APP_VERSION || "0.0.0";
export const APP_VERSION_LABEL =
  import.meta.env.APP_VERSION_LABEL ||
  (APP_VERSION.startsWith("v") ? APP_VERSION : `v${APP_VERSION}`);
