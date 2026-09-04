import type { ReactNode } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ToastProvider } from "../components/Toast";
import { InstallationProvider } from "./installation";
import { PrefsProvider } from "./prefs";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
if (!convexUrl) {
  throw new Error(
    "VITE_CONVEX_URL não encontrada. Rode `npx convex dev` para iniciar o backend local.",
  );
}

const convex = new ConvexReactClient(convexUrl);

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ConvexProvider client={convex}>
      <ToastProvider>
        <InstallationProvider>
          <PrefsProvider>{children}</PrefsProvider>
        </InstallationProvider>
      </ToastProvider>
    </ConvexProvider>
  );
}
