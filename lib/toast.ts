/** Helpers for server actions to add a one-shot toast to the redirect URL. */
export function toastQuery(message: string, type: "success" | "error" | "info" = "success"): string {
  const sp = new URLSearchParams();
  sp.set("toast", message);
  sp.set("toastType", type);
  return sp.toString();
}

/** Append toast params onto an existing URL path. */
export function withToast(path: string, message: string, type: "success" | "error" | "info" = "success"): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}${toastQuery(message, type)}`;
}
