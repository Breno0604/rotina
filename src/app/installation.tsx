/* Shared-space identity.
   The app has no login: every device uses ONE fixed scope id
   (SHARED_SPACE_ID), so all installations read and write the same data —
   what you register on one device appears on the others automatically. */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { SHARED_SPACE_ID } from "../types/domain";

export function loadOrCreateInstallationId(): string {
  return SHARED_SPACE_ID;
}

const InstallationContext = createContext<string>(SHARED_SPACE_ID);

export function InstallationProvider({ children }: { children: ReactNode }) {
  const [id] = useState<string>(SHARED_SPACE_ID);
  const touch = useMutation(api.installations.touch);

  useEffect(() => {
    touch({ installationId: id }).catch(() => {
      // offline/first-run is fine — the mutation retries on next load
    });
  }, [id, touch]);

  return <InstallationContext.Provider value={id}>{children}</InstallationContext.Provider>;
}

export function useInstallationId(): string {
  return useContext(InstallationContext);
}
