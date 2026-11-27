"use client";

import { useEffect, useState } from "react";

const NETWORK_EVENT = "nittin-network-status";
const MIN_PROBE_GAP_MS = 10_000;

let sharedOnline = true;
let inflightProbe: Promise<boolean> | null = null;
let lastProbeAt = 0;
let listenerCount = 0;
let offlineRetryTimer: ReturnType<typeof setTimeout> | null = null;
let offlineBackoffMs = 15_000;

function clearOfflineRetry() {
  if (offlineRetryTimer) {
    clearTimeout(offlineRetryTimer);
    offlineRetryTimer = null;
  }
}

function scheduleOfflineRecoveryProbe() {
  if (typeof window === "undefined" || sharedOnline || offlineRetryTimer) return;
  offlineRetryTimer = setTimeout(() => {
    offlineRetryTimer = null;
    if (document.visibilityState === "visible" && !sharedOnline) {
      void probeServerReachable(true).then((ok) => {
        if (!ok) {
          offlineBackoffMs = Math.min(offlineBackoffMs * 2, 60_000);
          scheduleOfflineRecoveryProbe();
        }
      });
    }
  }, offlineBackoffMs);
}

export function reportNetworkStatus(online: boolean): void {
  if (typeof window === "undefined") return;
  const changed = sharedOnline !== online;
  sharedOnline = online;

  if (online) {
    offlineBackoffMs = 15_000;
    clearOfflineRetry();
  } else {
    scheduleOfflineRecoveryProbe();
  }

  if (changed) {
    window.dispatchEvent(new CustomEvent(NETWORK_EVENT, { detail: { online } }));
  }
}

/**
 * Deduplicated zero-body HEAD probe (`/api/health?ping=1`).
 * Never runs on a background timer while online — only on reconnect, offline recovery, or demand.
 */
export async function probeServerReachable(force = false): Promise<boolean> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    reportNetworkStatus(false);
    return false;
  }

  if (inflightProbe) return inflightProbe;
  const now = Date.now();
  if (!force && sharedOnline && now - lastProbeAt < MIN_PROBE_GAP_MS) {
    return sharedOnline;
  }

  lastProbeAt = now;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);

  inflightProbe = (async () => {
    try {
      const res = await fetch("/api/health?ping=1", {
        method: "HEAD",
        cache: "no-store",
        signal: controller.signal,
      });
      reportNetworkStatus(res.ok);
      return res.ok;
    } catch {
      reportNetworkStatus(false);
      return false;
    } finally {
      clearTimeout(timer);
      inflightProbe = null;
    }
  })();

  return inflightProbe;
}

/**
 * Shared singleton network status hook:
 * - Zero periodic polling while online (uses native browser events + real request failure reporting)
 * - Gentle exponential backoff HEAD probe only while offline to auto-detect reconnection
 */
export function useNetworkOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let active = true;

    const handleOffline = () => reportNetworkStatus(false);
    const handleOnline = () => {
      void probeServerReachable(true);
    };
    const handleFocus = () => {
      // Only probe on focus if currently offline or navigator disagrees
      if (!sharedOnline || (typeof navigator !== "undefined" && !navigator.onLine)) {
        void probeServerReachable(true);
      }
    };
    const handleCustom = (ev: Event) => {
      const detail = (ev as CustomEvent<{ online?: boolean }>).detail;
      if (active && typeof detail?.online === "boolean") {
        setOnline(detail.online);
      }
    };

    if (listenerCount === 0) {
      window.addEventListener("offline", handleOffline);
      window.addEventListener("online", handleOnline);
      window.addEventListener("focus", handleFocus);
      // One lightweight initial check if navigator reports offline
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        reportNetworkStatus(false);
      }
    }
    listenerCount += 1;
    window.addEventListener(NETWORK_EVENT, handleCustom);
    setOnline(typeof navigator !== "undefined" ? navigator.onLine && sharedOnline : sharedOnline);

    return () => {
      active = false;
      listenerCount = Math.max(0, listenerCount - 1);
      window.removeEventListener(NETWORK_EVENT, handleCustom);
      if (listenerCount === 0) {
        window.removeEventListener("offline", handleOffline);
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("focus", handleFocus);
        clearOfflineRetry();
      }
    };
  }, []);

  return online;
}
