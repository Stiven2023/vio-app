import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { employees, users } from "@/src/db/schema";
import {
  getUserIdFromRequest,
  getEmployeeIdFromRequest,
} from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
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

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "account:options:get",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        preferredLanguage: users.preferredLanguage,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return new Response("Usuario no encontrado", { status: 404 });
    }

    const employeeId = getEmployeeIdFromRequest(request);
    const employee = employeeId
      ? await db
          .select({
            id: employees.id,
            userId: employees.userId,
            name: employees.name,
            email: employees.email,
            intlDialCode: employees.intlDialCode,
            mobile: employees.mobile,
            fullMobile: employees.fullMobile,
            landline: employees.landline,
            extension: employees.extension,
            address: employees.address,
            city: employees.city,
            department: employees.department,
            employeeImageUrl: employees.employeeImageUrl,
            signatureImageUrl: employees.signatureImageUrl,
          })
          .from(employees)
          .where(eq(employees.id, employeeId))
          .limit(1)
      : [];

    return Response.json({
      user,
      employee: employee[0] ?? null,
    });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo consultar opciones de cuenta", {
      status: 500,
    });
  }
}

export async function PUT(request: Request) {
  const limited = rateLimit(request, {
    key: "account:options:put",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const payload = await request.json();

    const userPatch: Partial<typeof users.$inferInsert> = {};
    const employeePatch: Partial<typeof employees.$inferInsert> = {};

    if (payload.email !== undefined) {
      const email = String(payload.email ?? "")
        .trim()
        .toLowerCase();

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return new Response("Email inválido", { status: 400 });
      }

      userPatch.email = email;
      employeePatch.email = email;
    }

    if (payload.preferredLanguage !== undefined) {
      const preferredLanguage = String(payload.preferredLanguage ?? "")
        .trim()
        .toLowerCase();

      if (preferredLanguage && !["es", "en", "pt"].includes(preferredLanguage)) {
        return new Response("Idioma inválido. Usa: es, en o pt", {
          status: 400,
        });
      }

      userPatch.preferredLanguage = preferredLanguage || "es";
    }

    if (payload.name !== undefined) {
      const name = String(payload.name ?? "").trim();
      if (!name) return new Response("Nombre requerido", { status: 400 });
      employeePatch.name = name;
    }

    if (payload.intlDialCode !== undefined)
      employeePatch.intlDialCode = payload.intlDialCode
        ? String(payload.intlDialCode).trim()
        : null;

    if (payload.mobile !== undefined)
      employeePatch.mobile = payload.mobile ? String(payload.mobile).trim() : null;

    if (payload.mobile !== undefined || payload.intlDialCode !== undefined) {
      const intl = payload.intlDialCode
        ? String(payload.intlDialCode).trim()
        : "57";
      const mobile = payload.mobile ? String(payload.mobile).trim() : null;
      employeePatch.fullMobile = mobile ? formatMobile(intl, mobile) : null;
    }

    if (payload.landline !== undefined)
      employeePatch.landline = payload.landline
        ? String(payload.landline).trim()
        : null;

    if (payload.extension !== undefined)
      employeePatch.extension = payload.extension
        ? String(payload.extension).trim()
        : null;

    if (payload.address !== undefined)
      employeePatch.address = payload.address ? String(payload.address).trim() : null;

    if (payload.city !== undefined)
      employeePatch.city = payload.city ? String(payload.city).trim() : null;

    if (payload.department !== undefined)
      employeePatch.department = payload.department
        ? String(payload.department).trim()
        : null;

    if (payload.employeeImageUrl !== undefined)
      employeePatch.employeeImageUrl = payload.employeeImageUrl
        ? String(payload.employeeImageUrl).trim()
        : null;

    if (payload.signatureImageUrl !== undefined)
      employeePatch.signatureImageUrl = payload.signatureImageUrl
        ? String(payload.signatureImageUrl).trim()
        : null;

    if (Object.keys(userPatch).length > 0) {
      await db.update(users).set(userPatch).where(eq(users.id, userId));
    }

    await db
      .update(employees)
      .set(employeePatch)
      .where(eq(employees.userId, userId));

    const [updatedUser] = await db
      .select({
        id: users.id,
        email: users.email,
        preferredLanguage: users.preferredLanguage,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const [updatedEmployee] = await db
      .select({
        id: employees.id,
        userId: employees.userId,
        name: employees.name,
        email: employees.email,
        intlDialCode: employees.intlDialCode,
        mobile: employees.mobile,
        fullMobile: employees.fullMobile,
        landline: employees.landline,
        extension: employees.extension,
        address: employees.address,
        city: employees.city,
        department: employees.department,
        employeeImageUrl: employees.employeeImageUrl,
        signatureImageUrl: employees.signatureImageUrl,
      })
      .from(employees)
      .where(eq(employees.userId, userId))
      .limit(1);

    return Response.json({
      user: updatedUser ?? null,
      employee: updatedEmployee ?? null,
    });
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error
        ? (error as { code?: string }).code
        : undefined;

    if (code === "23505") {
      return new Response("El email ya está en uso", { status: 409 });
    }

    const response = dbErrorResponse(error);
    if (response) return response;

    return new Response("No se pudo actualizar opciones de cuenta", {
      status: 500,
    });
  }
}
