export type ConnectivityStatus = "online" | "offline" | "reconnecting";

type Listener = (status: ConnectivityStatus) => void;

const listeners = new Set<Listener>();
let status: ConnectivityStatus =
  typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "online";

export function getConnectivityStatus() {
  return status;
}

export function isOfflineReadOnly() {
  return status !== "online";
}

export function setConnectivityStatus(next: ConnectivityStatus) {
  if (status === next) return;
  status = next;
  listeners.forEach((listener) => listener(status));
}

export function subscribeConnectivity(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
