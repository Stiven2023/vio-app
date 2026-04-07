"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { useSessionStore } from "@/store/session";
import { getEffectiveSessionRole } from "@/src/utils/session-role";

const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/mes/login",
  "/erp/login",
  "/home",
  "/es",
  "/en",
]);

export function SessionBootstrap() {
  const pathname = usePathname();
  const verifySession = useSessionStore((s) => s.verifySession);
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);
  const user = useSessionStore((s) => s.user);
  const role = getEffectiveSessionRole(user);
  const siigoBootstrappedRef = useRef(false);
  const isPublicPath = PUBLIC_PATHS.has(pathname);

  useEffect(() => {
    if (isPublicPath) {
      return;
    }

    void verifySession();
  }, [isPublicPath, verifySession]);

  useEffect(() => {
    if (isPublicPath || !isAuthenticated || role !== "ADMINISTRADOR") {
      siigoBootstrappedRef.current = false;

      return;
    }

    if (siigoBootstrappedRef.current) return;
    siigoBootstrappedRef.current = true;

    // Inicializa la sesión de Siigo en segundo plano para administradores.
    void fetch("/api/siigo/auth", {
      method: "POST",
      credentials: "include",
    }).catch(() => null);
  }, [isAuthenticated, isPublicPath, role]);

  return null;
}
