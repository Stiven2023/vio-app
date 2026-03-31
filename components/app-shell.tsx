"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";

import { AppFooter } from "@/components/app-footer";
import { Navbar } from "@/components/navbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasShownLegacyHcmNotice = useRef(false);
  const isModuleShell =
    pathname.startsWith("/mes") || pathname.startsWith("/crm");
  const isLocalizedHome = pathname === "/es" || pathname === "/en";

  useEffect(() => {
    if (hasShownLegacyHcmNotice.current) return;

    if (searchParams.get("legacy_hcm") !== "1") return;

    hasShownLegacyHcmNotice.current = true;
    toast("Ruta legacy detectada: usa HCM en tus accesos guardados.", {
      icon: "i",
      duration: 5500,
    });

    const params = new URLSearchParams(searchParams.toString());

    params.delete("legacy_hcm");

    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;

    window.history.replaceState(window.history.state, "", nextUrl);
  }, [pathname, searchParams]);

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
