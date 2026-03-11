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
                { name: "Estados de resultados", href: "/dashboard#estados-resultados" },
                { name: "Comisiones", href: "/dashboard#comisiones" },
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
                { name: "Pre-invoices", href: "/contabilidad-modulo/prefacturas" },
                { name: "Deposits", href: "/contabilidad-modulo/consignaciones" },
                { name: "Invoices", href: "/contabilidad-modulo/facturas" },
                { name: "Delivery notes", href: "/contabilidad-modulo/remisiones" },
                { name: "Cash receipt", href: "/contabilidad-modulo/recibo-caja" },
                { name: "Petty cash", href: "/contabilidad-modulo/caja-menor" },
                { name: "Accounts receivable", href: "/contabilidad-modulo/cartera" },
                { name: "Banks", href: "/contabilidad-modulo/bancos-salidas-entregas" },
                { name: "Income statement", href: "/contabilidad-modulo/estado-resultados" },
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
            visible: canSeeClients || canSeeSuppliers || canSeeCatalog,
            items: [
                { name: "Products", href: "/maestros/productos" },
                { name: "Clients", href: "/maestros/clientes" },
                { name: "Suppliers", href: "/maestros/proveedores" },
                { name: "Confectionists", href: "/confectionists" },
                { name: "Packing", href: "/packers" },
                { name: "Pattern board", href: "/molderia/tablero" },
                { name: "Patterns & molds", href: "/molderia/trazos-moldes" },
            ],
        },
        {
            key: "costos",
            label: "Costs",
            icon: FiGrid,
            visible: true,
            items: [{ name: "Budgets", href: "/costos/presupuestos" }],
        },
        {
            key: "juridica",
            label: "Legal",
            icon: FiShield,
            visible: true,
            items: [
                { name: "Legal", href: "/juridica" },
            ],
        },
        {
            key: "rh",
            label: "RH",
            icon: FiUsers,
            visible: true,
            items: [
                { name: "Incumplimiento", href: "/rh/incumplimiento" },
                { name: "Overtime", href: "/rh/trabajo-extra" },
                { name: "Vacations", href: "/rh/vacaciones" },
                { name: "Settlement", href: "/rh/liquidacion" },
                { name: "Commissions", href: "/rh/comisiones" },
                { name: "Bonuses", href: "/rh/bonos" },
                { name: "Per diem", href: "/rh/viaticos" },
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
        { name: "Home", href: "/" },
        { name: "Notifications", href: "/notifications" },
        { name: "Options", href: "/options" },
        { name: "Shipments", href: "/envios" },
    ];

    if (isAdmin) {
        items.push({ name: "Administration", href: "/admin" });
    }

    return items;
};
