"use client";

import { useRouter } from "next/navigation";
import { Avatar } from "@heroui/avatar";
import { Button } from "@heroui/button";
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@heroui/dropdown";
import { motion } from "framer-motion";
import { BsChevronDown } from "react-icons/bs";

import { ThemeSwitch } from "@/components/theme-switch";
import { ViomarLogo } from "@/components/viomar-logo";
import { useSessionStore } from "@/store/session";
import type { HomeHeaderProps } from "@/app/home/types";
import { useHomeMessages } from "../hooks/useHomeMessages";

export function HomeHeader({
  isLoaded,
  currentLocale,
  isLocaleHydrated,
  onLocaleChange,
}: HomeHeaderProps) {
  const router = useRouter();
  const user = useSessionStore((s) => s.user);
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);
  const logout = useSessionStore((s) => s.clearSession);
  const homeMessages = useHomeMessages();

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <motion.header
      animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : -10 }}
      className="home-header"
      initial={{ opacity: 0, y: -10 }}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: "18px 28px",
        borderBottom: "1px solid #D8D4CC",
        gap: 12,
        flexWrap: "wrap",
      }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      <div
        className="home-brand"
        style={{ display: "flex", alignItems: "center", gap: 12 }}
      >
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
          {homeMessages.enterpriseSystemLabel}
        </span>
      </div>

      <div
        style={{
          marginLeft: "auto",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        {isAuthenticated ? (
          <Dropdown placement="bottom-end">
            <DropdownTrigger>
              <Button
                className="home-user-trigger h-auto px-2"
                variant="light"
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: 8 }}
                >
                  <Avatar
                    name={user?.name ?? "VIOMAR"}
                    size="sm"
                    src={user?.avatarUrl ?? undefined}
                  />
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
                  await handleLogout();
                }
              }}
            >
              <DropdownItem
                key="logout"
                className="text-danger"
                color="danger"
              >
                {homeMessages.logoutLabel}
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        ) : null}
        <Dropdown placement="bottom-end">
          <DropdownTrigger>
            <Button className="min-w-14" size="sm" variant="light">
              {isLocaleHydrated
                ? currentLocale === "es"
                  ? "ESP"
                  : "ENG"
                : "ENG"}
            </Button>
          </DropdownTrigger>
          <DropdownMenu
            aria-label="Language selector"
            onAction={(key) => onLocaleChange(String(key) as "en" | "es")}
          >
            <DropdownItem key="en">{homeMessages.languageEnglish}</DropdownItem>
            <DropdownItem key="es">{homeMessages.languageSpanish}</DropdownItem>
          </DropdownMenu>
        </Dropdown>
        <ThemeSwitch />
      </div>
    </motion.header>
  );
}
