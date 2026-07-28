const DB_NAME = "zelo-offline";
const DB_VERSION = 1;
const ROWS_STORE = "rows";
const SNAPSHOTS_STORE = "snapshots";
const IDENTITY_KEY = "zelo_offline_identity";
const USER_KEY = "zelo_offline_user";
const ACTIVE_GROUP_CACHE_KEY = "zelo_active_group_cache";

export type OfflineRow = {
  key: string;
  userId: string;
  groupId: string;
  table: string;
  rowId: string;
  value: Record<string, unknown>;
};

export type OfflineSnapshotMetadata = {
  key: string;
  userId: string;
  groupId: string;
  schemaVersion: number;
  synchronizedAt: string;
};

export type OfflineSnapshotPayload = {
  schema_version?: number;
  synchronized_at?: string;
  group_id?: string;
  tables?: Record<string, unknown[]>;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ROWS_STORE)) {
        const rows = db.createObjectStore(ROWS_STORE, { keyPath: "key" });
        rows.createIndex("by_user_table", ["userId", "table"], { unique: false });
        rows.createIndex("by_user_group", ["userId", "groupId"], { unique: false });
      }
      if (!db.objectStoreNames.contains(SNAPSHOTS_STORE)) {
        db.createObjectStore(SNAPSHOTS_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error("Transação offline cancelada."));
  });
}

function rowIdentifier(row: Record<string, unknown>, fallback: number) {
  const candidate = row.id ?? row.user_id ?? row.group_id;
  return typeof candidate === "string" || typeof candidate === "number"
    ? String(candidate)
    : String(fallback);
}

export function setOfflineIdentity(userId: string | null) {
  if (typeof localStorage === "undefined") return;
  if (userId) localStorage.setItem(IDENTITY_KEY, userId);
  else localStorage.removeItem(IDENTITY_KEY);
}

export function getOfflineIdentity() {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(IDENTITY_KEY);
}

export type CachedOfflineUser = {
  id: string;
  email?: string;
  aud: string;
  created_at: string;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
};

export function setCachedOfflineUser(user: CachedOfflineUser | null) {
  if (typeof localStorage === "undefined") return;
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

export function getCachedOfflineUser(): CachedOfflineUser | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const user = JSON.parse(localStorage.getItem(USER_KEY) ?? "null") as CachedOfflineUser | null;
    return user?.id ? user : null;
  } catch {
    return null;
  }
}

function getCachedActiveGroupId(userId: string) {
  if (typeof localStorage === "undefined") return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(ACTIVE_GROUP_CACHE_KEY) ?? "null") as {
      userId?: string;
      group?: { id?: string };
    } | null;
    return parsed?.userId === userId ? parsed.group?.id ?? null : null;
  } catch {
    return null;
  }
}

export async function saveSnapshot(
  userId: string,
  groupId: string,
  payload: OfflineSnapshotPayload,
) {
  const db = await openDb();
  const transaction = db.transaction([ROWS_STORE, SNAPSHOTS_STORE], "readwrite");
  const rowsStore = transaction.objectStore(ROWS_STORE);
  const snapshotsStore = transaction.objectStore(SNAPSHOTS_STORE);
  const existingKeys = await requestResult(
    rowsStore.index("by_user_group").getAllKeys(IDBKeyRange.only([userId, groupId])),
  );

  existingKeys.forEach((key) => rowsStore.delete(key));

  Object.entries(payload.tables ?? {}).forEach(([table, tableRows]) => {
    (Array.isArray(tableRows) ? tableRows : []).forEach((rawRow, index) => {
      if (!rawRow || typeof rawRow !== "object") return;
      const row = rawRow as Record<string, unknown>;
      const rowId = rowIdentifier(row, index);
      rowsStore.put({
        key: `${userId}:${groupId}:${table}:${rowId}`,
        userId,
        groupId,
        table,
        rowId,
        value: row,
      } satisfies OfflineRow);
    });
  });

  const synchronizedAt = payload.synchronized_at ?? new Date().toISOString();
  snapshotsStore.put({
    key: `${userId}:${groupId}`,
    userId,
    groupId,
    schemaVersion: payload.schema_version ?? 1,
    synchronizedAt,
  } satisfies OfflineSnapshotMetadata);

  await transactionDone(transaction);
  db.close();
  setOfflineIdentity(userId);
}

export async function readTable(userId: string, table: string) {
  const db = await openDb();
  const transaction = db.transaction(ROWS_STORE, "readonly");
  const activeGroupId = getCachedActiveGroupId(userId);
  const records = activeGroupId
    ? await requestResult(
        transaction.objectStore(ROWS_STORE).index("by_user_group").getAll(
          IDBKeyRange.only([userId, activeGroupId]),
        ),
      ) as OfflineRow[]
    : await requestResult(
        transaction.objectStore(ROWS_STORE).index("by_user_table").getAll(
          IDBKeyRange.only([userId, table]),
        ),
      ) as OfflineRow[];
  await transactionDone(transaction);
  db.close();
  return records.filter((record) => record.table === table).map((record) => record.value);
}

export async function readGroupTable(userId: string, groupId: string, table: string) {
  const db = await openDb();
  const transaction = db.transaction(ROWS_STORE, "readonly");
  const records = await requestResult(
    transaction.objectStore(ROWS_STORE).index("by_user_group").getAll(
      IDBKeyRange.only([userId, groupId]),
    ),
  ) as OfflineRow[];
  await transactionDone(transaction);
  db.close();
  return records.filter((record) => record.table === table).map((record) => record.value);
}

export async function getLatestSnapshot(userId: string, groupId?: string | null) {
  const db = await openDb();
  const transaction = db.transaction(SNAPSHOTS_STORE, "readonly");
  const records = await requestResult(
    transaction.objectStore(SNAPSHOTS_STORE).getAll(),
  ) as OfflineSnapshotMetadata[];
  await transactionDone(transaction);
  db.close();

  return records
    .filter((record) => record.userId === userId && (!groupId || record.groupId === groupId))
    .sort((a, b) => b.synchronizedAt.localeCompare(a.synchronizedAt))[0] ?? null;
}

export async function clearOfflineData(userId?: string | null) {
  const db = await openDb();
  if (!userId) {
    const transaction = db.transaction([ROWS_STORE, SNAPSHOTS_STORE], "readwrite");
    transaction.objectStore(ROWS_STORE).clear();
    transaction.objectStore(SNAPSHOTS_STORE).clear();
    await transactionDone(transaction);
    db.close();
    setOfflineIdentity(null);
    setCachedOfflineUser(null);
    if ("caches" in window) await caches.delete("zelo-offline-media-v1");
    return;
  }

  const transaction = db.transaction([ROWS_STORE, SNAPSHOTS_STORE], "readwrite");
  const rows = transaction.objectStore(ROWS_STORE);
  const snapshots = transaction.objectStore(SNAPSHOTS_STORE);
  const rowKeys = await requestResult(
    rows.index("by_user_group").getAllKeys(
      IDBKeyRange.bound([userId, ""], [userId, "\uffff"]),
    ),
  );
  rowKeys.forEach((key) => rows.delete(key));
  const snapshotRecords = await requestResult(snapshots.getAll()) as OfflineSnapshotMetadata[];
  snapshotRecords.filter((item) => item.userId === userId).forEach((item) => snapshots.delete(item.key));
  await transactionDone(transaction);
  db.close();
  if (getOfflineIdentity() === userId) setOfflineIdentity(null);
  if (getCachedOfflineUser()?.id === userId) setCachedOfflineUser(null);
  if ("caches" in window) await caches.delete("zelo-offline-media-v1");
}
