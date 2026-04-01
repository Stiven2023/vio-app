"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";

const moduleMeta = {
  erp: {
    title: "ERP",
    description:
      "Comprehensive operations: sales, purchasing, production and accounting",
  },
  mes: {
    title: "MES",
    description: "Manufacturing execution and plant control",
  },
  crm: {
    title: "CRM",
    description: "Commercial management and customer relationships",
  },
  hcm: {
    title: "HCM",
    description: "Independent human capital module integrated with ERP",
  },
};

function getModuleFromPath(pathname: string) {
  if (pathname === "/mes" || pathname.startsWith("/mes/")) return "mes";
  if (pathname === "/crm" || pathname.startsWith("/crm/")) return "crm";
  if (pathname === "/hcm" || pathname.startsWith("/hcm/")) return "hcm";

  return "erp";
}

export function AppFooter() {
  const pathname = usePathname();
  const currentYear = new Date().getFullYear();

  if (pathname === "/") {
    return (
      <footer className="border-t border-default-200/80 bg-content1/70 backdrop-blur">
        <div className="container mx-auto flex max-w-7xl items-center justify-center px-6 py-4 text-sm text-default-600">
          © {currentYear} Viomar App. All rights reserved.
        </div>
      </footer>
    );
  }

  const moduleKey = getModuleFromPath(pathname);
  const meta = moduleMeta[moduleKey as keyof typeof moduleMeta];
  const moduleLinks =
    moduleKey === "hcm"
      ? [
          { href: "/hcm", label: "HCM" },
          { href: "/erp", label: "ERP" },
          { href: "/mes", label: "MES" },
          { href: "/crm", label: "CRM" },
        ]
      : [
          { href: "/erp", label: "ERP" },
          { href: "/mes", label: "MES" },
          { href: "/crm", label: "CRM" },
          { href: "/hcm", label: "HCM" },
        ];

  return (
    <footer className="border-t border-default-200/80 bg-content1/70 backdrop-blur">
      <div className="container mx-auto flex max-w-7xl flex-col gap-3 px-6 py-4 text-sm text-default-600 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-medium text-default-700">
            © {currentYear} Viomar App · {meta.title}
          </div>
          <div className="text-xs text-default-500">{meta.description}</div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          {moduleLinks.map((link) => (
            <NextLink
              key={link.href}
              className="hover:text-default-900"
              href={link.href}
            >
              {link.label}
            </NextLink>
          ))}
          <span className="text-default-400">Viomar Platform v2</span>
        </div>
      </div>
    </footer>
  );
}
