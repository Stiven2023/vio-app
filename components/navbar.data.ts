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
    isAuthenticated: boolean;
    canSeeCatalog: boolean;
    canSeeClients: boolean;
    canSeeOrders: boolean;
    canSeePayments: boolean;
    canSeePurchaseOrders: boolean;
    canSeeStatusHistory: boolean;
    canSeeSuppliers: boolean;
};

type BuildOtherItemsArgs = {
    isAuthenticated: boolean;
    isAdmin: boolean;
};

export const otherMenuIcon = FiMoreHorizontal;

export const buildNavbarSections = ({
    isAuthenticated,
    canSeeCatalog,
    canSeeClients,
    canSeeOrders,
    canSeePayments,
    canSeePurchaseOrders,
    canSeeStatusHistory,
    canSeeSuppliers,
}: BuildSectionsArgs): NavSection[] => {
    if (!isAuthenticated) return [];

    return [
        {
            key: "dashboard",
            label: "Dashboard",
            icon: FiBarChart2,
            visible: true,
            items: [
                { name: "KPIs", href: "/dashboard" },
                { name: "SLA", href: "/dashboard#sla" },
                { name: "Income statement", href: "/dashboard#estados-resultados" },
                { name: "Commissions", href: "/dashboard#comisiones" },
            ],
        },
        {
            key: "compras",
            label: "Purchasing",
            icon: FiShoppingCart,
            visible: canSeeCatalog || canSeePurchaseOrders || canSeeSuppliers || canSeeStatusHistory,
            items: [
                { name: "Warehouse & Inventory", href: "/compras/bodega" },
                { name: "History", href: "/compras/historial" },
                { name: "Coordination Center", href: "/purchase-orders" },
                { name: "Dispatch", href: "/compras/despacho" },
                { name: "Packing", href: "/compras/empaque" },
                { name: "Couriers", href: "/compras/mensajeros" },
                { name: "Drivers", href: "/compras/conductor" },
                { name: "Shipments", href: "/compras/envios" },
            ],
        },
        {
            key: "comercial",
            label: "Sales",
            icon: FiBriefcase,
            visible: canSeeOrders || canSeePayments || canSeeCatalog,
            items: [
                { name: "Quotes", href: "/quotations" },
                { name: "Payments", href: "/comercial/pagos" },
                { name: "Catalog", href: "/comercial/catalogo" },
                { name: "Orders", href: "/comercial/pedidos" },
                { name: "Pre-invoices", href: "/comercial/prefacturas" },
                { name: "Production history", href: "/comercial/historial-produccion" },
                { name: "View", href: "/comercial/visualizar" },
                { name: "Internal warranties", href: "/comercial/garantias/interna" },
                { name: "External warranties", href: "/comercial/garantias/externa" },
            ],
        },
        {
            key: "contabilidad",
            label: "Accounting",
            icon: FiDollarSign,
            visible: canSeeOrders,
            items: [
                { name: "Deposits", href: "/erp/accounting-module/deposits" },
                { name: "Invoices", href: "/erp/accounting-module/invoices" },
                { name: "Delivery notes", href: "/erp/accounting-module/delivery-notes" },
                { name: "Cash receipt", href: "/erp/accounting-module/cash-receipt" },
                { name: "Bank reconciliation", href: "/erp/accounting-module/bank-reconciliation" },
                { name: "Factoring", href: "/erp/accounting-module/factoring" },
                { name: "Withholdings", href: "/erp/accounting-module/withholdings" },
                { name: "Petty cash", href: "/erp/accounting-module/petty-cash" },
                { name: "Accounts receivable", href: "/erp/accounting-module/accounts-receivable" },
                { name: "Income statement", href: "/erp/accounting-module/income-statement" },
            ],
        },
        {
            key: "produccion",
            label: "Production",
            icon: FiSettings,
            visible: canSeeOrders,
            items: [
                { name: "Scheduling", href: "/produccion/programacion" },
                { name: "Initial approval", href: "/produccion/aprobacion-inicial" },
                { name: "History", href: "/produccion/historial" },
                { name: "Edit", href: "/produccion/modificar" },
                { name: "Block", href: "/produccion/bloquear" },
                { name: "Warranties", href: "/produccion/garantias" },
            ],
        },
        {
            key: "maestros",
            label: "Master Data",
            icon: FiDatabase,
            visible: canSeeClients || canSeeSuppliers || canSeeCatalog || canSeePayments,
            items: [
                { name: "Products", href: "/maestros/productos" },
                { name: "Clients", href: "/maestros/clientes" },
                { name: "Suppliers", href: "/maestros/proveedores" },
                { name: "Banks", href: "/maestros/bancos" },
                { name: "Confectionists", href: "/confectionists" },
                { name: "Packing", href: "/packers" },
                { name: "Pattern board", href: "/patterns/tablero" },
                { name: "Patterns & molds", href: "/patterns/trazos-moldes" },
                { name: "Molding templates", href: "/molding" },
            ],
        },
        {
            key: "costos",
            label: "Costs",
            icon: FiGrid,
            visible: true,
            items: [{ name: "Budgets", href: "/costs/presupuestos" }],
        },
        {
            key: "juridica",
            label: "Legal",
            icon: FiShield,
            visible: true,
            items: [
                { name: "Legal", href: "/legal" },
            ],
        },
        {
            key: "rh",
            label: "HR",
            icon: FiUsers,
            visible: true,
            items: [
                { name: "Non-compliance", href: "/erp/hr/non-compliance" },
                { name: "Overtime", href: "/erp/hr/overtime" },
                { name: "Vacations", href: "/erp/hr/vacations" },
                { name: "Settlement", href: "/erp/hr/settlement" },
                { name: "Commissions", href: "/erp/hr/commissions" },
                { name: "Bonuses", href: "/erp/hr/bonuses" },
                { name: "Per diem", href: "/erp/hr/per-diem" },
                { name: "Payroll provisions", href: "/erp/hr/payroll-provisions" },
                { name: "Leaves & absences", href: "/erp/hr/leaves-and-absences" },
                { name: "Social security (PILA)", href: "/erp/hr/social-security-pila" },
            ],
        },
    ];
};

export const buildNavbarOtherItems = ({
    isAuthenticated,
    isAdmin,
}: BuildOtherItemsArgs): SectionItem[] => {
    if (!isAuthenticated) return [];

    const items: SectionItem[] = [
        { name: "Home", href: "/home" },
        { name: "Notifications", href: "/notifications" },
        { name: "Options", href: "/options" },
        { name: "Shipments", href: "/envios" },
    ];

    if (isAdmin) {
        items.push({ name: "Administration", href: "/admin" });
    }

    return items;
};
