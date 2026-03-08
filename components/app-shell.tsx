"use client";

import { usePathname } from "next/navigation";

import { AppFooter } from "@/components/app-footer";
import { Navbar } from "@/components/navbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/") {
    return <>{children}</>;
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden">
      <Navbar />
      <main className="container mx-auto max-w-7xl flex-grow overflow-x-hidden px-6 pt-16">{children}</main>
      <AppFooter />
    </div>
  );
}
