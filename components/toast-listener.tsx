"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";

export function ToastListener() {
  const sp = useSearchParams();
  const path = usePathname();
  const router = useRouter();

  useEffect(() => {
    const message = sp.get("toast");
    if (!message) return;
    const type = sp.get("toastType") || "info";
    if (type === "success") toast.success(message);
    else if (type === "error") toast.error(message);
    else toast(message);
    // Strip the params from the URL without reloading.
    const next = new URLSearchParams(sp.toString());
    next.delete("toast");
    next.delete("toastType");
    const qs = next.toString();
    router.replace(`${path}${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [sp, path, router]);

  return null;
}
