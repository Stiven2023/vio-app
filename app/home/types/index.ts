/**
 * Home Module Type Definitions
 *
 * Centralized type exports for the home module.
 * This ensures single source of truth for module configuration types.
 */

export type ModuleSection = {
  id: "erp" | "mes" | "crm" | "hcm";
  title: string;
  fullTitle: string;
  description: string;
  route: string;
  accentWord: string;
  statValue: string;
  statLabel: string;
};

export type HomeHeaderProps = {
  isLoaded: boolean;
  currentLocale: "en" | "es";
  isLocaleHydrated: boolean;
  onLocaleChange: (locale: "en" | "es") => void;
};

export type HomeFooterProps = {
  isLoaded: boolean;
  footerYear: number;
  activeModule: ModuleSection["id"] | null;
  sections: ModuleSection[];
  currentTime: string;
};

export type ModuleGridProps = {
  sections: ModuleSection[];
  activeModule: ModuleSection["id"] | null;
  isLoaded: boolean;
  onActiveModuleChange: (moduleId: ModuleSection["id"]) => void;
};

export type ModulePanelProps = {
  section: ModuleSection;
  index: number;
  isActive: boolean;
  sectionCount: number;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onClick: () => void;
  onTouchStart: () => void;
  enterButtonLabel: string;
};
