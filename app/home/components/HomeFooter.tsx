"use client";

import { motion } from "framer-motion";
import type { ModuleSection, HomeFooterProps } from "@/app/home/types";
import { PRIMARY } from "../lib/homeStyles";
import { useHomeMessages } from "../hooks/useHomeMessages";

export function HomeFooter({
  isLoaded,
  footerYear,
  activeModule,
  sections,
  currentTime,
}: HomeFooterProps) {
  const homeMessages = useHomeMessages();

  const copyrightText = homeMessages.copyrightText.replace("{year}", String(footerYear));

  return (
    <motion.footer
      animate={{ opacity: isLoaded ? 1 : 0 }}
      className="home-footer"
      initial={{ opacity: 0 }}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 28px",
        borderTop: "1px solid #D8D4CC",
        gap: 12,
        flexWrap: "wrap",
      }}
      transition={{ delay: 0.18, duration: 0.16 }}
    >
      <div
        className="footer-modules"
        style={{ display: "flex", alignItems: "center", gap: 18 }}
      >
        {sections.map((section) => (
          <div
            key={`footer-${section.id}`}
            style={{ display: "flex", alignItems: "center", gap: 7 }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background:
                  activeModule === section.id ? PRIMARY : "#C8C4BC",
                transition: "background 0.2s",
              }}
            />
            <span
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 700,
                fontSize: "0.65rem",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color:
                  activeModule === section.id ? "#1A1A1A" : "#C0BCB4",
                transition: "color 0.2s",
              }}
            >
              {section.title}
            </span>
          </div>
        ))}
      </div>

      <span
        className="footer-legal"
        style={{
          fontFamily: "'Barlow', sans-serif",
          fontSize: "0.72rem",
          color: "#8D8982",
        }}
      >
        {copyrightText}
      </span>

      <div
        className="footer-right"
        style={{ display: "flex", alignItems: "center", gap: 12 }}
      >
        <span
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 600,
            fontSize: "0.65rem",
            letterSpacing: "0.2em",
            color: "#A3A098",
          }}
        >
          {currentTime} {homeMessages.timeZone}
        </span>
      </div>
    </motion.footer>
  );
}
