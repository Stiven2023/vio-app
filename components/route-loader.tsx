"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { ViomarLogo } from "@/components/viomar-logo";

export function RouteLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }

    setVisible(true);
    const t = setTimeout(() => setVisible(false), 500);

    return () => clearTimeout(t);
  }, [pathname, searchParams]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/15 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 rounded-large bg-content1 px-8 py-6 shadow-xl">
        <div className="flex items-center gap-2">
          <ViomarLogo className="h-7" />
        </div>
        <div className="flex gap-2">
          <div className="h-3 w-3 animate-bounce rounded-full bg-success" />
          <div className="h-3 w-3 animate-bounce rounded-full bg-success [animation-delay:100ms]" />
          <div className="h-3 w-3 animate-bounce rounded-full bg-success [animation-delay:200ms]" />
        </div>
        <div className="text-sm text-default-500">Preparando tu vista...</div>
      </div>
    </div>
  );
}
