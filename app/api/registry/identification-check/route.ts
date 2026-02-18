import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { clients, employees } from "@/src/db/schema";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

type ModuleName = "client" | "employee";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "registry:identification-check:get",
    limit: 180,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const identification = String(searchParams.get("identification") ?? "").trim();
  const moduleName = String(searchParams.get("module") ?? "").trim() as ModuleName;
  const excludeId = String(searchParams.get("excludeId") ?? "").trim();

  if (!identification) {
    return new Response("identification es requerido", { status: 400 });
  }

  if (moduleName !== "client" && moduleName !== "employee") {
    return new Response("module inválido", { status: 400 });
  }

  const forbidden = await requirePermission(
    request,
    moduleName === "client" ? "VER_CLIENTE" : "VER_EMPLEADO",
  );

  if (forbidden) return forbidden;

  if (moduleName === "client") {
    const same = await db
      .select({
        id: clients.id,
        name: clients.name,
        identification: clients.identification,
      })
      .from(clients)
      .where(eq(clients.identification, identification));

    const sameFiltered = excludeId
      ? same.filter((item) => item.id !== excludeId)
      : same;

    const other = await db
      .select({
        id: employees.id,
        name: employees.name,
        identificationType: employees.identificationType,
        identification: employees.identification,
        dv: employees.dv,
        email: employees.email,
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
      .where(eq(employees.identification, identification))
      .limit(1);

    return Response.json({
      sameModule: sameFiltered[0]
        ? {
            module: "client",
            id: sameFiltered[0].id,
            name: sameFiltered[0].name,
            message: "La identificación ya existe en clientes",
          }
        : null,
      otherModule: other[0]
        ? {
            module: "employee",
            message:
              "La identificación ya existe en empleados. ¿Deseas importar sus datos?",
            data: other[0],
          }
        : null,
    });
  }

  const same = await db
    .select({
      id: employees.id,
      name: employees.name,
      identification: employees.identification,
    })
    .from(employees)
    .where(eq(employees.identification, identification));

  const sameFiltered = excludeId
    ? same.filter((item) => item.id !== excludeId)
    : same;

  const other = await db
    .select({
      id: clients.id,
      name: clients.name,
      identificationType: clients.identificationType,
      identification: clients.identification,
      dv: clients.dv,
      email: clients.email,
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
    .where(eq(clients.identification, identification))
    .limit(1);

  return Response.json({
    sameModule: sameFiltered[0]
      ? {
          module: "employee",
          id: sameFiltered[0].id,
          name: sameFiltered[0].name,
          message: "La identificación ya existe en empleados",
        }
      : null,
    otherModule: other[0]
      ? {
          module: "client",
          message:
            "La identificación ya existe en clientes. ¿Deseas importar sus datos?",
          data: other[0],
        }
      : null,
  });
}
