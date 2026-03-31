"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ModuleLogo } from "@/components/module-logo";
import type { ModulePanelProps } from "@/app/home/types";
import { PRIMARY } from "../lib/homeStyles";

export function ModulePanel({
  section,
  index,
  isActive,
  sectionCount,
  onHoverStart,
  onHoverEnd,
  onClick,
  onTouchStart,
  enterButtonLabel,
}: ModulePanelProps) {
  const hasOtherActiveSection = !isActive;

  return (
    <motion.div
      animate={{
        flex: isActive ? 1.5 : hasOtherActiveSection ? 0.7 : 1,
      }}
      className={`panel${isActive ? " panel-active" : ""}`}
      onClick={onClick}
      onFocus={() => onHoverStart()}
      onHoverEnd={onHoverEnd}
      onHoverStart={onHoverStart}
      onTouchStart={onTouchStart}
      style={{
        borderRight:
          index < sectionCount - 1 ? "1px solid #D0CCC5" : "none",
        willChange: "transform, opacity",
      }}
      transition={{
        type: "spring",
        stiffness: 380,
        damping: 34,
        mass: 0.55,
      }}
    >
      <div className="active-bar" />
      <div className="panel-glow" />

      <div
        className="panel-inner"
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          padding: "18px 22px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "auto",
          }}
        >
          <span
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 700,
              fontSize: "0.7rem",
              letterSpacing: "0.12em",
              color: "#C0BCB5",
            }}
          >
            {String(index + 1).padStart(2, "0")}
          </span>
          <div
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <Image
              alt="Sticker Viomar"
              height={18}
              src="/STICKER VIOMAR.png"
              style={{
                width: 18,
                height: 18,
                opacity: isActive ? 0.9 : 0.35,
              }}
              width={18}
            />
            <span className="accent-tag">{section.accentWord}</span>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            maxHeight: 160,
            minHeight: 90,
            padding: "14px 0",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 148,
              height: 120,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ModuleLogo
              active={isActive}
              module={section.id}
              size={118}
            />
          </div>
        </div>

        <div style={{ marginTop: "auto" }}>
          <motion.div
            animate={{ y: isActive ? -2 : 0 }}
            transition={{ duration: 0.12 }}
          >
            <span className="module-title">{section.title}</span>
            <p
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 600,
                fontSize: "0.62rem",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "#6B6B6B",
                marginTop: 6,
              }}
            >
              {section.fullTitle}
            </p>
          </motion.div>

          <div
            style={{
              height: 1,
              background: "#D8D4CC",
              margin: "14px 0",
            }}
          />

          <p
            className="desc-text"
            style={{
              fontFamily: "'Barlow', sans-serif",
              fontSize: "0.82rem",
              lineHeight: 1.6,
              color: "#7D7A75",
            }}
          >
            {section.description}
          </p>

          <motion.div
            animate={{
              opacity: isActive ? 1 : 0,
              y: isActive ? 0 : 6,
              height: isActive ? "auto" : 0,
              marginTop: isActive ? 16 : 0,
            }}
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 10,
              overflow: "hidden",
            }}
            transition={{ duration: 0.14 }}
          >
            <div>
              <div
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 900,
                  fontSize: "1.7rem",
                  color: PRIMARY,
                  lineHeight: 1,
                }}
              >
                {section.statValue}
              </div>
              <div
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 600,
                  fontSize: "0.62rem",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "#6B6B6B",
                }}
              >
                {section.statLabel}
              </div>
            </div>
            <button
              className="viomar-btn"
              onClick={(event) => {
                event.stopPropagation();
                onClick();
              }}
            >
              {enterButtonLabel}
            </button>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
