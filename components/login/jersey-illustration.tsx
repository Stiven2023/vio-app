export function JerseyIllustration() {
  return (
    <svg
      fill="none"
      style={{ width: "100%", maxWidth: 220, opacity: 0.24 }}
      viewBox="0 0 200 180"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M55 35 L30 75 L60 80 L60 150 L140 150 L140 80 L170 75 L145 35 L122 50 C115 58 85 58 78 50 Z"
        fill="color-mix(in srgb, var(--viomar-primary) 10%, transparent)"
        stroke="var(--viomar-primary)"
        strokeWidth="2"
      />
      <path
        d="M78 50 C88 38 112 38 122 50"
        fill="none"
        stroke="var(--viomar-primary)"
        strokeWidth="1.5"
      />
      <line
        opacity="0.4"
        stroke="var(--viomar-primary)"
        strokeDasharray="5 4"
        strokeWidth="0.8"
        x1="60"
        x2="140"
        y1="95"
        y2="95"
      />
      <line
        opacity="0.25"
        stroke="var(--viomar-primary)"
        strokeDasharray="5 4"
        strokeWidth="0.8"
        x1="60"
        x2="140"
        y1="118"
        y2="118"
      />
      <circle
        cx="100"
        cy="112"
        fill="none"
        opacity="0.85"
        r="10"
        stroke="var(--viomar-primary)"
        strokeWidth="1.2"
      />
    </svg>
  );
}
