import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

import { db } from "@/src/db";
import { employees, users } from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { emailVerificationTokens } from "@/src/db/email_verification_tokens";
import { passwordResetTokens } from "@/src/db/password_reset_tokens";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";
import { requirePermission } from "@/src/utils/permission-middleware";
import { verifyEmailVerificationTicket } from "@/src/utils/auth";
import { createUserSchema } from "@/app/admin/_lib/schemas";

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "adminUsers:post",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_USUARIO");

  if (forbidden) return forbidden;

  const body = await request.json();
  const parsed = createUserSchema.safeParse(body);

  if (!parsed.success) {
    return new Response("Datos inválidos", { status: 400 });
  }

  const normalizedEmail = parsed.data.email.trim().toLowerCase();
  const ticketRaw = String((body as any)?.emailVerificationTicket ?? "").trim();

  if (!ticketRaw) {
    return new Response("Email no verificado", { status: 400 });
  }

  const ticket = verifyEmailVerificationTicket(ticketRaw);

  if (!ticket || ticket.email !== normalizedEmail) {
    return new Response("Email no verificado", { status: 400 });
  }

  const exists = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (exists.length > 0) {
    return new Response("User already exists", { status: 409 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  const created = await db
    .insert(users)
    .values({
      email: normalizedEmail,
      passwordHash,
      emailVerified: true,
      isActive: true,
    })
    .returning({
      id: users.id,
      email: users.email,
      emailVerified: users.emailVerified,
    });

  return Response.json(created, { status: 201 });
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "adminUsers:get",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_USUARIO");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(searchParams);

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(users);
    const items = await db
      .select({
        id: users.id,
        email: users.email,
        emailVerified: users.emailVerified,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .limit(pageSize)
      .offset(offset);

    const hasNextPage = offset + items.length < total;

    return Response.json({ items, page, pageSize, total, hasNextPage });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo consultar usuarios", { status: 500 });
  }
}

export async function PUT(request: Request) {
  const limited = rateLimit(request, {
    key: "adminUsers:put",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_USUARIO");

  if (forbidden) return forbidden;

  const { id, isActive, emailVerified } = await request.json();

  if (!id || typeof id !== "string" || id.trim() === "") {
    return new Response("User ID required", { status: 400 });
  }

  const updated = await db
    .update(users)
    .set({
      ...(typeof isActive === "boolean" ? { isActive } : {}),
      ...(typeof emailVerified === "boolean" ? { emailVerified } : {}),
    })
    .where(eq(users.id, id))
    .returning({
      id: users.id,
      email: users.email,
      emailVerified: users.emailVerified,
      isActive: users.isActive,
      createdAt: users.createdAt,
    });

  return Response.json(updated);
}

export async function DELETE(request: Request) {
  const limited = rateLimit(request, {
    key: "adminUsers:delete",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  // Reusamos permiso existente para no depender de seeds.
  const forbidden = await requirePermission(request, "EDITAR_USUARIO");

  if (forbidden) return forbidden;

  const { id } = await request.json();

  if (!id || typeof id !== "string" || id.trim() === "") {
    return new Response("User ID required", { status: 400 });
  }

  try {
    const deleted = await db.transaction(async (tx) => {
      await tx
        .delete(emailVerificationTokens)
        .where(eq(emailVerificationTokens.userId, id));
      await tx
        .delete(passwordResetTokens)
        .where(eq(passwordResetTokens.userId, id));
      await tx.delete(employees).where(eq(employees.userId, id));

      const rows = await tx
        .delete(users)
        .where(eq(users.id, id))
        .returning({ id: users.id, email: users.email });

      return rows;
    });

    if (!deleted || deleted.length === 0) {
      return new Response("User not found", { status: 404 });
    }

    return Response.json(deleted);
  } catch (e) {
    const message = e instanceof Error ? e.message : "No se pudo eliminar";

    return new Response(message, { status: 500 });
  }
}
