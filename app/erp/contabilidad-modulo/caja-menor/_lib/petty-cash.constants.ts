import type { PettyCashLocale, TransactionType } from "./types";

type SelectOption<T extends string> = {
  value: T;
  label: string;
};

const TRANSACTION_TYPE_LABELS: Record<
  PettyCashLocale,
  Record<TransactionType, string>
> = {
  en: {
    EXPENSE: "Expense",
    REPLENISHMENT: "Replenishment",
    OPENING: "Opening",
    ADJUSTMENT: "Adjustment",
  },
  es: {
    EXPENSE: "Egreso",
    REPLENISHMENT: "Reposicion",
    OPENING: "Apertura",
    ADJUSTMENT: "Ajuste",
  },
};

const EXPENSE_CATEGORY_LABELS: Record<
  PettyCashLocale,
  Record<string, string>
> = {
  en: {
    Papelería: "Stationery",
    Transporte: "Transport",
    Aseo: "Cleaning",
    Cafetería: "Cafeteria",
    "Materiales varios": "Miscellaneous materials",
    Mensajería: "Courier",
    "Servicios públicos": "Utilities",
    Otros: "Others",
  },
  es: {
    Papelería: "Papeleria",
    Transporte: "Transporte",
    Aseo: "Aseo",
    Cafetería: "Cafeteria",
    "Materiales varios": "Materiales varios",
    Mensajería: "Mensajeria",
    "Servicios públicos": "Servicios publicos",
    Otros: "Otros",
  },
};

export const PETTY_CASH_COPY: Record<
  PettyCashLocale,
  {
    pageTitle: string;
    pageDescription: string;
    tabs: { transactions: string; funds: string };
    transactions: {
      ariaLabel: string;
      helper: string;
      export: string;
      new: string;
      summary: { expenses: string; replenishments: string; activeBalance: string };
      filters: {
        fund: string;
        allFunds: string;
        transactionType: string;
        from: string;
        to: string;
        clear: string;
        refresh: string;
      };
      table: {
        date: string;
        code: string;
        fund: string;
        type: string;
        category: string;
        description: string;
        amount: string;
        balance: string;
        reference: string;
        loading: string;
        empty: string;
      };
      pagination: {
        total: string;
        movementSingular: string;
        movementPlural: string;
        previous: string;
        next: string;
      };
      modal: {
        title: string;
        fund: string;
        date: string;
        type: string;
        category: string;
        categoryPlaceholder: string;
        description: string;
        descriptionPlaceholder: string;
        amount: string;
        currentBalance: string;
        currentBalanceHint: string;
        currentBalanceEmpty: string;
        referenceCode: string;
        referencePlaceholder: string;
        notes: string;
        notesPlaceholder: string;
        selectedFundPrefix: string;
        cancel: string;
        confirm: string;
        saving: string;
      };
      validation: {
        fundRequired: string;
        dateRequired: string;
        descriptionRequired: string;
        amountRequired: string;
        positiveAmount: string;
        insufficientBalance: string;
        saved: string;
      };
    };
    funds: {
      helper: string;
      new: string;
      table: {
        name: string;
        description: string;
        responsible: string;
        initialBalance: string;
        currentBalance: string;
        maxBalance: string;
        currency: string;
        status: string;
        loading: string;
        empty: string;
        active: string;
        inactive: string;
      };
      modal: {
        title: string;
        name: string;
        namePlaceholder: string;
        description: string;
        descriptionPlaceholder: string;
        initialBalance: string;
        maxBalance: string;
        currency: string;
        cancel: string;
        confirm: string;
        saving: string;
      };
      validation: {
        nameRequired: string;
        initialRequired: string;
        initialInvalid: string;
        saved: string;
      };
    };
    exportSheetName: string;
    exportFileName: string;
  }
