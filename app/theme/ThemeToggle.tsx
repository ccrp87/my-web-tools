"use client";

import { useEffect, useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY } from "./theme-script";

type ThemePreference = "light" | "dark" | "system";

interface ThemeOption {
  value: ThemePreference;
  label: string;
}

const OPTIONS: readonly ThemeOption[] = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
  { value: "system", label: "Sistema" },
];

const PREFERENCE_CHANGE_EVENT = "theme-preference-change";

function prefersDarkSystemTheme(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyResolvedTheme(preference: ThemePreference): void {
  const isDark =
    preference === "dark" ||
    (preference === "system" && prefersDarkSystemTheme());
  document.documentElement.classList.toggle("dark", isDark);
}

function readStoredPreference(): ThemePreference {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system"
    ? stored
    : "system";
}

/** Reacciona a cambios propios (evento local) y a cambios desde otras pestañas (storage). */
function subscribeToPreferenceChanges(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(PREFERENCE_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(PREFERENCE_CHANGE_EVENT, onStoreChange);
  };
}

function getServerPreferenceSnapshot(): ThemePreference {
  return "system";
}

export function ThemeToggle(): React.JSX.Element {
  const preference = useSyncExternalStore(
    subscribeToPreferenceChanges,
    readStoredPreference,
    getServerPreferenceSnapshot,
  );

  useEffect(() => {
    applyResolvedTheme(preference);
    if (preference !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = (): void => applyResolvedTheme("system");
    media.addEventListener("change", handleSystemChange);
    return () => media.removeEventListener("change", handleSystemChange);
  }, [preference]);

  const handleSelect = (value: ThemePreference): void => {
    window.localStorage.setItem(THEME_STORAGE_KEY, value);
    window.dispatchEvent(new Event(PREFERENCE_CHANGE_EVENT));
  };

  return (
    <div
      role="group"
      aria-label="Tema visual"
      className="fixed top-4 right-4 z-50 flex overflow-hidden rounded-full border border-black/[.08] bg-background/90 backdrop-blur-sm dark:border-white/[.145]"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={preference === option.value}
          onClick={() => handleSelect(option.value)}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
            preference === option.value
              ? "bg-foreground text-background"
              : "text-zinc-600 hover:bg-black/[.04] dark:text-zinc-400 dark:hover:bg-white/[.08]"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
