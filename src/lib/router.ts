/* Minimal hash router (no dependency). Supports the six top-level areas,
   the day detail route and deep linking. */

import { useEffect, useState } from "react";

export type RouteName =
  | "today"
  | "objectives"
  | "history"
  | "reports"
  | "memory"
  | "assistant"
  | "settings";

export interface Route {
  name: RouteName;
  /** for the day detail route: YYYY-MM-DD */
  dayKey?: string;
}

const ROUTE_PATH: Record<RouteName, string> = {
  today: "hoje",
  objectives: "objetivos",
  history: "historico",
  reports: "relatorios",
  memory: "contexto",
  assistant: "assistente",
  settings: "config",
};

export function routePath(name: RouteName): string {
  return `/${ROUTE_PATH[name]}`;
}

export function navigate(path: string): void {
  if (location.hash === `#${path}`) return;
  location.hash = path;
}

export function navigateRoute(route: Route): void {
  if (route.name === "today" && !route.dayKey) {
    navigate("/hoje");
    return;
  }
  navigate(`/dia/${route.dayKey}`);
}

function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, "").replace(/\/+$/, "");
  const parts = raw.split("/").filter(Boolean);

  if (parts.length === 0 || parts[0] === "hoje") return { name: "today" };

  if (parts[0] === "dia" && parts[1]) {
    return { name: "today", dayKey: parts[1] };
  }

  const match: Record<string, RouteName> = {
    objetivos: "objectives",
    historico: "history",
    relatorios: "reports",
    contexto: "memory",
    assistente: "assistant",
    config: "settings",
  };
  const name = match[parts[0]];
  if (name) return { name };
  return { name: "today" };
}

/** Current hash route, re-evaluated on hashchange. */
export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(location.hash));

  useEffect(() => {
    const onHashChange = () => {
      setRoute(parseHash(location.hash));
      // Move keyboard focus to the main region on route change.
      requestAnimationFrame(() => {
        const main = document.getElementById("main-region");
        if (main) {
          main.focus({ preventScroll: true });
        }
        window.scrollTo(0, 0);
      });
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return route;
}