> = {
  en: {
    pageTitle: "Petty Cash",
    pageDescription:
      "Petty cash fund control with transaction tracking, replenishments and balance visibility.",
    tabs: { transactions: "Transactions", funds: "Funds" },
    transactions: {
      ariaLabel: "Petty cash",
      helper: "Track expenses, replenishments and opening entries for each fund.",
      export: "Export Excel",
      new: "New transaction",
      summary: {
        expenses: "Total expenses",
        replenishments: "Total replenishments",
        activeBalance: "Current balance (active funds)",
      },
      filters: {
        fund: "Fund",
        allFunds: "All funds",
        transactionType: "Transaction type",
        from: "From",
        to: "To",
        clear: "Clear",
        refresh: "Refresh",
      },
      table: {
        date: "Date",
        code: "Code",
        fund: "Fund",
        type: "Type",
        category: "Category",
        description: "Description",
        amount: "Amount",
        balance: "Balance",
        reference: "Reference",
        loading: "Loading...",
        empty: "No transactions found",
      },
      pagination: {
        total: "Total:",
        movementSingular: "transaction",
        movementPlural: "transactions",
        previous: "Previous",
        next: "Next",
      },
      modal: {
        title: "Register petty cash transaction",
        fund: "Fund",
        date: "Date",
        type: "Transaction type",
        category: "Category",
        categoryPlaceholder: "Select category",
        description: "Description",
        descriptionPlaceholder: "Transaction details",
        amount: "Amount",
        currentBalance: "Current fund balance",
        currentBalanceHint: "Available balance in the selected fund",
        currentBalanceEmpty: "Select a fund to view the balance",
        referenceCode: "Reference code",
        referencePlaceholder: "Receipt, invoice, etc.",
        notes: "Notes",
        notesPlaceholder: "Additional notes (optional)",
        selectedFundPrefix: "Balance:",
        cancel: "Cancel",
        confirm: "Register",
        saving: "Saving...",
      },
      validation: {
        fundRequired: "Select a fund",
        dateRequired: "Date is required",
        descriptionRequired: "Description is required",
        amountRequired: "Amount is required",
        positiveAmount: "Amount must be positive",
        insufficientBalance: "Insufficient fund balance",
        saved: "Transaction registered",
      },
    },
    funds: {
      helper: "Manage active and inactive petty cash funds.",
      new: "New fund",
      table: {
        name: "Name",
        description: "Description",
        responsible: "Owner",
        initialBalance: "Initial balance",
        currentBalance: "Current balance",
        maxBalance: "Max balance",
        currency: "Currency",
        status: "Status",
        loading: "Loading...",
        empty: "No funds found",
        active: "Active",
        inactive: "Inactive",
      },
      modal: {
        title: "Create petty cash fund",
        name: "Fund name",
        namePlaceholder: "Example: Administrative petty cash",
        description: "Description",
        descriptionPlaceholder: "Fund purpose or notes (optional)",
        initialBalance: "Initial balance",
        maxBalance: "Max balance",
        currency: "Currency",
        cancel: "Cancel",
        confirm: "Create fund",
        saving: "Creating...",
      },
      validation: {
        nameRequired: "Fund name is required",
        initialRequired: "Initial balance is required",
        initialInvalid: "Invalid initial balance",
        saved: "Fund created successfully",
      },
    },
    exportSheetName: "Petty Cash",
    exportFileName: "petty_cash.xlsx",
  },
  es: {
    pageTitle: "Caja menor",
    pageDescription:
      "Gestion de fondos de caja menor con registro de movimientos, reposiciones y control de saldo.",
    tabs: { transactions: "Movimientos", funds: "Fondos" },
    transactions: {
      ariaLabel: "Caja menor",
      helper: "Registro de egresos, reposiciones y aperturas de caja menor.",
      export: "Exportar Excel",
      new: "Nuevo movimiento",
      summary: {
        expenses: "Total egresos",
        replenishments: "Total reposiciones",
        activeBalance: "Balance actual (fondos activos)",
      },
      filters: {
        fund: "Fondo",
        allFunds: "Todos los fondos",
        transactionType: "Tipo de movimiento",
        from: "Desde",
        to: "Hasta",
        clear: "Limpiar",
        refresh: "Actualizar",
      },
      table: {
        date: "Fecha",
        code: "Codigo",
        fund: "Fondo",
        type: "Tipo",
        category: "Categoria",
        description: "Descripcion",
        amount: "Monto",
        balance: "Balance",
        reference: "Referencia",
        loading: "Cargando...",
        empty: "Sin movimientos registrados",
      },
      pagination: {
        total: "Total:",
        movementSingular: "movimiento",
        movementPlural: "movimientos",
        previous: "Anterior",
        next: "Siguiente",
      },
      modal: {
        title: "Registrar movimiento de caja menor",
        fund: "Fondo",
        date: "Fecha",
        type: "Tipo de movimiento",
        category: "Categoria",
        categoryPlaceholder: "Seleccionar categoria",
        description: "Descripcion",
        descriptionPlaceholder: "Detalle del movimiento",
        amount: "Monto",
        currentBalance: "Saldo actual del fondo",
        currentBalanceHint: "Saldo disponible en el fondo seleccionado",
        currentBalanceEmpty: "Selecciona un fondo para ver el saldo",
        referenceCode: "Codigo de referencia",
        referencePlaceholder: "Comprobante, factura, etc.",
        notes: "Observaciones",
        notesPlaceholder: "Notas adicionales (opcional)",
        selectedFundPrefix: "Saldo:",
        cancel: "Cancelar",
        confirm: "Registrar",
        saving: "Registrando...",
      },
      validation: {
        fundRequired: "Selecciona un fondo",
        dateRequired: "La fecha es obligatoria",
        descriptionRequired: "La descripcion es obligatoria",
        amountRequired: "El monto es obligatorio",
        positiveAmount: "El monto debe ser positivo",
        insufficientBalance: "Saldo insuficiente en el fondo",
        saved: "Movimiento registrado",
      },
    },
    funds: {
      helper: "Administracion de fondos de caja menor activos e inactivos.",
      new: "Nuevo fondo",
      table: {
        name: "Nombre",
        description: "Descripcion",
        responsible: "Responsable",
        initialBalance: "Saldo inicial",
        currentBalance: "Saldo actual",
        maxBalance: "Saldo max.",
        currency: "Moneda",
        status: "Estado",
        loading: "Cargando...",
        empty: "Sin fondos registrados",
        active: "Activo",
        inactive: "Inactivo",
      },
      modal: {
        title: "Crear fondo de caja menor",
        name: "Nombre del fondo",
        namePlaceholder: "Ej. Caja menor administrativa",
        description: "Descripcion",
        descriptionPlaceholder: "Proposito o descripcion del fondo (opcional)",
        initialBalance: "Saldo inicial",
        maxBalance: "Saldo maximo",
        currency: "Moneda",
        cancel: "Cancelar",
        confirm: "Crear fondo",
        saving: "Creando...",
      },
      validation: {
        nameRequired: "El nombre del fondo es obligatorio",
        initialRequired: "El saldo inicial es obligatorio",
        initialInvalid: "Saldo inicial invalido",
        saved: "Fondo creado correctamente",
      },
    },
    exportSheetName: "Caja Menor",
    exportFileName: "caja_menor.xlsx",
  },
};

