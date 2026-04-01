import type { OrderStatus, UiLocale } from "./types";

type Option = {
  value: string;
  label: string;
};

const ORDER_STATUS_FILTER_LABELS: Record<UiLocale, Record<string, string>> = {
  en: {
    all: "All",
    PENDIENTE: "Pending",
    PENDIENTE_CONTABILIDAD: "Pending accounting",
    APROBADO_CONTABILIDAD: "Accounting approved",
    APROBACION: "Approval",
    PROGRAMACION: "Scheduling",
    PRODUCCION: "Production",
    ATRASADO: "Delayed",
    FINALIZADO: "Completed",
    ENTREGADO: "Delivered",
    CANCELADO: "Canceled",
  },
  es: {
    all: "Todos",
    PENDIENTE: "Pendiente",
    PENDIENTE_CONTABILIDAD: "Pendiente contabilidad",
    APROBADO_CONTABILIDAD: "Aprobado contabilidad",
    APROBACION: "Aprobacion",
    PROGRAMACION: "Programacion",
    PRODUCCION: "Produccion",
    ATRASADO: "Atrasado",
    FINALIZADO: "Finalizado",
    ENTREGADO: "Entregado",
    CANCELADO: "Cancelado",
  },
};

const ORDER_TYPE_FILTER_LABELS: Record<UiLocale, Record<string, string>> = {
  en: {
    all: "All",
    VN: "VN",
    VI: "VI",
    VT: "VT",
    VW: "VW",
  },
  es: {
    all: "Todos",
    VN: "VN",
    VI: "VI",
    VT: "VT",
    VW: "VW",
  },
};

export function getOrderStatusFilterOptions(locale: UiLocale): Option[] {
  const labels = ORDER_STATUS_FILTER_LABELS[locale];

  return [
    { value: "all", label: labels.all },
    { value: "PENDIENTE", label: labels.PENDIENTE },
    { value: "PENDIENTE_CONTABILIDAD", label: labels.PENDIENTE_CONTABILIDAD },
    { value: "APROBADO_CONTABILIDAD", label: labels.APROBADO_CONTABILIDAD },
    { value: "APROBACION", label: labels.APROBACION },
    { value: "PROGRAMACION", label: labels.PROGRAMACION },
    { value: "PRODUCCION", label: labels.PRODUCCION },
    { value: "ATRASADO", label: labels.ATRASADO },
    { value: "FINALIZADO", label: labels.FINALIZADO },
    { value: "ENTREGADO", label: labels.ENTREGADO },
    { value: "CANCELADO", label: labels.CANCELADO },
  ];
}

export function getOrderTypeFilterOptions(locale: UiLocale): Option[] {
  const labels = ORDER_TYPE_FILTER_LABELS[locale];

  return [
    { value: "all", label: labels.all },
    { value: "VN", label: labels.VN },
    { value: "VI", label: labels.VI },
    { value: "VT", label: labels.VT },
    { value: "VW", label: labels.VW },
  ];
}

export const ORDERS_TAB_COPY: Record<
  UiLocale,
  {
    emptyResults: string;
    emptyOrders: string;
    searchPlaceholder: string;
    statusLabel: string;
    typeLabel: string;
    refresh: string;
    tableAriaLabel: string;
    tableHeaders: string[];
    actionsAriaLabel: string;
    actions: {
      designs: string;
      viewDetails: string;
      preInvoice: string;
      history: string;
      ready: string;
      commercialApprove: string;
      waitForPayment: string;
      delete: string;
    };
    confirmDelete: {
      cancel: string;
      confirm: string;
      title: string;
      description: (code: string) => string;
    };
    history: {
      title: string;
      loading: string;
      empty: string;
      noMetadata: string;
      changedBySystem: string;
      from: string;
      to: string;
      paid: string;
      pref: string;
      viewHistory: string;
    };
    readyDispatch: {
      title: string;
      selectOrder: string;
      order: string;
      client: string;
      currentStatus: string;
      orderTotal: string;
      confirmedPaid: string;
      paidPercent: string;
      destination: string;
      destinationNotApplicable: string;
      cancel: string;
      confirm: string;
      confirming: string;
      successToScheduling: string;
      successToApproval: string;
      noDestination: string;
    };
    commercial: {
      titleApprove: string;
      titleWait: string;
      order: string;
      client: string;
      currentStatus: string;
      bodyApprove: string;
      bodyWait: string;
      notePlaceholder: string;
      cancel: string;
      save: string;
      saving: string;
      successApprove: string;
      successWait: string;
    };
    deleteSuccess: string;
  }
