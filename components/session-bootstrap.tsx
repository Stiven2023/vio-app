"use client";

import { useEffect, useRef } from "react";

import { useSessionStore } from "@/store/session";

export function SessionBootstrap() {
  const verifySession = useSessionStore((s) => s.verifySession);
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);
  const role = useSessionStore((s) => s.user?.role);
  const siigoBootstrappedRef = useRef(false);

  useEffect(() => {
    void verifySession();
  }, [verifySession]);

  useEffect(() => {
    if (!isAuthenticated || role !== "ADMINISTRADOR") {
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
  }, [isAuthenticated, role]);

  return null;
}
