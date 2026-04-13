export type EmployeePortalView =
  | "overview"
  | "requests"
  | "payroll-report"
  | "pay-slips"
  | "certificate-220"
  | "letters"
  | "training"
  | "overtime";

export const EMPLOYEE_PORTAL_MENU: Array<{
  id: EmployeePortalView;
  label: string;
  shortLabel: string;
  icon: string;
  badge?: string;
}> = [
  { id: "overview", label: "My profile", shortLabel: "Profile", icon: "PR" },
  { id: "requests", label: "My requests", shortLabel: "Requests", icon: "RQ", badge: "2" },
  { id: "payroll-report", label: "Payroll report", shortLabel: "Payroll", icon: "PY" },
  { id: "pay-slips", label: "Pay slips", shortLabel: "Slips", icon: "PS" },
  { id: "certificate-220", label: "Certificate 220", shortLabel: "220", icon: "C2" },
  { id: "letters", label: "Employment letters", shortLabel: "Letters", icon: "LT" },
  { id: "training", label: "Training", shortLabel: "Training", icon: "TR" },
  { id: "overtime", label: "Overtime", shortLabel: "Overtime", icon: "OT" },
];
