export function resolveAccountingSourceModule(sourceType: string) {
  switch (String(sourceType).trim().toUpperCase()) {
    case "PREFACTURA":
      return "SALES" as const;
    case "CASH_RECEIPT":
      return "TREASURY" as const;
    case "SUPPLIER_INVOICE":
    case "SUPPLIER_PAYMENT":
      return "PURCHASING" as const;
    case "PAYROLL":
      return "PAYROLL" as const;
    case "STOCK_MOVEMENT":
      return "INVENTORY" as const;
    case "FACTORING":
    case "PETTY_CASH":
      return "TREASURY" as const;
    case "CLOSURE":
    case "MANUAL":
      return "GENERAL" as const;
    default:
      return "GENERAL" as const;
  }
}

export function resolveVoucherType(sourceType: string) {
  switch (String(sourceType).trim().toUpperCase()) {
    case "PREFACTURA":
    case "CASH_RECEIPT":
      return "IN";
    case "SUPPLIER_INVOICE":
    case "SUPPLIER_PAYMENT":
    case "PAYROLL":
    case "PETTY_CASH":
      return "EG";
    case "STOCK_MOVEMENT":
    case "FACTORING":
    case "MANUAL":
      return "CD";
    case "CLOSURE":
      return "CL";
    default:
      return "CD";
  }
}