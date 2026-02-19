import { and, eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  clients,
  confectionists,
  employees,
  packers,
  suppliers,
} from "@/src/db/schema";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

type ModuleName =
  | "client"
  | "employee"
  | "confectionist"
  | "supplier"
  | "packer";

type NormalizedRecord = {
  module: ModuleName;
  id: string;
  name: string;
  identificationType: string;
  identification: string;
  dv: string | null;
  email: string | null;
  contactName: string | null;
  intlDialCode: string | null;
  mobile: string | null;
  landline: string | null;
  extension: string | null;
  address: string | null;
  city: string | null;
  department: string | null;
  isActive: boolean | null;
};

const VIEW_PERMISSION_BY_MODULE: Record<ModuleName, string> = {
  client: "VER_CLIENTE",
  employee: "VER_EMPLEADO",
  confectionist: "VER_CONFECCIONISTA",
  supplier: "VER_PROVEEDOR",
  packer: "VER_EMPAQUE",
};

const MODULE_LABEL: Record<ModuleName, string> = {
  client: "clientes",
  employee: "empleados",
  confectionist: "confeccionistas",
  supplier: "proveedores",
  packer: "empaque",
};

async function queryByModule(
  moduleName: ModuleName,
  identificationType: string,
  identification: string,
): Promise<NormalizedRecord[]> {
  if (moduleName === "client") {
    const rows = await db
      .select({
        id: clients.id,
        name: clients.name,
        identificationType: clients.identificationType,
        identification: clients.identification,
        dv: clients.dv,
        email: clients.email,
        contactName: clients.contactName,
        intlDialCode: clients.intlDialCode,
        mobile: clients.mobile,
        landline: clients.landline,
        extension: clients.extension,
        address: clients.address,
        city: clients.city,
        department: clients.department,
        isActive: clients.isActive,
      })
      .from(clients)
      .where(
        and(
          eq(clients.identificationType, identificationType as any),
          eq(clients.identification, identification),
        ),
      );

    return rows.map((item) => ({ module: "client", ...item }));
  }

  if (moduleName === "employee") {
    const rows = await db
      .select({
        id: employees.id,
        name: employees.name,
        identificationType: employees.identificationType,
        identification: employees.identification,
        dv: employees.dv,
        email: employees.email,
        contactName: employees.name,
        intlDialCode: employees.intlDialCode,
        mobile: employees.mobile,
        landline: employees.landline,
        extension: employees.extension,
        address: employees.address,
        city: employees.city,
        department: employees.department,
        isActive: employees.isActive,
      })
      .from(employees)
      .where(
        and(
          eq(employees.identificationType, identificationType as any),
          eq(employees.identification, identification),
        ),
      );

    return rows.map((item) => ({ module: "employee", ...item }));
  }

  if (moduleName === "confectionist") {
    const rows = await db
      .select({
        id: confectionists.id,
        name: confectionists.name,
        identificationType: confectionists.identificationType,
        identification: confectionists.identification,
        dv: confectionists.dv,
        email: confectionists.email,
        contactName: confectionists.contactName,
        intlDialCode: confectionists.intlDialCode,
        mobile: confectionists.mobile,
        landline: confectionists.landline,
        extension: confectionists.extension,
        address: confectionists.address,
        city: confectionists.city,
        department: confectionists.department,
        isActive: confectionists.isActive,
      })
      .from(confectionists)
      .where(
        and(
          eq(confectionists.identificationType, identificationType as any),
          eq(confectionists.identification, identification),
        ),
      );

    return rows.map((item) => ({ module: "confectionist", ...item }));
  }

  if (moduleName === "supplier") {
    const rows = await db
      .select({
        id: suppliers.id,
        name: suppliers.name,
        identificationType: suppliers.identificationType,
        identification: suppliers.identification,
        dv: suppliers.dv,
        email: suppliers.email,
        contactName: suppliers.contactName,
        intlDialCode: suppliers.intlDialCode,
        mobile: suppliers.mobile,
        landline: suppliers.landline,
        extension: suppliers.extension,
        address: suppliers.address,
        city: suppliers.city,
        department: suppliers.department,
        isActive: suppliers.isActive,
      })
      .from(suppliers)
      .where(
        and(
          eq(suppliers.identificationType, identificationType as any),
          eq(suppliers.identification, identification),
        ),
      );

    return rows.map((item) => ({ module: "supplier", ...item }));
  }

  const rows = await db
    .select({
      id: packers.id,
      name: packers.name,
      identificationType: packers.identificationType,
      identification: packers.identification,
      dv: packers.dv,
      email: packers.email,
      contactName: packers.contactName,
      intlDialCode: packers.intlDialCode,
      mobile: packers.mobile,
      landline: packers.landline,
      extension: sql<string | null>`null`,
      address: packers.address,
      city: packers.city,
      department: packers.department,
      isActive: packers.isActive,
    })
    .from(packers)
    .where(
      and(
        eq(packers.identificationType, identificationType as any),
        eq(packers.identification, identification),
      ),
    );

  return rows.map((item) => ({ module: "packer", ...item }));
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "registry:identification-check:get",
    limit: 180,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const identification = String(searchParams.get("identification") ?? "").trim();
  const identificationType = String(
    searchParams.get("identificationType") ?? "",
  ).trim();
  const moduleName = String(searchParams.get("module") ?? "").trim() as ModuleName;
  const excludeId = String(searchParams.get("excludeId") ?? "").trim();

  if (!identification || !identificationType) {
    return new Response("identification e identificationType son requeridos", {
      status: 400,
    });
  }

  if (
    moduleName !== "client" &&
    moduleName !== "employee" &&
    moduleName !== "confectionist" &&
    moduleName !== "supplier" &&
    moduleName !== "packer"
  ) {
    return new Response("module inválido", { status: 400 });
  }

  const sourceForbidden = await requirePermission(
    request,
    VIEW_PERMISSION_BY_MODULE[moduleName],
  );

  if (sourceForbidden) return sourceForbidden;

  const sameModuleRows = await queryByModule(
    moduleName,
    identificationType,
    identification,
  );

  const sameFiltered = excludeId
    ? sameModuleRows.filter((item) => item.id !== excludeId)
    : sameModuleRows;

  const otherModules = (
    ["client", "employee", "confectionist", "supplier", "packer"] as ModuleName[]
  ).filter((module) => module !== moduleName);

  const otherMatches: NormalizedRecord[] = [];

  for (const targetModule of otherModules) {
    const canSeeTarget = await requirePermission(
      request,
      VIEW_PERMISSION_BY_MODULE[targetModule],
    );
    if (canSeeTarget) continue;

    const rows = await queryByModule(targetModule, identificationType, identification);
    if (rows[0]) otherMatches.push(rows[0]);
  }

  const firstOther = otherMatches[0] ?? null;

  return Response.json({
    sameModule: sameFiltered[0]
      ? {
          module: moduleName,
          id: sameFiltered[0].id,
          name: sameFiltered[0].name,
          message: `La identificación ya existe en ${MODULE_LABEL[moduleName]}`,
        }
      : null,
    otherModule: firstOther
      ? {
          module: firstOther.module,
          message: `La identificación ya existe en ${MODULE_LABEL[firstOther.module]}. ¿Deseas importar sus datos?`,
          data: firstOther,
        }
      : null,
    otherModules: otherMatches.map((item) => ({
      module: item.module,
      message: `La identificación ya existe en ${MODULE_LABEL[item.module]}. ¿Deseas importar sus datos?`,
      data: item,
    })),
  });
}
