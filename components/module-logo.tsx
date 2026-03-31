import clsx from "clsx";

type ModuleId = "erp" | "mes" | "crm" | "hr" | "hcm";

export function ModuleLogo({
  module,
  className,
  active = false,
  size = 120,
}: {
  module: ModuleId;
  className?: string;
  active?: boolean;
  size?: number;
}) {
  const stroke = active ? "var(--viomar-primary)" : "#A6A39B";
  const accent = "var(--viomar-primary)";

  return (
    <svg
      aria-label={`${module.toUpperCase()} logo`}
      className={clsx("w-auto h-auto", className)}
      style={{ width: size, height: size }}
      viewBox="0 0 128 128"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="64"
        cy="64"
        fill="#050505"
        r="58"
        stroke={active ? stroke : "transparent"}
        strokeWidth="2"
      />

      {module === "erp" ? (
        <>
          <circle cx="64" cy="46" fill={accent} r="14" />
          <circle cx="37" cy="58" fill={accent} r="10" />
          <circle cx="91" cy="58" fill={accent} r="10" />
          <path d="M45 92V80c0-14 6-23 19-23s19 9 19 23v12" fill={accent} />
          <path d="M22 90v-8c0-8 5-14 14-14 8 0 13 6 13 14v8" fill={accent} />
          <path d="M79 90v-8c0-8 5-14 14-14 8 0 13 6 13 14v8" fill={accent} />
        </>
      ) : null}

      {module === "mes" ? (
        <>
          <path
            d="M35 36 23 42c-2 1-3 4-4 7l-4 17c0 2 1 4 3 5l8 4v29h37l2-22c0-5 2-9 6-12l7-5c2-1 2-3 2-5l-4-18c-1-3-2-5-4-6L59 29H38c-1 2-1 5 0 8 2 4 6 7 11 7 6 0 11-4 12-10"
            fill={accent}
            stroke={stroke}
            strokeLinejoin="round"
            strokeWidth="1.5"
          />
          <path
            d="M62 58h35c3 0 5 2 5 5v10c0 3-2 5-5 5H61c-3 0-5-2-5-5V64c0-3 2-6 6-6Z"
            fill={accent}
            stroke={stroke}
            strokeWidth="1.5"
          />
          <path
            d="M60 79h40l3 16H57l3-16Z"
            fill={accent}
            stroke={stroke}
            strokeLinejoin="round"
            strokeWidth="1.5"
          />
          <path
            d="M60 95h15l-2 10c0 1-1 2-3 2H58c-2 0-3-2-3-4l5-8Z"
            fill={accent}
          />
          <path
            d="M84 95h15l5 8c0 2-1 4-3 4H89c-2 0-3-1-3-2l-2-10Z"
            fill={accent}
          />
          <path
            d="M45 72v18"
            stroke="#050505"
            strokeLinecap="round"
            strokeWidth="3"
          />
        </>
      ) : null}

      {module === "crm" ? (
        <>
          <rect
            fill="color-mix(in srgb, var(--viomar-primary) 45%, transparent)"
            height="12"
            opacity="0.45"
            width="88"
            x="20"
            y="31"
          />
          <circle cx="39" cy="43" fill={accent} r="9" />
          <circle cx="64" cy="38" fill={accent} r="10" />
          <circle cx="89" cy="43" fill={accent} r="9" />
          <path d="M30 62c0-8 5-14 13-14 7 0 13 6 13 14v5H30Z" fill={accent} />
          <path d="M48 60c0-10 7-18 16-18s16 8 16 18v8H48Z" fill={accent} />
          <path d="M72 62c0-8 6-14 13-14 8 0 13 6 13 14v5H72Z" fill={accent} />
          <path
            d="m43 93 6-6 20-19c3-3 8-3 11 0l25 25c2 2 2 6 0 8s-6 2-8 0L78 82l-5 5 16 16c2 2 2 6 0 8s-6 2-8 0L65 95l-4 4 13 13c2 2 2 6 0 8s-6 2-8 0L52 106l-4 4c-2 2-6 2-8 0s-2-6 0-8l8-9-7-7c-3-4-2-9 2-12Z"
            fill={accent}
            stroke={stroke}
            strokeLinejoin="round"
            strokeWidth="1.5"
          />
          <path
            d="M17 83 24 52c1-3 4-5 7-4l10 1-8 39-11-2c-3-1-5-3-5-6Z"
            fill={accent}
          />
          <path
            d="m111 83-7-31c-1-3-4-5-7-4l-10 1 8 39 11-2c3-1 5-3 5-6Z"
            fill={accent}
          />
        </>
      ) : null}

      {module === "hr" || module === "hcm" ? (
        <>
          <circle cx="64" cy="38" fill={accent} r="16" />
          <path
            d="M32 95c0-18 14-32 32-32s32 14 32 32"
            fill={accent}
            stroke={stroke}
            strokeLinejoin="round"
            strokeWidth="1.5"
          />
          <rect
            fill="color-mix(in srgb, var(--viomar-primary) 30%, transparent)"
            height="30"
            rx="4"
            width="36"
            x="46"
            y="68"
          />
          <rect fill={accent} height="5" rx="1" width="36" x="46" y="68" />
          <line
            stroke={stroke}
            strokeLinecap="round"
            strokeWidth="2"
            x1="54"
            x2="54"
            y1="65"
            y2="71"
          />
          <line
            stroke={stroke}
            strokeLinecap="round"
            strokeWidth="2"
            x1="74"
            x2="74"
            y1="65"
            y2="71"
          />
          <line
            stroke={stroke}
            strokeLinecap="round"
            strokeWidth="1.5"
            x1="52"
            x2="72"
            y1="82"
            y2="82"
          />
          <line
            stroke={stroke}
            strokeLinecap="round"
            strokeWidth="1.5"
            x1="52"
            x2="66"
            y1="89"
            y2="89"
          />
        </>
      ) : null}
    </svg>
  );
}
