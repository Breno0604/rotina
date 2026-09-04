import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  PREFS_KEY,
  DEFAULT_GROQ_MODEL,
  DEFAULT_PALETTE,
  isPaletteId,
  type PaletteId,
} from "../types/domain";

export type ThemePref = "auto" | "light" | "dark";

export interface Prefs {
  theme: ThemePref;
  palette: PaletteId;
  model: string;
}

const DEFAULTS: Prefs = { theme: "auto", palette: DEFAULT_PALETTE, model: DEFAULT_GROQ_MODEL };

function isTheme(v: unknown): v is ThemePref {
  return v === "auto" || v === "light" || v === "dark";
}

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      theme: isTheme(parsed.theme) ? parsed.theme : DEFAULTS.theme,
      palette: isPaletteId(parsed.palette) ? parsed.palette : DEFAULTS.palette,
      model:
        typeof parsed.model === "string" && parsed.model.length > 0
          ? parsed.model
          : DEFAULTS.model,
    };
  } catch {
    return DEFAULTS;
  }
}

function persist(prefs: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // storage unavailable — prefs stay in memory
  }
}

interface PrefsContextValue {
  prefs: Prefs;
  setTheme: (theme: ThemePref) => void;
  setPalette: (palette: PaletteId) => void;
  setModel: (model: string) => void;
}

const PrefsContext = createContext<PrefsContextValue | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);

  // Apply theme + palette + keep theme-color in sync (initial value on mount).
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.palette = prefs.palette;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const resolved =
        prefs.theme === "auto" ? (mq.matches ? "dark" : "light") : prefs.theme;
      root.dataset.theme = resolved;
      const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", resolved === "dark" ? "#171310" : "#FFFBEB");
    };
    apply();
    if (prefs.theme === "auto") {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [prefs.theme, prefs.palette]);

  const value = useMemo<PrefsContextValue>(() => {
    const update = (patch: Partial<Prefs>) => {
      setPrefs((prev) => {
        const next = { ...prev, ...patch };
        persist(next);
        return next;
      });
    };
    return {
      prefs,
      setTheme: (theme) => update({ theme }),
      setPalette: (palette) => update({ palette }),
      setModel: (model) => update({ model }),
    };
  }, [prefs]);

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): PrefsContextValue {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs must be used inside PrefsProvider");
  return ctx;
}
