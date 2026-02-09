import type { SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

const resolveSize = (size?: number, fallback = 24) => size ?? fallback;

export function SunFilledIcon({ size, ...props }: IconProps) {
  const finalSize = resolveSize(size, 24);

  return (
    <svg
      aria-hidden="true"
      fill="currentColor"
      height={finalSize}
      viewBox="0 0 24 24"
      width={finalSize}
      {...props}
    >
      <path d="M11 4.062V2h2v2.062a6.003 6.003 0 0 1 4.938 4.938H20v2h-2.062A6.003 6.003 0 0 1 13 15.938V18h-2v-2.062A6.003 6.003 0 0 1 6.062 11H4V9h2.062A6.003 6.003 0 0 1 11 4.062z" />
      <circle cx="12" cy="10" r="3" />
      <path d="M3.515 5.636 4.93 7.05l-1.414 1.414L2.1 7.05zM20.485 5.636 21.9 7.05l-1.414 1.414-1.414-1.414zM3.515 14.95 4.93 16.364l-1.414 1.414L2.1 16.364zM20.485 14.95 21.9 16.364l-1.414 1.414-1.414-1.414z" />
    </svg>
  );
}

export function MoonFilledIcon({ size, ...props }: IconProps) {
  const finalSize = resolveSize(size, 24);

  return (
    <svg
      aria-hidden="true"
      fill="currentColor"
      height={finalSize}
      viewBox="0 0 24 24"
      width={finalSize}
      {...props}
    >
      <path d="M20.742 13.045A8.088 8.088 0 0 1 11 3.258a8.1 8.1 0 1 0 9.742 9.787z" />
    </svg>
  );
}

export function SearchIcon({ size, ...props }: IconProps) {
  const finalSize = resolveSize(size, 20);

  return (
    <svg
      aria-hidden="true"
      fill="currentColor"
      height={finalSize}
      viewBox="0 0 24 24"
      width={finalSize}
      {...props}
    >
      <path d="M10 2a8 8 0 1 0 4.9 14.3l4.4 4.4 1.4-1.4-4.4-4.4A8 8 0 0 0 10 2zm0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12z" />
    </svg>
  );
}
