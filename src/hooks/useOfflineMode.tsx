import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { rawSupabase, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/integrations/supabase/client";
import {
  getConnectivityStatus,
  setConnectivityStatus,
  subscribeConnectivity,
  type ConnectivityStatus,
} from "@/offline/connectivity";
import { getLatestSnapshot } from "@/offline/offlineDb";

type OfflineContextValue = {
  status: ConnectivityStatus;
  isOffline: boolean;
  canWrite: boolean;
  lastSynchronizedAt: string | null;
  refreshSnapshotMetadata: (userId: string, groupId?: string | null) => Promise<void>;
  checkConnection: () => Promise<boolean>;
};

const OfflineContext = createContext<OfflineContextValue | null>(null);
const HEALTH_TIMEOUT_MS = 5000;

async function probeBackend() {
  if (navigator.onLine === false) return false;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      method: "GET",
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
      cache: "no-store",
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState(getConnectivityStatus);
  const [lastSynchronizedAt, setLastSynchronizedAt] = useState<string | null>(null);

  useEffect(() => subscribeConnectivity(setStatus), []);

  useEffect(() => {
    if (status !== "online") void rawSupabase.removeAllChannels();
  }, [status]);

  const checkConnection = useCallback(async () => {
    if (navigator.onLine === false) {
      setConnectivityStatus("offline");
      return false;
    }
    if (getConnectivityStatus() !== "online") setConnectivityStatus("reconnecting");
    const reachable = await probeBackend();
    setConnectivityStatus(reachable ? "online" : "offline");
    return reachable;
  }, []);

  useEffect(() => {
    const onOffline = () => setConnectivityStatus("offline");
    const onOnline = () => void checkConnection();
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    if (navigator.onLine === false) onOffline();
    else void checkConnection();

    const interval = window.setInterval(() => {
      void checkConnection();
    }, 30000);

    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      window.clearInterval(interval);
    };
  }, [checkConnection]);

  const refreshSnapshotMetadata = useCallback(async (userId: string, groupId?: string | null) => {
    const metadata = await getLatestSnapshot(userId, groupId);
    setLastSynchronizedAt(metadata?.synchronizedAt ?? null);
  }, []);

  const value = useMemo<OfflineContextValue>(() => ({
    status,
    isOffline: status !== "online",
    canWrite: status === "online",
    lastSynchronizedAt,
    refreshSnapshotMetadata,
    checkConnection,
  }), [checkConnection, lastSynchronizedAt, refreshSnapshotMetadata, status]);

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOfflineMode() {
  const context = useContext(OfflineContext);
  if (!context) throw new Error("useOfflineMode precisa ser usado dentro de OfflineProvider.");
  return context;
}
