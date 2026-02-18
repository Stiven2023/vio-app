import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

import { db } from "@/src/db";
import { clients, employees, users } from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

function formatMobile(intlCode: string, mobile: string): string {
  const clean = mobile.replace(/\s/g, "");
  const code = intlCode.replace(/\+/g, "").trim();

  if (code === "57" && clean.length === 10) {
    return `+${code} ${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6, 8)} ${clean.slice(8)}`;
  }

  const parts: string[] = [];
  for (let i = 0; i < clean.length; i += 3) {
    parts.push(clean.slice(i, i + 3));
  }

  return `+${code} ${parts.join(" ")}`;
}

function isValidUserPassword(password: string): boolean {
  return (
    password.length >= 7 &&
    /[A-Z]/.test(password) &&
    /^[A-Za-z0-9.*]+$/.test(password)
  );
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "employees:get",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_EMPLEADO");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(searchParams);
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(employees);

    const items = await db
      .select()
      .from(employees)
      .orderBy(employees.createdAt)
      .limit(pageSize)
      .offset(offset);
    const hasNextPage = offset + items.length < total;

    return Response.json({ items, page, pageSize, total, hasNextPage });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo consultar empleados", { status: 500 });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "employees:post",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_EMPLEADO");

  if (forbidden) return forbidden;

  const payload = await request.json();

  const name = String(payload.name ?? "").trim();
  const identificationType = String(payload.identificationType ?? "").trim();
  const identification = String(payload.identification ?? "").trim();
  const email = String(payload.email ?? "").trim();

  if (!name || !identificationType || !identification || !email) {
    return new Response(
      "name, identificationType, identification y email son requeridos",
      { status: 400 },
    );
  }

  if (identificationType === "CC" && !/^\d{6,10}$/.test(identification)) {
    return new Response("La CC debe tener entre 6 y 10 dígitos", {
      status: 400,
    });
  }

  if (identificationType === "NIT" && !/^\d{8,12}$/.test(identification)) {
    return new Response("El NIT debe tener entre 8 y 12 dígitos", {
      status: 400,
    });
  }

  if (
    identificationType === "CE" &&
    !/^[A-Za-z0-9]{5,15}$/.test(identification)
  ) {
    return new Response(
      "La CE debe tener entre 5 y 15 caracteres alfanuméricos",
      { status: 400 },
    );
  }

  const intlDialCode = String(payload.intlDialCode ?? "57").trim();
  const mobile = payload.mobile ? String(payload.mobile).trim() : null;
  const fullMobile = mobile ? formatMobile(intlDialCode, mobile) : null;

  try {
    const sameEmployee = await db
      .select({ id: employees.id })
      .from(employees)
      .where(eq(employees.identification, identification))
      .limit(1);

    if (sameEmployee.length > 0) {
      return new Response(
        "La identificación ya existe en empleados. No se puede crear duplicado.",
        { status: 409 },
      );
    }

    const sameClient = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.identification, identification))
      .limit(1);

    if (sameClient.length > 0) {
      return new Response(
        "La identificación ya existe en clientes. Importa los datos desde ese módulo para continuar.",
        { status: 409 },
      );
    }

    // Generar employeeCode autoincrementado
    const lastEmployee = await db
      .select({ employeeCode: employees.employeeCode })
      .from(employees)
      .orderBy(sql`${employees.employeeCode} DESC`)
      .limit(1);

    let nextNumber = 1001;
    if (lastEmployee.length > 0 && lastEmployee[0]?.employeeCode) {
      const lastCode = lastEmployee[0].employeeCode;
      const lastNumber = parseInt(lastCode.replace(/^EMP/i, ""), 10);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    const employeeCode = `EMP${nextNumber}`;

    let userId: string | null = payload.userId
      ? String(payload.userId).trim()
      : null;

    const createUser = payload.createUser;

    if (!userId && createUser) {
      const userEmail = String(createUser.email ?? "")
        .trim()
        .toLowerCase();
      const userPassword = String(createUser.password ?? "").trim();

      if (!userEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) {
        return new Response("Email de usuario inválido", { status: 400 });
      }

      if (!isValidUserPassword(userPassword)) {
        return new Response(
          "Contraseña inválida: mínimo 7, 1 mayúscula, solo letras, números, . y *",
          { status: 400 },
        );
      }

      const existingUser = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, userEmail))
        .limit(1);

      if (existingUser.length > 0) {
        return new Response("Ya existe un usuario con ese email", {
          status: 409,
        });
      }

      const passwordHash = await bcrypt.hash(userPassword, 10);
      const createdUser = await db
        .insert(users)
        .values({
          email: userEmail,
          passwordHash,
          emailVerified: true,
          isActive: true,
        })
        .returning({ id: users.id });

      userId = createdUser[0]?.id ?? null;
    }

    const newEmployee = await db
      .insert(employees)
      .values({
        employeeCode,
        userId,
        name,
        identificationType: identificationType as
          | "CC"
          | "NIT"
          | "CE"
          | "PAS"
          | "EMPRESA_EXTERIOR",
        identification,
        dv: payload.dv ? String(payload.dv).trim() : null,
        email,
        intlDialCode,
        mobile,
        fullMobile,
        landline: payload.landline ? String(payload.landline).trim() : null,
        extension: payload.extension ? String(payload.extension).trim() : null,
        address: payload.address ? String(payload.address).trim() : null,
        city: payload.city ? String(payload.city).trim() : "Medellín",
        department: payload.department
          ? String(payload.department).trim()
          : "ANTIOQUIA",
        roleId: payload.roleId ? String(payload.roleId).trim() : null,
        isActive: payload.isActive ?? true,
      })
      .returning();

    return Response.json(newEmployee);
  } catch (e: unknown) {
    const code =
      typeof e === "object" && e && "code" in e
        ? (e as { code?: string }).code
        : undefined;

    if (code === "23505") {
      return new Response("La identificación ya existe", { status: 409 });
    }

    return new Response("No se pudo crear empleado", { status: 500 });
  }
}

