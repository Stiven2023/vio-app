"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Avatar } from "@heroui/avatar";
import { Button } from "@heroui/button";
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@heroui/dropdown";
import { BsChevronDown } from "react-icons/bs";

import { ThemeSwitch } from "@/components/theme-switch";
import { ModuleLogo } from "@/components/module-logo";
import { ViomarLogo } from "@/components/viomar-logo";
import { useSessionStore } from "@/store/session";

const PRIMARY = "var(--viomar-primary)";
const PRIMARY_DARK = "var(--viomar-primary-dark)";
const FG = "var(--viomar-fg)";

type Section = {
  id: "erp" | "mes" | "crm";
  title: string;
  fullTitle: string;
  description: string;
  route: string;
  accentWord: string;
  stat: string;
  statLabel: string;
};

const sections: Section[] = [
  {
    id: "erp",
    title: "ERP",
    fullTitle: "Enterprise Resource Planning",
    description:
      "Accounting, inventory, and enterprise operations in one unified system.",
    route: "/erp/dashboard",
    accentWord: "MANAGEMENT",
    stat: "360°",
    statLabel: "Total visibility",
  },
  {
    id: "mes",
    title: "MES",
    fullTitle: "Manufacturing Execution System",
    description:
      "Production control, industrial efficiency, and real-time plant monitoring.",
    route: "/mes",
    accentWord: "PRODUCTION",
    stat: "40%",
    statLabel: "More efficiency",
  },
  {
    id: "crm",
    title: "CRM",
    fullTitle: "Customer Relationship Management",
    description:
      "Clients, sales, commercial opportunities, and a fully integrated pipeline.",
    route: "/crm",
    accentWord: "CLIENTS",
    stat: "3x",
    statLabel: "Conversion",
  },
];

