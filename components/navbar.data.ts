import type { IconType } from "react-icons";

import {
  FiBarChart2,
  FiBriefcase,
  FiDatabase,
  FiDollarSign,
  FiGrid,
  FiMoreHorizontal,
  FiSettings,
  FiShield,
  FiShoppingCart,
  FiUsers,
} from "react-icons/fi";

export type SectionItem = {
  name: string;
  href: string;
};

export type NavSection = {
  key: string;
  label: string;
  icon: IconType;
  visible: boolean;
  items: SectionItem[];
};

type BuildSectionsArgs = {
  locale: "en" | "es";
  isAuthenticated: boolean;
  canSeeCatalog: boolean;
  canSeeClients: boolean;
  canSeeMolding: boolean;
  canSeeOrders: boolean;
  canSeePayments: boolean;
  canSeePurchaseOrders: boolean;
  canSeeStatusHistory: boolean;
  canSeeSuppliers: boolean;
};

type BuildOtherItemsArgs = {
  locale: "en" | "es";
  isAuthenticated: boolean;
  isAdmin: boolean;
};

export const otherMenuIcon = FiMoreHorizontal;

export const buildNavbarSections = ({
  locale,
  isAuthenticated,
  canSeeCatalog,
  canSeeClients,
  canSeeMolding,
  canSeeOrders,
  canSeePayments,
  canSeePurchaseOrders,
  canSeeStatusHistory,
  canSeeSuppliers,
}: BuildSectionsArgs): NavSection[] => {
  if (!isAuthenticated) return [];

  const labels = {
    dashboard: locale === "es" ? "Panel" : "Dashboard",
    purchasing: locale === "es" ? "Compras" : "Purchasing",
    sales: locale === "es" ? "Ventas" : "Sales",
    accounting: locale === "es" ? "Contabilidad" : "Accounting",
    accountingOverview:
      locale === "es" ? "Hub contable" : "Accounting hub",
    accountingDocuments:
      locale === "es" ? "Documentos comerciales" : "Commercial documents",
    accountingCashBanks:
      locale === "es" ? "Recaudo y bancos" : "Collections & banks",
    accountingReceivables:
      locale === "es" ? "Cartera y recuperación" : "Receivables & recovery",
    accountingCloseControl:
      locale === "es" ? "Cierre y control" : "Closing & control",
    production: locale === "es" ? "Producción" : "Production",
    masterData: locale === "es" ? "Maestros" : "Master Data",
    costs: locale === "es" ? "Costos" : "Costs",
    legal: locale === "es" ? "Jurídica" : "Legal",
    hr: locale === "es" ? "RH" : "HR",
    kpis: "KPIs",
    sla: "SLA",
    incomeStatement:
      locale === "es" ? "Estado de resultados" : "Income statement",
    commissions: locale === "es" ? "Comisiones" : "Commissions",
    warehouseInventory:
      locale === "es" ? "Bodega e inventario" : "Warehouse & Inventory",
    history: locale === "es" ? "Historial" : "History",
    coordinationCenter:
      locale === "es" ? "Centro de coordinación" : "Coordination Center",
    dispatch: locale === "es" ? "Despacho" : "Dispatch",
    packing: locale === "es" ? "Empaque" : "Packing",
    couriers: locale === "es" ? "Mensajeros" : "Couriers",
    drivers: locale === "es" ? "Conductores" : "Drivers",
    shipments: locale === "es" ? "Envíos" : "Shipments",
    quotations: locale === "es" ? "Cotizaciones" : "Quotations",
    payments: locale === "es" ? "Pagos" : "Payments",
    catalog: locale === "es" ? "Catálogo" : "Catalog",
    orders: locale === "es" ? "Pedidos" : "Orders",
    preInvoices: locale === "es" ? "Prefacturas" : "Pre-invoices",
    productionHistory:
      locale === "es" ? "Historial de producción" : "Production history",
    view: locale === "es" ? "Visualizar" : "View",
    internalWarranties:
      locale === "es" ? "Garantías internas" : "Internal warranties",
    externalWarranties:
      locale === "es" ? "Garantías externas" : "External warranties",
    invoices: locale === "es" ? "Facturas" : "Invoices",
    deliveryNotes: locale === "es" ? "Remisiones" : "Delivery notes",
    cashReceipt: locale === "es" ? "Recibo de caja" : "Cash receipt",
    deposits: locale === "es" ? "Consignaciones" : "Deposits",
    bankReconciliation:
      locale === "es" ? "Extractos bancarios" : "Bank statements",
    factoring: "Factoring",
    withholdings: locale === "es" ? "Retenciones" : "Withholdings",
    pettyCash: locale === "es" ? "Caja menor" : "Petty cash",
    accountsReceivable: locale === "es" ? "Cartera" : "Accounts receivable",
    scheduling: locale === "es" ? "Programación" : "Scheduling",
    initialApproval:
      locale === "es" ? "Aprobación inicial" : "Initial approval",
    edit: locale === "es" ? "Modificar" : "Edit",
    block: locale === "es" ? "Bloquear" : "Block",
    warranties: locale === "es" ? "Garantías" : "Warranties",
    products: locale === "es" ? "Productos" : "Products",
    clients: locale === "es" ? "Clientes" : "Clients",
    suppliers: locale === "es" ? "Proveedores" : "Suppliers",
    banks: locale === "es" ? "Bancos" : "Banks",
    confectionists: locale === "es" ? "Confeccionistas" : "Confectionists",
    packers: locale === "es" ? "Empacadores" : "Packers",
    patternBoard: locale === "es" ? "Tablero de patrones" : "Pattern board",
    patternsAndMolds: locale === "es" ? "Trazos y moldes" : "Patterns & molds",
    moldingTemplates:
      locale === "es" ? "Plantillas de moldería" : "Molding templates",
    budgets: locale === "es" ? "Presupuestos" : "Budgets",
    legalModule: locale === "es" ? "Módulo jurídico" : "Legal module",
    nonCompliance: locale === "es" ? "Incumplimientos" : "Non-compliance",
    overtime: locale === "es" ? "Horas extra" : "Overtime",
    vacations: locale === "es" ? "Vacaciones" : "Vacations",
    settlement: locale === "es" ? "Liquidación" : "Settlement",
    bonuses: locale === "es" ? "Bonificaciones" : "Bonuses",
    perDiem: locale === "es" ? "Viáticos" : "Per diem",
    payrollProvisions:
      locale === "es" ? "Provisiones de nómina" : "Payroll provisions",
    leavesAbsences:
      locale === "es" ? "Permisos y ausencias" : "Leaves & absences",
    pila:
      locale === "es" ? "Seguridad social (PILA)" : "Social security (PILA)",
  };

  return [
    {
      key: "dashboard",
      label: labels.dashboard,
      icon: FiBarChart2,
      visible: true,
      items: [
        { name: labels.kpis, href: "/dashboard" },
        { name: labels.sla, href: "/dashboard#sla" },
        { name: labels.incomeStatement, href: "/dashboard#estados-resultados" },
        { name: labels.commissions, href: "/dashboard#comisiones" },
      ],
    },
    {
      key: "compras",
      label: labels.purchasing,
      icon: FiShoppingCart,
      visible:
        canSeeCatalog ||
        canSeePurchaseOrders ||
        canSeeSuppliers ||
        canSeeStatusHistory,
      items: [
        { name: labels.warehouseInventory, href: "/compras/bodega" },
        { name: labels.coordinationCenter, href: "/purchase-orders" },
        { name: labels.dispatch, href: "/compras/despacho" },
        { name: labels.packing, href: "/compras/empaque" },
        { name: labels.couriers, href: "/compras/mensajeros" },
        { name: labels.drivers, href: "/compras/conductor" },
        { name: labels.shipments, href: "/compras/envios" },
        { name: labels.history, href: "/compras/historial" },
      ],
    },
    {
      key: "comercial",
      label: labels.sales,
      icon: FiBriefcase,
      visible: canSeeOrders || canSeePayments || canSeeCatalog,
      items: [
        { name: labels.quotations, href: "/quotations" },
        { name: labels.orders, href: "/comercial/pedidos" },
        { name: labels.preInvoices, href: "/comercial/prefacturas" },
        { name: labels.payments, href: "/comercial/pagos" },
        { name: labels.catalog, href: "/comercial/catalogo" },
        {
          name: labels.productionHistory,
          href: "/comercial/historial-produccion",
        },
        { name: labels.view, href: "/comercial/visualizar" },
        {
          name: labels.internalWarranties,
          href: "/comercial/garantias/interna",
        },
        {
          name: labels.externalWarranties,
          href: "/comercial/garantias/externa",
        },
      ],
    },
    {
      key: "contabilidad",
      label: labels.accounting,
      icon: FiDollarSign,
      visible: canSeeOrders,
      items: [{ name: labels.accounting, href: "/contabilidad-modulo" }],
    },
    {
      key: "produccion",
      label: labels.production,
      icon: FiSettings,
      visible: canSeeOrders,
      items: [
        { name: labels.scheduling, href: "/produccion/programacion" },
        {
          name: labels.initialApproval,
          href: "/produccion/aprobacion-inicial",
        },
        { name: labels.history, href: "/produccion/historial" },
        { name: labels.edit, href: "/produccion/modificar" },
        { name: labels.block, href: "/produccion/bloquear" },
        { name: labels.warranties, href: "/produccion/garantias" },
      ],
    },
    {
      key: "maestros",
      label: labels.masterData,
      icon: FiDatabase,
      visible:
        canSeeClients ||
        canSeeSuppliers ||
        canSeeCatalog ||
        canSeePayments ||
        canSeeMolding,
      items: [
        { name: labels.products, href: "/maestros/productos" },
        { name: labels.clients, href: "/maestros/clientes" },
        { name: labels.suppliers, href: "/maestros/proveedores" },
        { name: labels.banks, href: "/maestros/bancos" },
        { name: labels.confectionists, href: "/confectionists" },
        { name: labels.packers, href: "/packers" },
        { name: labels.patternBoard, href: "/patterns/tablero" },
        { name: labels.patternsAndMolds, href: "/patterns/trazos-moldes" },
        { name: labels.moldingTemplates, href: "/molding" },
      ],
    },
    {
      key: "costos",
      label: labels.costs,
      icon: FiGrid,
      visible: true,
      items: [{ name: labels.budgets, href: "/costs/presupuestos" }],
    },
    {
      key: "juridica",
      label: labels.legal,
      icon: FiShield,
      visible: true,
      items: [{ name: labels.legalModule, href: "/legal" }],
    },
    {
      key: "rh",
      label: labels.hr,
      icon: FiUsers,
      visible: true,
      items: [
        { name: labels.nonCompliance, href: "/erp/hr/non-compliance" },
        { name: labels.overtime, href: "/erp/hr/overtime" },
        { name: labels.vacations, href: "/erp/hr/vacations" },
        { name: labels.settlement, href: "/erp/hr/settlement" },
        { name: labels.commissions, href: "/erp/hr/commissions" },
        { name: labels.bonuses, href: "/erp/hr/bonuses" },
        { name: labels.perDiem, href: "/erp/hr/per-diem" },
        { name: labels.payrollProvisions, href: "/erp/hr/payroll-provisions" },
        { name: labels.leavesAbsences, href: "/erp/hr/leaves-and-absences" },
        { name: labels.pila, href: "/erp/hr/social-security-pila" },
      ],
    },
  ];
};

export const buildNavbarOtherItems = ({
  locale,
  isAuthenticated,
  isAdmin,
}: BuildOtherItemsArgs): SectionItem[] => {
  if (!isAuthenticated) return [];

  const items: SectionItem[] = [
    { name: locale === "es" ? "Inicio" : "Home", href: "/home" },
    {
      name: locale === "es" ? "Notificaciones" : "Notifications",
      href: "/notifications",
    },
    { name: locale === "es" ? "Opciones" : "Options", href: "/options" },
    { name: locale === "es" ? "Envíos" : "Shipments", href: "/envios" },
  ];

  if (isAdmin) {
    items.push({
      name: locale === "es" ? "Administración" : "Administration",
      href: "/admin",
    });
  }

  return items;
};
