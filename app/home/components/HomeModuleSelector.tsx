"use client";

import { HomeHeader } from "@/app/home/components/HomeHeader";
import { HomeFooter } from "@/app/home/components/HomeFooter";
import { ModuleGrid } from "@/app/home/components/ModuleGrid";
import { useModuleSelectorState } from "@/app/home/hooks/useModuleSelectorState";
import { MODULE_SECTIONS } from "@/app/home/lib/homeConfig";
import { HOME_STYLES, PRIMARY, PRIMARY_DARK } from "@/app/home/lib/homeStyles";

export function HomeModuleSelector() {
  const {
    activeModule,
    setActiveModule,
    isLoaded,
    currentTime,
    currentLocale,
    isLocaleHydrated,
    handleLocaleChange,
    footerYear,
  } = useModuleSelectorState();

  return (
    <main
      className="home-main"
      style={{
        width: "100%",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        overflowX: "hidden",
        overflowY: "auto",
        position: "relative",
        background: "var(--viomar-bg)",
        fontFamily: "'Barlow Condensed', Arial, sans-serif",
      }}
    >
      <style>{HOME_STYLES}</style>

      <div className="noise-overlay" />

      <div
        style={{
          height: 3,
          background: `linear-gradient(90deg, ${PRIMARY}, ${PRIMARY_DARK} 55%, transparent)`,
        }}
      />

      <HomeHeader
        currentLocale={currentLocale}
        isLoaded={isLoaded}
        isLocaleHydrated={isLocaleHydrated}
        onLocaleChange={handleLocaleChange}
      />

      <ModuleGrid
        activeModule={activeModule}
        isLoaded={isLoaded}
        sections={MODULE_SECTIONS}
        onActiveModuleChange={setActiveModule}
      />

      <HomeFooter
        activeModule={activeModule}
        currentTime={currentTime}
        footerYear={footerYear}
        isLoaded={isLoaded}
        sections={MODULE_SECTIONS}
      />
    </main>
  );
}