export function HomeModuleSelector() {
  const router = useRouter();
  const user = useSessionStore((s) => s.user);
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);
  const logout = useSessionStore((s) => s.clearSession);
  const [active, setActive] = useState<Section["id"] | null>("erp");
  const [loaded, setLoaded] = useState(false);
  const [time, setTime] = useState("");

  useEffect(() => {
    const loadTimer = setTimeout(() => setLoaded(true), 40);

    const tick = () =>
      setTime(
        new Date().toLocaleTimeString("es-CO", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );

    tick();
    const clockTimer = setInterval(tick, 30000);

    return () => {
      clearTimeout(loadTimer);
      clearInterval(clockTimer);
    };
  }, []);

  const footerYear = useMemo(() => new Date().getFullYear(), []);

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
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@300;400;600;700;800;900&family=Barlow:wght@300;400;500;600&display=swap');

        .viomar-btn {
          font-family: 'Barlow Condensed', sans-serif;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          font-size: 0.8rem;
          padding: 10px 22px;
          background: ${PRIMARY};
          color: #fff;
          border: none;
          cursor: pointer;
          transition: background 0.14s, transform 0.12s;
        }

        .viomar-btn:hover { background: ${PRIMARY_DARK}; transform: scale(1.01); }
        .viomar-btn:active { transform: scale(0.97); }

        .module-title {
          font-family: 'Barlow Condensed', sans-serif;
          font-weight: 900;
          line-height: 0.9;
          letter-spacing: -0.01em;
          color: ${FG};
          font-size: clamp(2.2rem, 4vw, 4rem);
          position: relative;
          display: inline-block;
        }

        .module-title::after {
          content: '';
          position: absolute;
          bottom: 2px;
          left: 0;
          height: 3px;
          width: 0;
          background: ${PRIMARY};
          transition: width 0.2s ease;
        }

        .panel-active .module-title::after { width: 100%; }

        .panel {
          position: relative;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          cursor: pointer;
          transition: flex 0.24s cubic-bezier(0.3, 0.8, 0.2, 1);
          min-height: 220px;
        }

        .active-bar {
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 3px;
          background: ${PRIMARY};
          transform: scaleY(0);
          transform-origin: top;
          transition: transform 0.18s ease;
        }

        .panel-active .active-bar { transform: scaleY(1); }

        .accent-tag {
          opacity: 0;
          transform: translateX(8px);
          transition: opacity 0.16s, transform 0.16s;
          font-family: 'Barlow Condensed', sans-serif;
          font-weight: 700;
          font-size: 0.65rem;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: ${PRIMARY};
        }

        .panel-active .accent-tag { opacity: 1; transform: translateX(0); }

        .desc-text { transition: opacity 0.16s; opacity: 0.56; }
        .panel-active .desc-text { opacity: 1; }

        .noise-overlay {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.02;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size: 200px 200px;
        }

        .panel-glow {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.16s;
          background: linear-gradient(135deg, color-mix(in srgb, var(--viomar-primary) 11%, transparent) 0%, transparent 55%);
        }

        .panel-active .panel-glow { opacity: 1; }

        .home-main {
          -webkit-overflow-scrolling: touch;
        }

        @media (max-width: 1024px) {
          .selector-grid {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px !important;
            padding: 0 16px 16px !important;
          }

          .selector-grid .panel {
            border-right: none !important;
            border: 1px solid #D0CCC5 !important;
            border-radius: 14px;
            min-height: 240px;
          }

          .selector-grid .panel:nth-child(3) {
            grid-column: 1 / -1;
          }

          .selector-grid .panel .active-bar {
            display: none;
          }
        }

        @media (max-width: 640px) {
          .home-header {
            padding: 14px 16px !important;
          }

          .home-brand {
            gap: 8px !important;
          }

          .home-user-name {
            display: inline;
          }

          .home-logo {
            height: 24px !important;
          }

          .home-user-name {
            display: none !important;
          }

          .home-user-trigger {
            padding: 0 !important;
          }

          .home-system-label {
            font-size: 0.58rem !important;
            letter-spacing: 0.14em !important;
          }

          .home-sub {
            padding: 12px 16px 8px !important;
          }

          .home-sub-text {
            font-size: 0.6rem !important;
            letter-spacing: 0.24em !important;
          }

          .selector-grid {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
            padding: 0 12px 12px !important;
          }

          .selector-grid .panel {
            min-height: 210px;
          }

          .panel-inner {
            padding: 14px 14px !important;
          }

          .home-footer {
            padding: 10px 12px !important;
            justify-content: center !important;
            gap: 8px !important;
          }

          .footer-modules {
            display: none !important;
          }

          .footer-legal {
            order: 2;
            width: 100%;
            text-align: center;
          }

          .footer-right {
            order: 1;
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>

      <div className="noise-overlay" />

      <div style={{ height: 3, background: `linear-gradient(90deg, ${PRIMARY}, ${PRIMARY_DARK} 55%, transparent)` }} />

      <motion.header
        className="home-header"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: loaded ? 1 : 0, y: loaded ? 0 : -10 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          padding: "18px 28px",
          borderBottom: "1px solid #D8D4CC",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div className="home-brand" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <ViomarLogo className="home-logo" height={30} />
          <div style={{ width: 1, height: 22, background: "#C8C4BC" }} />
          <span
            className="home-system-label"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 700,
              fontSize: "0.7rem",
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              color: "#6B6B6B",
            }}
          >
            Enterprise System
          </span>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {isAuthenticated ? (
            <Dropdown placement="bottom-end">
              <DropdownTrigger>
                <Button className="home-user-trigger h-auto px-2" variant="light">
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Avatar name={user?.name ?? "VIOMAR"} size="sm" src={user?.avatarUrl ?? undefined} />
                    <span
                      className="home-user-name"
                      style={{
                        fontFamily: "'Barlow', sans-serif",
                        fontSize: "0.75rem",
                        color: "#3E3E3E",
                        maxWidth: 140,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {user?.name ?? "User"}
                    </span>
                    <BsChevronDown className="text-xs text-default-500" />
                  </div>
                </Button>
              </DropdownTrigger>
              <DropdownMenu
                aria-label="Home user actions"
                onAction={async (key) => {
                  if (String(key) === "logout") {
                    await logout();
                    router.push("/login");
                  }
                }}
              >
                <DropdownItem key="logout" className="text-danger" color="danger">
                  Log out
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          ) : null}
          <ThemeSwitch />
        </div>
      </motion.header>

      <motion.div
        className="home-sub"
        initial={{ opacity: 0 }}
        animate={{ opacity: loaded ? 1 : 0 }}
        transition={{ duration: 0.16, delay: 0.06 }}
        style={{ padding: "18px 28px 10px" }}
      >
        <span
          className="home-sub-text"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 700,
            fontSize: "0.65rem",
            letterSpacing: "0.4em",
            textTransform: "uppercase",
            color: PRIMARY,
          }}
        >
          ▸ Select your module
        </span>
      </motion.div>

      <div className="selector-grid" style={{ display: "flex", flex: 1, padding: "0 18px 18px", gap: 0, minHeight: 0 }}>
        {sections.map((section, idx) => {
          const isActive = active === section.id;
          const isOther = active && !isActive;

          return (
            <motion.div
              key={section.id}
              onHoverStart={() => setActive(section.id)}
              onHoverEnd={() => setActive("erp")}
              onTouchStart={() => setActive(section.id)}
              onFocus={() => setActive(section.id)}
              onClick={() => router.push(section.route)}
              animate={{ flex: isActive ? 1.5 : isOther ? 0.7 : 1 }}
              transition={{ type: "spring", stiffness: 380, damping: 34, mass: 0.55 }}
              className={`panel${isActive ? " panel-active" : ""}`}
              style={{
                borderRight: idx < sections.length - 1 ? "1px solid #D0CCC5" : "none",
                willChange: "transform, opacity",
              }}
            >
              <div className="active-bar" />
              <div className="panel-glow" />

              <div className="panel-inner" style={{ display: "flex", flexDirection: "column", height: "100%", padding: "18px 22px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "auto" }}>
                  <span
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontWeight: 700,
                      fontSize: "0.7rem",
                      letterSpacing: "0.12em",
                      color: "#C0BCB5",
                    }}
                  >
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Image alt="Sticker Viomar" height={18} src="/STICKER VIOMAR.png" width={18} style={{ width: 18, height: 18, opacity: isActive ? 0.9 : 0.35 }} />
                    <span className="accent-tag">{section.accentWord}</span>
                  </div>
                </div>

                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", maxHeight: 160, minHeight: 90, padding: "14px 0" }}>
                  <div style={{ width: "100%", maxWidth: 148, height: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ModuleLogo active={isActive} module={section.id} size={118} />
                  </div>
                </div>

                <div style={{ marginTop: "auto" }}>
                  <motion.div animate={{ y: isActive ? -2 : 0 }} transition={{ duration: 0.12 }}>
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

                  <div style={{ height: 1, background: "#D8D4CC", margin: "14px 0" }} />

                  <p className="desc-text" style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.82rem", lineHeight: 1.6, color: "#7D7A75" }}>
                    {section.description}
                  </p>

                  <motion.div
                    animate={{
                      opacity: isActive ? 1 : 0,
                      y: isActive ? 0 : 6,
                      height: isActive ? "auto" : 0,
                      marginTop: isActive ? 16 : 0,
                    }}
                    transition={{ duration: 0.14 }}
                    style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10, overflow: "hidden" }}
                  >
                    <div>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: "1.7rem", color: PRIMARY, lineHeight: 1 }}>
                        {section.stat}
                      </div>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, fontSize: "0.62rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "#6B6B6B" }}>
                        {section.statLabel}
                      </div>
                    </div>
                    <button
                      className="viomar-btn"
                      onClick={(event) => {
                        event.stopPropagation();
                        router.push(section.route);
                      }}
                    >
                      Entrar
                    </button>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <motion.footer
        className="home-footer"
        initial={{ opacity: 0 }}
        animate={{ opacity: loaded ? 1 : 0 }}
        transition={{ delay: 0.18, duration: 0.16 }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 28px",
          borderTop: "1px solid #D8D4CC",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div className="footer-modules" style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {sections.map((section) => (
            <div key={`footer-${section.id}`} style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: active === section.id ? PRIMARY : "#C8C4BC",
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
                  color: active === section.id ? "#1A1A1A" : "#C0BCB4",
                  transition: "color 0.2s",
                }}
              >
                {section.title}
              </span>
            </div>
          ))}
        </div>

        <span className="footer-legal" style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.72rem", color: "#8D8982" }}>
          © {footerYear} Viomar App. Todos los derechos reservados.
        </span>

        <div className="footer-right" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, fontSize: "0.65rem", letterSpacing: "0.2em", color: "#A3A098" }}>
            {time} COL
          </span>
        </div>
      </motion.footer>
    </main>
  );
}
