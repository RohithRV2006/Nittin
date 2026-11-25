import type { UnitType } from "@prisma/client";

export interface OfflineOrderLine {
  itemId: string;
  itemName: string;
  quantity: number;
  inputUnit: UnitType;
  unitPrice: string;
}

export interface QueuedOfflineOrder {
  clientRequestId: string;
  customerId: string;
  customerName: string;
  notes: string;
  items: OfflineOrderLine[];
  estimatedTotal: string;
  queuedAt: string;
  lastError?: string | null;
}

const DB_NAME = "nittin_erp_offline";
const DB_VERSION = 1;
const STORE_ORDERS = "offline_orders";
const LS_ORDERS_KEY = "nittin_offline_orders_v1";
const LS_CATALOG_KEY = "nittin_salesman_catalog_v1";

function openDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_ORDERS)) {
          db.createObjectStore(STORE_ORDERS, { keyPath: "clientRequestId" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function readLocalFallback(): QueuedOfflineOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LS_ORDERS_KEY);
    return raw ? (JSON.parse(raw) as QueuedOfflineOrder[]) : [];
  } catch {
    return [];
  }
}

function writeLocalFallback(list: QueuedOfflineOrder[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_ORDERS_KEY, JSON.stringify(list));
  } catch {
    // Ignore storage quota errors
  }
}

export async function getQueuedOfflineOrders(): Promise<QueuedOfflineOrder[]> {
  const db = await openDb();
  if (!db) return readLocalFallback();

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_ORDERS, "readonly");
      const store = tx.objectStore(STORE_ORDERS);
      const req = store.getAll();
      req.onsuccess = () => {
        db.close();
        const rows = (req.result as QueuedOfflineOrder[]) ?? [];
        rows.sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
        resolve(rows);
      };
      req.onerror = () => {
        db.close();
        resolve(readLocalFallback());
      };
    } catch {
      db.close();
      resolve(readLocalFallback());
    }
  });
}

export async function enqueueOfflineOrder(
  order: QueuedOfflineOrder
): Promise<void> {
  const db = await openDb();
  if (!db) {
    const list = readLocalFallback().filter(
      (o) => o.clientRequestId !== order.clientRequestId
    );
    list.push(order);
    writeLocalFallback(list);
    return;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_ORDERS, "readwrite");
      tx.objectStore(STORE_ORDERS).put(order);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        const list = readLocalFallback();
        list.push(order);
        writeLocalFallback(list);
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

export async function removeQueuedOfflineOrder(
  clientRequestId: string
): Promise<void> {
  const db = await openDb();
  if (!db) {
    writeLocalFallback(
      readLocalFallback().filter((o) => o.clientRequestId !== clientRequestId)
    );
    return;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_ORDERS, "readwrite");
      tx.objectStore(STORE_ORDERS).delete(clientRequestId);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

export function saveSalesmanCatalogCache<T>(payload: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_CATALOG_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadSalesmanCatalogCache<T>(): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LS_CATALOG_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