> = {
  en: {
    emptyResults: "No results",
    emptyOrders: "No orders",
    searchPlaceholder: "Search by code...",
    statusLabel: "Status",
    typeLabel: "Type",
    refresh: "Refresh",
    tableAriaLabel: "Orders",
    tableHeaders: [
      "Code",
      "Client",
      "Type",
      "Delivery",
      "Status",
      "Last update",
      "Total",
      "Paid %",
      "Actions",
    ],
    actionsAriaLabel: "Actions",
    actions: {
      designs: "Designs",
      viewDetails: "View details",
      preInvoice: "Pre-invoice",
      history: "History",
      ready: "Order / designs ready",
      commercialApprove: "Commercial approve",
      waitForPayment: "Wait for payment",
      delete: "Delete",
    },
    confirmDelete: {
      cancel: "Cancel",
      confirm: "Delete",
      title: "Confirm deletion",
      description: (code: string) => `Delete order ${code}?`,
    },
    history: {
      title: "Status history",
      loading: "Loading...",
      empty: "No changes.",
      noMetadata: "No metadata",
      changedBySystem: "System",
      from: "from",
      to: "to",
      paid: "paid",
      pref: "pref",
      viewHistory: "View history",
    },
    readyDispatch: {
      title: "Confirm order dispatch",
      selectOrder: "Select an order to continue.",
      order: "Order",
      client: "Client",
      currentStatus: "Current status",
      orderTotal: "Order total",
      confirmedPaid: "Confirmed paid",
      paidPercent: "Paid percentage",
      destination: "Destination",
      destinationNotApplicable: "Not applicable",
      cancel: "Cancel",
      confirm: "Confirm dispatch",
      confirming: "Confirming...",
      successToScheduling: "Order sent to Scheduling",
      successToApproval: "Order sent to Approval",
      noDestination: "No applicable destination status.",
    },
    commercial: {
      titleApprove: "Commercial approval",
      titleWait: "Wait for payment",
      order: "Order",
      client: "Client",
      currentStatus: "Current status",
      bodyApprove:
        "This records commercial approval and keeps the order in Approval until next workflow action.",
      bodyWait:
        "This records a commercial pause because payment is still pending.",
      notePlaceholder: "Optional note",
      cancel: "Cancel",
      save: "Save decision",
      saving: "Saving...",
      successApprove: "Commercial approval recorded",
      successWait: "Marked as waiting for payment",
    },
    deleteSuccess: "Order disabled",
  },
  es: {
    emptyResults: "Sin resultados",
    emptyOrders: "Sin pedidos",
    searchPlaceholder: "Buscar por codigo...",
    statusLabel: "Estado",
    typeLabel: "Tipo",
    refresh: "Actualizar",
    tableAriaLabel: "Pedidos",
    tableHeaders: [
      "Codigo",
      "Cliente",
      "Tipo",
      "Entrega",
      "Estado",
      "Ultima actualizacion",
      "Total",
      "% Pagado",
      "Acciones",
    ],
    actionsAriaLabel: "Acciones",
    actions: {
      designs: "Disenos",
      viewDetails: "Ver detalle",
      preInvoice: "Prefactura",
      history: "Historial",
      ready: "Pedido / disenos listo",
      commercialApprove: "Aprobar comercial",
      waitForPayment: "Esperar pago",
      delete: "Eliminar",
    },
    confirmDelete: {
      cancel: "Cancelar",
      confirm: "Eliminar",
      title: "Confirmar eliminacion",
      description: (code: string) => `Eliminar pedido ${code}?`,
    },
    history: {
      title: "Historial de estados",
      loading: "Cargando...",
      empty: "Sin cambios.",
      noMetadata: "Sin metadatos",
      changedBySystem: "Sistema",
      from: "desde",
      to: "hacia",
      paid: "pagado",
      pref: "pref",
      viewHistory: "Ver historial",
    },
    readyDispatch: {
      title: "Confirmar envio de pedido",
      selectOrder: "Selecciona un pedido para continuar.",
      order: "Pedido",
      client: "Cliente",
      currentStatus: "Estado actual",
      orderTotal: "Total del pedido",
      confirmedPaid: "Pagado confirmado",
      paidPercent: "Porcentaje pagado",
      destination: "Destino",
      destinationNotApplicable: "No aplica",
      cancel: "Cancelar",
      confirm: "Confirmar envio",
      confirming: "Confirmando...",
      successToScheduling: "Pedido enviado a Programacion",
      successToApproval: "Pedido enviado a Aprobacion",
      noDestination: "No hay estado destino aplicable.",
    },
    commercial: {
      titleApprove: "Aprobacion comercial",
      titleWait: "Esperar pago",
      order: "Pedido",
      client: "Cliente",
      currentStatus: "Estado actual",
      bodyApprove:
        "Esto registra la aprobacion comercial y mantiene el pedido en Aprobacion hasta la siguiente accion del flujo.",
      bodyWait:
        "Esto registra una pausa comercial porque el pago aun esta pendiente.",
      notePlaceholder: "Nota opcional",
      cancel: "Cancelar",
      save: "Guardar decision",
      saving: "Guardando...",
      successApprove: "Aprobacion comercial registrada",
      successWait: "Marcado en espera de pago",
    },
    deleteSuccess: "Pedido deshabilitado",
  },
};

export const READY_DISPATCH_BLOCKED_STATUSES: OrderStatus[] = [
  "PROGRAMACION",
  "PRODUCCION",
  "ATRASADO",
  "FINALIZADO",
  "ENTREGADO",
  "CANCELADO",
];

export const COMMERCIAL_DECISION_ALLOWED_STATUSES: OrderStatus[] = [
  "APROBACION",
];
