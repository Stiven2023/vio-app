"use client";

import { useEffect, useMemo, useState } from "react";
import type { ModuleSection } from "../types";

export function useModuleSelectorState() {
  const [activeModule, setActiveModule] = useState<ModuleSection["id"] | null>(
    "erp"
  );
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const [currentLocale, setCurrentLocale] = useState<"en" | "es">("en");
  const [isLocaleHydrated, setIsLocaleHydrated] = useState(false);

  useEffect(() => {
    const retrievedLocale = (() => {
      try {
        const localStorageValue = window.localStorage.getItem("preferredLanguage");

        if (localStorageValue === "en" || localStorageValue === "es") return localStorageValue;
        const cookieLocale = document.cookie
          .split("; ")
          .find((row) => row.startsWith("NEXT_LOCALE="))
          ?.split("=")[1];

        if (cookieLocale === "en" || cookieLocale === "es") return cookieLocale;
      } catch {
        // SSR guard
      }

      return "en" as const;
    })();

    setCurrentLocale(retrievedLocale);
    setIsLocaleHydrated(true);
  }, []);

  const handleLocaleChange = (nextLocale: "en" | "es") => {
    setCurrentLocale(nextLocale);
    try {
      document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = nextLocale;
      window.localStorage.setItem("preferredLanguage", nextLocale);
      window.sessionStorage.setItem("preferredLanguage", nextLocale);
      window.dispatchEvent(
        new CustomEvent("viomar:locale-change", { detail: nextLocale })
      );
    } catch {
      // SSR guard
    }
  };

  useEffect(() => {
    const initLoadTimer = setTimeout(() => setIsLoaded(true), 40);

    const updateTime = () =>
      setCurrentTime(
        new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );

    updateTime();
    const clockUpdateInterval = setInterval(updateTime, 30000);

    return () => {
      clearTimeout(initLoadTimer);
      clearInterval(clockUpdateInterval);
    };
  }, []);

  const footerYear = useMemo(() => new Date().getFullYear(), []);

  return {
    activeModule,
    setActiveModule,
    isLoaded,
    currentTime,
    currentLocale,
    isLocaleHydrated,
    handleLocaleChange,
    footerYear,
  };
}
