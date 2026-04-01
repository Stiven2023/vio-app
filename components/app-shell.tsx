"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { AppFooter } from "@/components/app-footer";
import { Navbar } from "@/components/navbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isModuleShell =
    pathname.startsWith("/mes") ||
    pathname.startsWith("/crm") ||
    pathname.startsWith("/hcm");
  const isLocalizedHome = pathname === "/es" || pathname === "/en";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get("legacy_hcm") !== "1") return;

    params.delete("legacy_hcm");

    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;

    window.history.replaceState(window.history.state, "", nextUrl);
  }, [pathname]);

  if (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/erp/login" ||
    pathname === "/home" ||
    isLocalizedHome
  ) {
    return <>{children}</>;
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden">
      <Navbar />
      <main
        className={
          isModuleShell
            ? "w-full flex-grow overflow-x-hidden pt-16"
            : "container mx-auto max-w-7xl flex-grow overflow-x-hidden px-6 pt-16"
        }
      >
        {children}
      </main>
      <AppFooter />
    </div>
  );
}
