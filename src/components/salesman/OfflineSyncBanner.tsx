"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { submitFieldOrderAction } from "@/actions/salesman.actions";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { probeServerReachable, reportNetworkStatus } from "@/lib/network";
import {
  enqueueOfflineOrder,
  getQueuedOfflineOrders,
  removeQueuedOfflineOrder,
  type QueuedOfflineOrder,
} from "@/lib/offline-orders";

export function OfflineSyncBanner({
  onQueueChanged,
}: {
  onQueueChanged?: (orders: QueuedOfflineOrder[]) => void;
}) {
  const router = useRouter();
  const [queued, setQueued] = useState<QueuedOfflineOrder[]>([]);
  const [syncing, setSyncing] = useState(false);

  const loadQueue = useCallback(async () => {
    const rows = await getQueuedOfflineOrders();
    setQueued(rows);
    onQueueChanged?.(rows);
  }, [onQueueChanged]);

  const syncAll = useCallback(async () => {
    const reachable = await probeServerReachable();
    if (!reachable) return;
    const rows = await getQueuedOfflineOrders();
    if (rows.length === 0) return;

    setSyncing(true);
    let syncedCount = 0;

    for (const order of rows) {
      try {
        const res = await submitFieldOrderAction({
          clientRequestId: order.clientRequestId,
          customerId: order.customerId,
          notes: order.notes,
          items: order.items.map((l) => ({
            itemId: l.itemId,
            quantity: l.quantity,
            inputUnit: l.inputUnit,
          })),
        });
        if (res.ok) {
          await removeQueuedOfflineOrder(order.clientRequestId);
          syncedCount += 1;
        } else {
          await enqueueOfflineOrder({
            ...order,
            lastError: res.error ?? "Sync failed",
          });
        }
      } catch {
        // Network still unstable; keep queued & notify banner
        reportNetworkStatus(false);
      }
    }

    await loadQueue();
    setSyncing(false);
    if (syncedCount > 0) {
      toast.success(`Synced ${syncedCount} offline order(s) to factory.`);
      router.refresh();
    }
  }, [loadQueue, router]);

  useEffect(() => {
    loadQueue();
    const handleOnline = () => {
      void syncAll();
    };
    const handleNetworkCustom = (ev: Event) => {
      const detail = (ev as CustomEvent<{ online?: boolean }>).detail;
      if (detail?.online) void syncAll();
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("nittin-network-status", handleNetworkCustom);
    window.addEventListener("nittin-offline-queue-updated", loadQueue);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("nittin-network-status", handleNetworkCustom);
      window.removeEventListener("nittin-offline-queue-updated", loadQueue);
    };
  }, [loadQueue, syncAll]);

  if (queued.length === 0) return null;

  return (
    <div>
      <InlineAlert
        variant="warning"
        title={`${queued.length} Offline Order(s) Queued`}
      >
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <span>
              Saved locally with idempotent IDs. Will auto-sync when connected.
            </span>
            <button
              type="button"
              disabled={syncing}
              onClick={() => void syncAll()}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-[#B45309] px-3 text-xs font-semibold text-white hover:bg-[#92400E] disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync Now"}
            </button>
          </div>
        </InlineAlert>
    </div>
  );
}