export async function PUT(request: Request) {
  const limited = rateLimit(request, {
    key: "employees:put",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_EMPLEADO");

  if (forbidden) return forbidden;

  const payload = await request.json();
  const { id } = payload;

  if (!id) {
    return new Response("Employee ID required", { status: 400 });
  }
  const patch: Partial<typeof employees.$inferInsert> = {};

  if (payload.userId !== undefined)
    patch.userId = payload.userId ? String(payload.userId).trim() : null;
  if (payload.name !== undefined) patch.name = String(payload.name).trim();
  if (payload.identificationType !== undefined)
    patch.identificationType = String(payload.identificationType).trim() as
      | "CC"
      | "NIT"
      | "CE"
      | "PAS"
      | "EMPRESA_EXTERIOR";
  if (payload.identification !== undefined)
    patch.identification = String(payload.identification).trim();
  if (payload.dv !== undefined)
    patch.dv = payload.dv ? String(payload.dv).trim() : null;
  if (payload.email !== undefined) patch.email = String(payload.email).trim();
  if (payload.intlDialCode !== undefined)
    patch.intlDialCode = payload.intlDialCode
      ? String(payload.intlDialCode).trim()
      : null;
  if (payload.mobile !== undefined)
    patch.mobile = payload.mobile ? String(payload.mobile).trim() : null;

  if (payload.mobile !== undefined || payload.intlDialCode !== undefined) {
    const intl = payload.intlDialCode
      ? String(payload.intlDialCode).trim()
      : "57";
    const mobile = payload.mobile ? String(payload.mobile).trim() : null;
    patch.fullMobile = mobile ? formatMobile(intl, mobile) : null;
  }

  if (payload.landline !== undefined)
    patch.landline = payload.landline ? String(payload.landline).trim() : null;
  if (payload.extension !== undefined)
    patch.extension = payload.extension
      ? String(payload.extension).trim()
      : null;
  if (payload.address !== undefined)
    patch.address = payload.address ? String(payload.address).trim() : null;
  if (payload.city !== undefined)
    patch.city = payload.city ? String(payload.city).trim() : null;
  if (payload.department !== undefined)
    patch.department = payload.department
      ? String(payload.department).trim()
      : null;
  if (payload.roleId !== undefined)
    patch.roleId = payload.roleId ? String(payload.roleId).trim() : null;
  if (payload.isActive !== undefined) patch.isActive = Boolean(payload.isActive);

  try {
    if (patch.identification) {
      const duplicatedEmployee = await db
        .select({ id: employees.id })
        .from(employees)
        .where(eq(employees.identification, patch.identification))
        .limit(1);

      if (duplicatedEmployee[0] && duplicatedEmployee[0].id !== String(id)) {
        return new Response(
          "La identificación ya existe en empleados. No se puede duplicar.",
          { status: 409 },
        );
      }

      const duplicatedClient = await db
        .select({ id: clients.id })
        .from(clients)
        .where(eq(clients.identification, patch.identification))
        .limit(1);

      if (duplicatedClient.length > 0) {
        return new Response(
          "La identificación ya existe en clientes. Importa los datos desde ese módulo para continuar.",
          { status: 409 },
        );
      }
    }

    const updated = await db
      .update(employees)
      .set(patch)
      .where(eq(employees.id, String(id)))
      .returning();

    return Response.json(updated);
  } catch (e: unknown) {
    const code =
      typeof e === "object" && e && "code" in e
        ? (e as { code?: string }).code
        : undefined;

    if (code === "23505") {
      return new Response("La identificación ya existe", { status: 409 });
    }

    return new Response("No se pudo actualizar empleado", { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const limited = rateLimit(request, {
    key: "employees:delete",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "ELIMINAR_EMPLEADO");

  if (forbidden) return forbidden;

  const { id } = await request.json();

  if (!id) {
    return new Response("Employee ID required", { status: 400 });
  }
  const deleted = await db
    .delete(employees)
    .where(eq(employees.id, id))
    .returning();

  return Response.json(deleted);
}
