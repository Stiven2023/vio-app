"use client";

import Image from "next/image";
import { useTheme } from "next-themes";
import { useIsSSR } from "@react-aria/ssr";
import clsx from "clsx";

export interface ViomarLogoProps {
  className?: string;
  height?: number;
}

export function ViomarLogo({ className, height = 28 }: ViomarLogoProps) {
  const { resolvedTheme } = useTheme();
  const isSSR = useIsSSR();

  const isDark = !isSSR && resolvedTheme === "dark";
  const src = isDark ? "/VIOMAR BLANCO.png" : "/VIOMAR NEGRO.png";

  // width es aproximado para mantener ratio; next/image requiere width/height.
  const width = Math.round(height * 4);

  return (
    <Image
      priority
      alt="VIOMAR"
      className={clsx("w-auto", className)}
      height={height}
      src={src}
      width={width}
    />
  );
}
