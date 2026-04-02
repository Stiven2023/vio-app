import { asc, eq } from "drizzle-orm";

import { db } from "@/src/db";
import {
  banks,
  confectionists,
  employees,
  inventoryItemVariants,
  inventoryItems,
  packers,
  roles,
  suppliers,
} from "@/src/db/erp/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "purchase-orders:options",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_ORDEN_COMPRA");

  if (forbidden) return forbidden;

  try {
    const [
      supplierRows,
      itemRows,
      variantRows,
      bankRows,
      confectionistRows,
      packerRows,
      employeeRows,
    ] = await Promise.all([
      db
        .select({
          id: suppliers.id,
          name: suppliers.name,
          supplierCode: suppliers.supplierCode,
          contactName: suppliers.contactName,
          email: suppliers.email,
          identification: suppliers.identification,
          mobile: suppliers.mobile,
          fullMobile: suppliers.fullMobile,
          address: suppliers.address,
          city: suppliers.city,
          department: suppliers.department,
          isActive: suppliers.isActive,
        })
        .from(suppliers)
        .orderBy(asc(suppliers.name)),
      db
        .select({
          id: inventoryItems.id,
          itemCode: inventoryItems.itemCode,
          name: inventoryItems.name,
          unit: inventoryItems.unit,
          price: inventoryItems.price,
          hasVariants: inventoryItems.hasVariants,
        })
        .from(inventoryItems)
        .orderBy(asc(inventoryItems.name)),
      db
        .select({
          id: inventoryItemVariants.id,
          inventoryItemId: inventoryItemVariants.inventoryItemId,
          sku: inventoryItemVariants.sku,
          color: inventoryItemVariants.color,
          size: inventoryItemVariants.size,
        })
        .from(inventoryItemVariants)
        .where(eq(inventoryItemVariants.isActive, true))
        .orderBy(asc(inventoryItemVariants.sku)),
      db
        .select({
          id: banks.id,
          code: banks.code,
          name: banks.name,
          accountRef: banks.accountRef,
          isActive: banks.isActive,
        })
        .from(banks)
        .orderBy(asc(banks.name)),
      db
        .select({
          id: confectionists.id,
          confectionistCode: confectionists.confectionistCode,
          name: confectionists.name,
          contactName: confectionists.contactName,
          fullMobile: confectionists.fullMobile,
          address: confectionists.address,
          city: confectionists.city,
          department: confectionists.department,
          isActive: confectionists.isActive,
        })
        .from(confectionists)
        .orderBy(asc(confectionists.name)),
      db
        .select({
          id: packers.id,
          packerCode: packers.packerCode,
          name: packers.name,
          contactName: packers.contactName,
          fullMobile: packers.fullMobile,
          address: packers.address,
          city: packers.city,
          department: packers.department,
          isActive: packers.isActive,
        })
        .from(packers)
        .orderBy(asc(packers.name)),
      db
        .select({
          id: employees.id,
          code: employees.employeeCode,
          name: employees.name,
          roleName: roles.name,
          fullMobile: employees.fullMobile,
          isActive: employees.isActive,
        })
        .from(employees)
        .leftJoin(roles, eq(employees.roleId, roles.id))
        .orderBy(asc(employees.name)),
    ]);

    // Group variants by item
    const variantsByItem = new Map<string, typeof variantRows>();

    for (const v of variantRows) {
      const list = variantsByItem.get(v.inventoryItemId) ?? [];

      list.push(v);
      variantsByItem.set(v.inventoryItemId, list);
    }
    const itemsWithVariants = itemRows.map((item) => ({
      ...item,
      variants: variantsByItem.get(item.id) ?? [],
    }));

    const dispatchers = employeeRows.filter(
      (row) => row.roleName === "OPERARIO_DESPACHO",
    );
    // Merge messengers + drivers (conductors) into a single "envios" list (deduplicated by id)
    const enviosMap = new Map<string, (typeof employeeRows)[number]>();

    for (const row of employeeRows) {
      if (
        row.roleName === "MENSAJERO" ||
        row.roleName === "CONDUCTOR" ||
        String(row.name ?? "")
          .toUpperCase()
          .includes("CONDUCTOR")
      ) {
        enviosMap.set(row.id, row);
      }
    }
    const envios = Array.from(enviosMap.values());

    const messengers = employeeRows.filter(
      (row) => row.roleName === "MENSAJERO",
    );

    return Response.json({
      suppliers: supplierRows,
      inventoryItems: itemsWithVariants,
      banks: bankRows,
      confectionists: confectionistRows,
      packers: packerRows,
      envios,
      dispatchers,
      messengers,
    });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudieron cargar opciones", { status: 500 });
  }
}