export function getTransactionTypeOptions(
  locale: PettyCashLocale,
): SelectOption<"ALL" | TransactionType>[] {
  const labels = TRANSACTION_TYPE_LABELS[locale];

  return [
    {
      value: "ALL",
      label: locale === "es" ? "Todos los tipos" : "All types",
    },
    { value: "EXPENSE", label: labels.EXPENSE },
    { value: "REPLENISHMENT", label: labels.REPLENISHMENT },
    { value: "OPENING", label: labels.OPENING },
    { value: "ADJUSTMENT", label: labels.ADJUSTMENT },
  ];
}

export function getTransactionTypeLabel(
  locale: PettyCashLocale,
  type: TransactionType,
): string {
  return TRANSACTION_TYPE_LABELS[locale][type];
}

export function getExpenseCategoryOptions(
  locale: PettyCashLocale,
): SelectOption<string>[] {
  const labels = EXPENSE_CATEGORY_LABELS[locale];

  return Object.entries(labels).map(([value, label]) => ({ value, label }));
}

export function getCurrencyOptions(
  locale: PettyCashLocale,
): SelectOption<string>[] {
  if (locale === "es") {
    return [
      { value: "COP", label: "COP - Peso colombiano" },
      { value: "USD", label: "USD - Dolar estadounidense" },
      { value: "EUR", label: "EUR - Euro" },
    ];
  }

  return [
    { value: "COP", label: "COP - Colombian peso" },
    { value: "USD", label: "USD - US dollar" },
    { value: "EUR", label: "EUR - Euro" },
  ];
}