export function JerseyIllustration() {
  return (
    <svg
      viewBox="0 0 200 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", maxWidth: 220, opacity: 0.24 }}
    >
      <path
        d="M55 35 L30 75 L60 80 L60 150 L140 150 L140 80 L170 75 L145 35 L122 50 C115 58 85 58 78 50 Z"
        stroke="var(--viomar-primary)"
        strokeWidth="2"
        fill="color-mix(in srgb, var(--viomar-primary) 10%, transparent)"
      />
      <path
        d="M78 50 C88 38 112 38 122 50"
        stroke="var(--viomar-primary)"
        strokeWidth="1.5"
        fill="none"
      />
      <line x1="60" y1="95" x2="140" y2="95" stroke="var(--viomar-primary)" strokeWidth="0.8" strokeDasharray="5 4" opacity="0.4" />
      <line x1="60" y1="118" x2="140" y2="118" stroke="var(--viomar-primary)" strokeWidth="0.8" strokeDasharray="5 4" opacity="0.25" />
      <circle cx="100" cy="112" r="10" stroke="var(--viomar-primary)" strokeWidth="1.2" fill="none" opacity="0.85" />
    </svg>
  );
}
