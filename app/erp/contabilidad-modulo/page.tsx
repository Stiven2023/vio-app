import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { AccountingHubTabs } from "./_components/accounting-hub-tabs";

import { checkPermissions } from "@/src/utils/permission-middleware";

type AccessMap = Record<string, boolean>;

type AccountingAccessLink = {
  title: string;
  href: string;
  description: string;
  enabled: boolean;
};

type AccountingGroup = {
  key: string;
  title: string;
  description: string;
  items: AccountingAccessLink[];
};

export default async function AccountingLandingPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const perms = (await checkPermissions(req, [
    "VER_PEDIDO",
    "VER_RECIBO_CAJA",
    "VER_CONCILIACION_BANCARIA",
    "VER_RETENCIONES",
    "VER_FACTORING",
    "VER_CARTERA",
    "VER_ESTADO_RESULTADOS",
    "VER_CAJA_MENOR",
  ])) as AccessMap;

  const groups: AccountingGroup[] = [
    {
      key: "docs",
      title: "Documentos comerciales",
      description: "Emisión y control documental de ventas.",
      items: [
        {
          title: "Facturas",
          href: "/erp/contabilidad-modulo/facturas",
          description: "Gestión de facturación final.",
          enabled: Boolean(perms.VER_PEDIDO),
        },
        {
          title: "Remisiones",
          href: "/erp/contabilidad-modulo/remisiones",
          description: "Control de despachos y soportes.",
          enabled: Boolean(perms.VER_PEDIDO),
        },
        {
          title: "Retenciones",
          href: "/erp/contabilidad-modulo/retenciones",
          description: "Retefuente, reteICA y reteIVA.",
          enabled: Boolean(perms.VER_RETENCIONES),
        },
      ],
    },
    {
      key: "cash-banks",
      title: "Recaudo y bancos",
      description: "Ingreso de pagos y control de extractos.",
      items: [
        {
          title: "Recibo de caja",
          href: "/erp/contabilidad-modulo/recibo-caja",
          description: "Aplicación de recaudos por cliente.",
          enabled: Boolean(perms.VER_RECIBO_CAJA),
        },
        {
          title: "Consignaciones",
          href: "/erp/depositos",
          description: "Depósitos, abonos y macro contable.",
          enabled: Boolean(perms.VER_PEDIDO),
        },
        {
          title: "Extractos bancarios",
          href: "/erp/contabilidad-modulo/extractos-bancarios",
          description: "Base para conciliación por período.",
          enabled: Boolean(perms.VER_CONCILIACION_BANCARIA),
        },
      ],
    },
    {
      key: "receivables",
      title: "Cartera y recuperación",
      description: "Seguimiento de cuentas por cobrar.",
      items: [
        {
          title: "Cartera",
          href: "/erp/contabilidad-modulo/cartera",
          description: "Cartera por cliente y vencimientos.",
          enabled: Boolean(perms.VER_CARTERA),
        },
        {
          title: "Factorización",
          href: "/erp/contabilidad-modulo/factoring",
          description: "Control de cesión de cartera.",
          enabled: Boolean(perms.VER_FACTORING),
        },
      ],
    },
    {
      key: "close-control",
      title: "Cierre y control",
      description: "Visión de resultados y gastos operativos.",
      items: [
        {
          title: "Caja menor",
          href: "/erp/contabilidad-modulo/caja-menor",
          description: "Fondos y movimientos menores.",
          enabled: Boolean(perms.VER_CAJA_MENOR),
        },
        {
          title: "Estado de resultados",
          href: "/erp/contabilidad-modulo/estado-resultados",
          description: "Pérdidas y ganancias por período.",
          enabled: Boolean(perms.VER_ESTADO_RESULTADOS),
        },
      ],
    },
  ];

  const visibleGroups = groups
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => item.enabled)
        .map((item) => ({
          title: item.title,
          href: item.href,
          description: item.description,
        })),
    }))
    .filter((group) => group.items.length > 0);

  const hasAnyAccess = groups.some((group) =>
    group.items.some((item) => item.enabled),
  );

  if (!hasAnyAccess) redirect("/unauthorized");

  return (
    <div className="container mx-auto max-w-7xl px-6 pt-16 pb-10 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Contabilidad</h1>
        <p className="text-default-600">
          Accesos agrupados por bloque operativo para ejecutar el ciclo
          contable completo.
        </p>
      </header>

      <AccountingHubTabs groups={visibleGroups} />
    </div>
  );
}
