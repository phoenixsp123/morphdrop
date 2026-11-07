import { useState, useCallback, useEffect } from "react";
import type { HistoryEntry } from "../types";
import { getHistory, clearHistory as clearHistoryCmd } from "../lib/tauri";

interface UseHistoryReturn {
  entries: HistoryEntry[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  clearHistory: () => Promise<void>;
}

export function useHistory(): UseHistoryReturn {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const history = await getHistory();
      setEntries(history);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearAll = useCallback(async () => {
    try {
      await clearHistoryCmd();
      setEntries([]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { entries, isLoading, error, refresh, clearHistory: clearAll };
}
