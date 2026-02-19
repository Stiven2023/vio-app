import type { ReactNode } from "react";

type IconProps = {
  className?: string;
};

export function FormTabTitle({
  icon,
  label,
}: {
  icon: ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span>{label}</span>
    </div>
  );
}

export function IdentificationIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <path
        d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M8 10h8M8 14h5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function ContactIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <path
        d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zM5 20a7 7 0 0 1 14 0"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function LocationIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <path
        d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function PhoneIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <path
        d="M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M10 7h4M9 17h6" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function FinanceIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <rect
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
        width="18"
        x="3"
        y="5"
      />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function UserRoleIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <path
        d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zM5 20a7 7 0 0 1 14 0"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M17 8h4M19 6v4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
