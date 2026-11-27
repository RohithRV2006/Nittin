"use client";

import { useEffect, useState } from "react";

const NETWORK_EVENT = "nittin-network-status";

export function reportNetworkStatus(online: boolean): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NETWORK_EVENT, { detail: { online } }));
}

/**
 * Actively probes the Next.js server without touching PostgreSQL so Chrome/Windows
 * virtual adapters or DevTools offline states are detected accurately.
 */
export async function probeServerReachable(): Promise<boolean> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    reportNetworkStatus(false);
    return false;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const res = await fetch(`/api/health?ping=1&_=${Date.now()}`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    const ok = res.ok;
    reportNetworkStatus(ok);
    return ok;
  } catch {
    reportNetworkStatus(false);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function useNetworkOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let active = true;

    const verify = async () => {
      const reachable = await probeServerReachable();
      if (active) setOnline(reachable);
    };

    const handleNativeOffline = () => {
      setOnline(false);
    };

    const handleNativeOnline = () => {
      void verify();
    };

    const handleCustom = (ev: Event) => {
      const detail = (ev as CustomEvent<{ online?: boolean }>).detail;
      if (typeof detail?.online === "boolean") {
        setOnline(detail.online);
      }
    };

    const handleFocusOrVisible = () => {
      if (document.visibilityState === "visible") {
        void verify();
      }
    };

    void verify();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void verify();
      }
    }, 15000);

    window.addEventListener("offline", handleNativeOffline);
    window.addEventListener("online", handleNativeOnline);
    window.addEventListener("focus", handleFocusOrVisible);
    document.addEventListener("visibilitychange", handleFocusOrVisible);
    window.addEventListener(NETWORK_EVENT, handleCustom);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("offline", handleNativeOffline);
      window.removeEventListener("online", handleNativeOnline);
      window.removeEventListener("focus", handleFocusOrVisible);
      document.removeEventListener("visibilitychange", handleFocusOrVisible);
      window.removeEventListener(NETWORK_EVENT, handleCustom);
    };
  }, []);

  return online;
}
