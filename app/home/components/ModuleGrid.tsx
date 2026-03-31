"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import type { ModuleSection, ModuleGridProps } from "@/app/home/types";
import { ModulePanel } from "./ModulePanel";
import { useHomeMessages } from "../hooks/useHomeMessages";

export function ModuleGrid({
  sections,
  activeModule,
  isLoaded,
  onActiveModuleChange,
}: ModuleGridProps) {
  const router = useRouter();
  const homeMessages = useHomeMessages();

  const handleNavigateToModule = (route: string) => {
    router.push(route);
  };

  // Enrich sections with localized strings
  const enrichedSections = sections.map((section) => ({
    ...section,
    title: homeMessages.modules[section.id].title,
    fullTitle: homeMessages.modules[section.id].fullTitle,
    description: homeMessages.modules[section.id].description,
    accentWord: homeMessages.modules[section.id].accentWord,
    statLabel: homeMessages.modules[section.id].statLabel,
    statValue: homeMessages.modules[section.id].statValue,
  }));

  return (
    <>
      <motion.div
        animate={{ opacity: isLoaded ? 1 : 0 }}
        className="home-sub"
        initial={{ opacity: 0 }}
        style={{ padding: "18px 28px 10px" }}
        transition={{ duration: 0.16, delay: 0.06 }}
      >
        <span
          className="home-sub-text"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 700,
            fontSize: "0.65rem",
            letterSpacing: "0.4em",
            textTransform: "uppercase",
            color: "var(--viomar-primary)",
          }}
        >
          {homeMessages.selectModuleLabel}
        </span>
      </motion.div>

      <div
        className="selector-grid"
        style={{
          display: "flex",
          flex: 1,
          padding: "0 18px 18px",
          gap: 0,
          minHeight: 0,
        }}
      >
        {enrichedSections.map((section, idx) => (
          <ModulePanel
            key={section.id}
            index={idx}
            isActive={activeModule === section.id}
            onClick={() => handleNavigateToModule(section.route)}
            onHoverEnd={() => onActiveModuleChange("erp")}
            onHoverStart={() => onActiveModuleChange(section.id)}
            onTouchStart={() => onActiveModuleChange(section.id)}
            section={section}
            sectionCount={enrichedSections.length}
            enterButtonLabel={homeMessages.enterButtonLabel}
          />
        ))}
      </div>
    </>
  );
}
