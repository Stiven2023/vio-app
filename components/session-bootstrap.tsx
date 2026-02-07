"use client";

import { useEffect } from "react";

import { useSessionStore } from "@/store/session";

export function SessionBootstrap() {
  const verifySession = useSessionStore((s) => s.verifySession);

  useEffect(() => {
    void verifySession();
  }, [verifySession]);

  return null;
}
