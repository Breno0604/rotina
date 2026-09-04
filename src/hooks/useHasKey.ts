import { useCallback, useEffect, useState } from "react";
import { keyStore } from "../services/keyStore";

export function useHasKey(): { has: boolean | null; refresh: () => void } {
  const [has, setHas] = useState<boolean | null>(null);

  const refresh = useCallback(() => {
    keyStore.has().then(setHas).catch(() => setHas(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { has, refresh };
}
