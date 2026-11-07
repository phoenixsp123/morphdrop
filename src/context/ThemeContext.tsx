import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ThemePreference } from "../types";

const THEME_KEY = "morphdrop_theme";

function getSystemTheme(): "light" | "dark" {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return "dark";
}

function loadPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
    const settingsRaw = localStorage.getItem("morphdrop_settings");
    if (settingsRaw) {
      const parsed = JSON.parse(settingsRaw);
      if (parsed?.theme === "light" || parsed?.theme === "dark" || parsed?.theme === "system") {
        return parsed.theme;
      }
    }
  } catch {
    // Ignore
  }
  return "system";
}

interface ThemeContextType {
  theme: "light" | "dark";
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preference, setPreferenceState] = useState<ThemePreference>(loadPreference);
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(getSystemTheme);

  const resolvedTheme: "light" | "dark" =
    preference === "system" ? systemTheme : preference;

  // Listen for OS system theme changes
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? "dark" : "light");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Synchronously update DOM classes and style
  useEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
      root.style.colorScheme = "dark";
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
      root.style.colorScheme = "light";
    }
  }, [resolvedTheme]);

  const setPreference = useCallback((pref: ThemePreference) => {
    setPreferenceState(pref);
    try {
      localStorage.setItem(THEME_KEY, pref);
      const settingsRaw = localStorage.getItem("morphdrop_settings");
      if (settingsRaw) {
        const parsed = JSON.parse(settingsRaw);
        parsed.theme = pref;
        localStorage.setItem("morphdrop_settings", JSON.stringify(parsed));
      }
    } catch {
      // Ignore
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setPreference(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setPreference]);

  return (
    <ThemeContext.Provider value={{ theme: resolvedTheme, preference, setPreference, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
