import type { ModuleSection } from "../types";

export const MODULE_SECTIONS: ModuleSection[] = [
  {
    id: "erp",
    title: "ERP",
    fullTitle: "Enterprise Resource Planning",
    description:
      "Accounting, inventory, and enterprise operations in one unified system.",
    route: "/erp/dashboard",
    accentWord: "MANAGEMENT",
    statValue: "360°",
    statLabel: "Total visibility",
  },
  {
    id: "mes",
    title: "MES",
    fullTitle: "Manufacturing Execution System",
    description:
      "Production control, industrial efficiency, and real-time plant monitoring.",
    route: "/mes",
    accentWord: "PRODUCTION",
    statValue: "40%",
    statLabel: "More efficiency",
  },
  {
    id: "crm",
    title: "CRM",
    fullTitle: "Customer Relationship Management",
    description:
      "Clients, sales, commercial opportunities, and a fully integrated pipeline.",
    route: "/crm",
    accentWord: "CLIENTS",
    statValue: "3x",
    statLabel: "Conversion",
  },
  {
    id: "hcm",
    title: "HCM",
    fullTitle: "Human Capital Management",
    description:
      "Request vacation, check your requests, and access certificates and courses.",
    route: "/portal/hcm",
    accentWord: "EMPLOYEES",
    statValue: "24h",
    statLabel: "Response",
  },
];
