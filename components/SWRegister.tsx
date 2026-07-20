"use client";

import { useEffect } from "react";

export default function SWRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // Clear the Home Screen icon badge whenever the app is in the foreground.
    const clearBadge = () => {
      if (
        typeof navigator !== "undefined" &&
        "clearAppBadge" in navigator &&
        document.visibilityState === "visible"
      ) {
        (navigator as Navigator & { clearAppBadge?: () => Promise<void> })
          .clearAppBadge?.()
          .catch(() => {});
      }
    };
    clearBadge();
    document.addEventListener("visibilitychange", clearBadge);
    return () => document.removeEventListener("visibilitychange", clearBadge);
  }, []);
  return null;
}
