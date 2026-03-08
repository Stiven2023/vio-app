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
            label: "Compras",
            icon: FiShoppingCart,
            visible: canSeeCatalog || canSeePurchaseOrders || canSeeSuppliers || canSeeStatusHistory,
            items: [
                { name: "Bodega", href: "/compras/bodega" },
                { name: "Historial", href: "/compras/historial" },
                { name: "Inventario - Insumos", href: "/compras/inventario/insumos" },
                { name: "Inventario - Papeleria", href: "/compras/inventario/papeleria" },
                { name: "Inventario - Aseo", href: "/compras/inventario/aseo" },
                { name: "Inventario - Repuestos", href: "/compras/inventario/repuestos" },
                { name: "Confecciones", href: "/compras/confecciones" },
                { name: "Empaque", href: "/compras/empaque" },
                { name: "Mensajeros", href: "/compras/mensajeros" },
                { name: "Conductor", href: "/compras/conductor" },
                { name: "Despacho", href: "/compras/despacho" },
                        { name: "Ordenes de compra", href: "/purchase-orders" },
            ],
        },
        {
            key: "comercial",
            label: "Comercial",
            icon: FiBriefcase,
            visible: canSeeOrders || canSeePayments || canSeeCatalog,
            items: [
                { name: "Cotizaciones", href: "/quotations" },
                { name: "Pagos", href: "/comercial/pagos" },
                { name: "Catalogo", href: "/comercial/catalogo" },
                { name: "Pedidos", href: "/comercial/pedidos" },
                { name: "Prefacturas", href: "/comercial/prefacturas" },
                { name: "Historial de produccion", href: "/comercial/historial-produccion" },
                { name: "Visualizar", href: "/comercial/visualizar" },
                { name: "Garantias internas", href: "/comercial/garantias/interna" },
                { name: "Garantias externas", href: "/comercial/garantias/externa" },
            ],
        },
        {
            key: "contabilidad",
            label: "Contabilidad",
            icon: FiDollarSign,
            visible: canSeeOrders,
            items: [
                { name: "Prefacturas", href: "/contabilidad-modulo/prefacturas" },
                { name: "Consignaciones", href: "/contabilidad-modulo/consignaciones" },
                { name: "Facturas", href: "/contabilidad-modulo/facturas" },
                { name: "Remisiones", href: "/contabilidad-modulo/remisiones" },
                { name: "Recibo de caja", href: "/contabilidad-modulo/recibo-caja" },
                { name: "Caja menor", href: "/contabilidad-modulo/caja-menor" },
                { name: "Cartera", href: "/contabilidad-modulo/cartera" },
                { name: "Bancos: salidas y entregas", href: "/contabilidad-modulo/bancos-salidas-entregas" },
                { name: "Estado de resultados", href: "/contabilidad-modulo/estado-resultados" },
            ],
        },
        {
            key: "produccion",
            label: "Produccion",
            icon: FiSettings,
            visible: canSeeOrders,
            items: [
                { name: "Programacion", href: "/produccion/programacion" },
                { name: "Aprobacion inicial", href: "/produccion/aprobacion-inicial" },
                { name: "Historial", href: "/produccion/historial" },
                { name: "Modificar", href: "/produccion/modificar" },
                { name: "Bloquear", href: "/produccion/bloquear" },
                { name: "Garantias", href: "/produccion/garantias" },
            ],
        },
        {
            key: "maestros",
            label: "Maestros",
            icon: FiDatabase,
            visible: canSeeClients || canSeeSuppliers || canSeeCatalog,
            items: [
                { name: "Productos", href: "/maestros/productos" },
                { name: "Clientes", href: "/maestros/clientes" },
                { name: "Proveedores", href: "/maestros/proveedores" },
                { name: "Confeccionistas", href: "/confectionists" },
                { name: "Empaque", href: "/packers" },
                { name: "Bancos", href: "/maestros/bancos" },
            ],
        },
        {
            key: "costos",
            label: "Costos",
            icon: FiGrid,
            visible: true,
            items: [{ name: "Presupuestos", href: "/costos/presupuestos" }],
        },
        {
            key: "juridica",
            label: "Juridica",
            icon: FiShield,
            visible: true,
            items: [
                { name: "Documentos clientes", href: "/juridica/documentos-clientes" },
                { name: "Documentos empleados", href: "/juridica/documentos-empleados" },
                { name: "Documentos terceros", href: "/juridica/documentos-terceros" },
            ],
        },
        {
            key: "molderia",
            label: "Molderia",
            icon: FiGrid,
            visible: true,
            items: [
                { name: "Tablero molderia", href: "/molderia/tablero" },
                { name: "Trazos y moldes", href: "/molderia/trazos-moldes" },
            ],
        },
        {
            key: "rh",
            label: "RH",
            icon: FiUsers,
            visible: true,
            items: [
                { name: "Incumplimiento", href: "/rh/incumplimiento" },
                { name: "Trabajo extra", href: "/rh/trabajo-extra" },
                { name: "Vacaciones", href: "/rh/vacaciones" },
                { name: "Liquidacion", href: "/rh/liquidacion" },
                { name: "Comisiones", href: "/rh/comisiones" },
                { name: "Bonos", href: "/rh/bonos" },
                { name: "Viaticos", href: "/rh/viaticos" },
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


        { name: "Notificaciones", href: "/notifications" },
        { name: "Opciones", href: "/options" },
        { name: "Envios", href: "/envios" },
    ];

    if (isAdmin) {
        items.push({ name: "Administracion", href: "/admin" });
    }

    return items;
};
