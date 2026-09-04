/* Per-installation identity — created locally, used to separate data in
   Convex (no login). The id is a bearer capability: don't log it or put it
   in URLs. */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { INSTALLATION_KEY } from "../types/domain";

function generateId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    // fall through
  }
  return `fb-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function loadOrCreateInstallationId(): string {
  try {
    const existing = localStorage.getItem(INSTALLATION_KEY);
    if (existing && /^[A-Za-z0-9_-]{8,80}$/.test(existing)) return existing;
    const id = generateId();
    localStorage.setItem(INSTALLATION_KEY, id);
    return id;
  } catch {
    return generateId();
  }
}

/** Adopt an id from another device (Settings → usar em outro dispositivo). */
export function adoptInstallationId(id: string): boolean {
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(id)) return false;
  try {
    localStorage.setItem(INSTALLATION_KEY, id);
    return true;
  } catch {
    return false;
  }
}

const InstallationContext = createContext<string>("");

export function InstallationProvider({ children }: { children: ReactNode }) {
  const [id] = useState<string>(loadOrCreateInstallationId);
  const touch = useMutation(api.installations.touch);

  useEffect(() => {
    if (!id) return;
    touch({ installationId: id }).catch(() => {
      // offline/first-run is fine — the mutation retries on next load
    });
  }, [id, touch]);

  return <InstallationContext.Provider value={id}>{children}</InstallationContext.Provider>;
}

export function useInstallationId(): string {
  return useContext(InstallationContext);
}
