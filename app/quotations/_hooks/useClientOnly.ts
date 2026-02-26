import { useEffect, useState } from "react";

/**
 * Hook para garantizar que el componente solo se renderiza en cliente
 * Evita hydration mismatches con HeroUI Select/Dropdown
 */
export function useClientOnly() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return isMounted;
}
