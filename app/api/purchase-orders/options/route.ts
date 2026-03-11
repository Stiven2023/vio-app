import { asc, eq } from "drizzle-orm";

import { db } from "@/src/db";
import {
  banks,
  confectionists,
  employees,
  inventoryItems,
  packers,
  roles,
  suppliers,
} from "@/src/db/schema";
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
        })
        .from(inventoryItems)
        .orderBy(asc(inventoryItems.name)),
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

    const messengers = employeeRows.filter((row) => row.roleName === "MENSAJERO");
    const dispatchers = employeeRows.filter((row) => row.roleName === "OPERARIO_DESPACHO");
    const drivers = employeeRows.filter(
      (row) =>
        row.roleName === "MENSAJERO" ||
        row.roleName === "OPERARIO_DESPACHO" ||
        String(row.name ?? "").toUpperCase().includes("CONDUCTOR"),
    );

    return Response.json({
      suppliers: supplierRows,
      inventoryItems: itemRows,
      banks: bankRows,
      confectionists: confectionistRows,
      packers: packerRows,
      messengers,
      drivers,
      dispatchers,
    });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudieron cargar opciones", { status: 500 });
  }
}
