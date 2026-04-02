import bcrypt from "bcryptjs";
import { and, desc, eq, inArray, isNotNull, like } from "drizzle-orm";

import { db } from "@/src/db";
import { employees, roles, users } from "@/src/db/erp/schema";
import { getRoleFromRequest } from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { rateLimit } from "@/src/utils/rate-limit";
import { normalizeUsername } from "@/src/utils/username";

const THIRD_ROLES = ["CONFECCIONISTA", "EMPAQUE"] as const;

type ThirdRole = (typeof THIRD_ROLES)[number];

function str(value: unknown) {
  return String(value ?? "").trim();
}

function requireAdmin(request: Request) {
  const role = getRoleFromRequest(request);

  if (role !== "ADMINISTRADOR") {
    return new Response("Forbidden", { status: 403 });
  }

  return null;
}

function makeUsername(role: ThirdRole, slot: number) {
  const base = role.toLowerCase();

  return normalizeUsername(`${base}${slot}`);
}

async function buildNextEmployeeCode() {
  const [lastEmployee] = await db
    .select({ employeeCode: employees.employeeCode })
    .from(employees)
    .where(like(employees.employeeCode, "EMP%"))
    .orderBy(desc(employees.employeeCode))
    .limit(1);

  let nextNumber = 1001;

  if (lastEmployee?.employeeCode) {
    const parsed = Number(
      String(lastEmployee.employeeCode).replace(/^EMP/i, ""),
    );

    if (Number.isFinite(parsed) && parsed > 0) {
      nextNumber = parsed + 1;
    }
  }

  return `EMP${nextNumber}`;
}

async function buildUniqueIdentification(base: number) {
  let candidate = base;

  for (let attempts = 0; attempts < 100; attempts += 1) {
    const [exists] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(eq(employees.identification, String(candidate)))
      .limit(1);

    if (!exists) return String(candidate);
    candidate += 1;
  }

  throw new Error("No se pudo generar identificación única");
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "third-party-accounts:get",
    limit: 80,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = requireAdmin(request);

  if (forbidden) return forbidden;

  try {
    const roleRows = await db
      .select({ id: roles.id, name: roles.name })
      .from(roles)
      .where(inArray(roles.name, [...THIRD_ROLES] as string[]));

    const roleIdSet = new Set(roleRows.map((roleRow) => roleRow.id));

    const rows = await db
      .select({
        employeeId: employees.id,
        employeeName: employees.name,
        roleId: employees.roleId,
        userId: users.id,
        username: users.username,
        email: users.email,
        isActive: employees.isActive,
      })
      .from(employees)
      .leftJoin(users, eq(employees.userId, users.id))
      .where(
        and(
          isNotNull(employees.userId),
          inArray(employees.roleId, [...roleIdSet] as string[]),
        ),
      );

    return Response.json({ items: rows });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudieron consultar cuentas de terceros", {
      status: 500,
    });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "third-party-accounts:post",
    limit: 40,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = requireAdmin(request);

  if (forbidden) return forbidden;

  const body = await request.json();

  const role = str(body.role).toUpperCase() as ThirdRole;
  const slot = Math.max(1, Number(body.slot ?? 1));
  const password = str(body.password);

  if (!THIRD_ROLES.includes(role)) {
    return new Response("role inválido", { status: 400 });
  }

  if (
    !password ||
    password.length < 7 ||
    !/[A-Z]/.test(password) ||
    /[^A-Za-z0-9.*]/.test(password)
  ) {
    return new Response("Contraseña inválida", { status: 400 });
  }

  try {
    const username = makeUsername(role, slot);
    const email = `${username}@terceros.viomar.local`;

    const [roleRow] = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, role))
      .limit(1);

    if (!roleRow) {
      return new Response(`No existe el rol ${role} en base de datos`, {
        status: 400,
      });
    }

    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    const passwordHash = await bcrypt.hash(password, 10);

    const userId = existingUser?.id
      ? existingUser.id
      : (
          await db
            .insert(users)
            .values({
              username,
              email,
              passwordHash,
              emailVerified: true,
              isActive: true,
            })
            .returning({ id: users.id })
        )[0]?.id;

    if (!userId) {
      return new Response("No se pudo crear usuario", { status: 500 });
    }

    if (existingUser?.id) {
      await db
        .update(users)
        .set({ username, email, passwordHash, isActive: true })
        .where(eq(users.id, userId));
    }

    const [employee] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(eq(employees.userId, userId))
      .limit(1);

    if (!employee) {
      const employeeCode = await buildNextEmployeeCode();
      const baseByRole: Record<ThirdRole, number> = {
        CONFECCIONISTA: 78000000,
        EMPAQUE: 79000000,
      };
      const identification = await buildUniqueIdentification(
        baseByRole[role] + slot,
      );

      await db.insert(employees).values({
        userId,
        employeeCode,
        name: `${role} ${slot}`,
        identificationType: "CC",
        identification,
        email,
        roleId: roleRow.id,
        isActive: true,
      });
    } else {
      await db
        .update(employees)
        .set({
          name: `${role} ${slot}`,
          email,
          roleId: roleRow.id,
          isActive: true,
        })
        .where(eq(employees.id, employee.id));
    }

    return Response.json({
      message: existingUser ? "Contraseña actualizada" : "Cuenta creada",
      username,
      email,
      role,
      slot,
    });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo crear/actualizar la cuenta de tercero", {
      status: 500,
    });
  }
}
