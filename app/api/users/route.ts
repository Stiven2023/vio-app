import crypto from "crypto";

import bcrypt from "bcryptjs";
import { eq, and, inArray } from "drizzle-orm";

import { erpDb, iamDb } from "@/src/db";
import { employees } from "@/src/db/erp/schema";
import { roles, users } from "@/src/db/iam/schema";
import { passwordResetTokens } from "@/src/db/password_reset_tokens";
import { emailVerificationTokens } from "@/src/db/email_verification_tokens";
import {
  sendEmailVerificationToken,
  sendPasswordResetEmail,
} from "@/src/utils/gmail";
import { signAuthToken } from "@/src/utils/auth";
import { jsonError } from "@/src/utils/api-error";
import { resolveEmployeeIdentity } from "@/src/utils/employee-session";
import { resolveEmployeeRole } from "@/src/utils/employee-session";
import { rateLimit } from "@/src/utils/rate-limit";
import { validatePassword } from "@/src/utils/password-validator";
import {
  deriveUsernameFromEmail,
  isValidUsername,
  normalizeUsername,
  usernameValidationMessage,
} from "@/src/utils/username";

// Registro
export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "users:register",
    limit: 10,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const { email, password, username } = await request.json();
  const normalizedEmail = String(email ?? "")
    .trim()
    .toLowerCase();
  const normalizedUsername = normalizeUsername(
    username || deriveUsernameFromEmail(normalizedEmail),
  );

  if (!normalizedEmail || !password) {
    return new Response("Email and password required", { status: 400 });
  }

  if (!isValidUsername(normalizedUsername)) {
    return new Response(usernameValidationMessage(), { status: 400 });
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return new Response(passwordError, { status: 400 });
  }

  const exists = await iamDb
    .select()
    .from(users)
    .where(inArray(users.email, [normalizedEmail]));

  const existingUsername = await iamDb
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, normalizedUsername))
    .limit(1);

  if (existingUsername.length > 0 && existingUsername[0]?.id !== exists[0]?.id) {
    return new Response("Username already exists", { status: 409 });
  }

  // Si el usuario ya existe pero NO está verificado, (re)enviamos token y
  // devolvemos el usuario para que el frontend muestre OTP.
  if (exists.length > 0) {
    const existing = exists[0];

    if (existing.emailVerified) {
      return new Response("User already exists", { status: 409 });
    }

    const token = String(crypto.randomInt(100_000, 1_000_000));
    const expiresAt = new Date(Date.now() + 15 * 60_000);

    await iamDb.transaction(async (tx) => {
      await tx
        .delete(emailVerificationTokens)
        .where(eq(emailVerificationTokens.userId, existing.id));
      await tx
        .insert(emailVerificationTokens)
        .values({ userId: existing.id, token, expiresAt });
    });

    let emailSent = true;

    try {
      await sendEmailVerificationToken(normalizedEmail, token);
    } catch {
      emailSent = false;
    }

    return Response.json([
      { id: existing.id, email: existing.email, emailSent },
    ]);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const token = String(crypto.randomInt(100_000, 1_000_000));
  const expiresAt = new Date(Date.now() + 15 * 60_000);

  const created = await iamDb.transaction(async (tx) => {
    const newUser = await tx
      .insert(users)
      .values({
        username: normalizedUsername,
        email: normalizedEmail,
        passwordHash,
        isActive: true,
      })
      .returning();
    const inserted = newUser[0];

    if (!inserted?.id) {
      throw new Error("User insert failed");
    }

    await tx
      .insert(emailVerificationTokens)
      .values({ userId: inserted.id, token, expiresAt });

    return inserted;
  });

  let emailSent = true;

  try {
    await sendEmailVerificationToken(normalizedEmail, token);
  } catch {
    emailSent = false;
  }

  // Mantiene compatibilidad con el frontend (array), pero agrega emailSent.
  return Response.json([{ id: created.id, email: created.email, emailSent }], {
    status: 201,
  });
}

// Login
export async function PUT(request: Request) {
  const limited = rateLimit(request, {
    key: "users:login",
    limit: 12,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const { username, password } = await request.json();

  if (!username || !password) {
    return new Response("Username and password required", { status: 400 });
  }
  // Validación avanzada de contraseña (solo si es login, puede omitirse, pero la agrego por consistencia)
  if (password.length < 7) {
    return new Response("Password must be at least 7 characters", {
      status: 400,
    });
  }
  if (!/[A-Z]/.test(password)) {
    return new Response("Password must contain at least one uppercase letter", {
      status: 400,
    });
  }
  if (/[^A-Za-z0-9.*]/.test(password)) {
    return new Response("Password can only contain letters, numbers, . and *", {
      status: 400,
    });
  }
  const identifier = normalizeUsername(username);

  if (!isValidUsername(identifier)) {
    return new Response(usernameValidationMessage(), { status: 400 });
  }

  const user = await iamDb
    .select()
    .from(users)
    .where(eq(users.username, identifier));

  if (user.length === 0) {
    return new Response("User not found", { status: 404 });
  }
  const valid = await bcrypt.compare(password, user[0].passwordHash);

  if (!valid) {
    return new Response("Invalid password", { status: 401 });
  }
  // Generar JWT con datos útiles y setear cookie httpOnly
  // Buscar empleado asociado al usuario
  const normalizedUserEmail = String(user[0].email ?? "")
    .trim()
    .toLowerCase();
  const employee = await resolveEmployeeIdentity({
    userId: user[0].id,
    email: normalizedUserEmail,
  });
  let name = null;
  let roleName = null;

  if (employee) {
    name = employee.name;
    const roleResolution = resolveEmployeeRole(employee);

    if (roleResolution.code) {
      return jsonError(
        409,
        "AUTH_ROLE_NOT_CONFIGURED",
        "El usuario no tiene un rol operativo configurado. Actualiza el rol del empleado antes de iniciar sesión.",
      );
    }

    roleName = roleResolution.role;

    if (employee.userId !== user[0].id) {
      await erpDb
        .update(employees)
        .set({ userId: user[0].id })
        .where(eq(employees.id, employee.id));
    }
  } else {
    return jsonError(
      409,
      "AUTH_EMPLOYEE_NOT_FOUND",
      "El usuario no tiene un empleado asociado. Vincula el usuario a un empleado antes de iniciar sesión.",
    );
  }
  // Incluir name y roleName en el JWT y la respuesta
  let token: string;

  try {
    token = signAuthToken({
      name,
      role: roleName,
      email: normalizedUserEmail,
      userId: user[0].id,
      employeeId: employee?.id ?? null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error firmando token";

    return new Response(message, { status: 500 });
  }
  const response = Response.json({
    user: {
      id: user[0].id,
      name,
      role: roleName,
      email: normalizedUserEmail,
      employeeId: employee?.id ?? null,
    },
    token,
  });
  const secure = process.env.NODE_ENV === "production";

  response.headers.set(
    "Set-Cookie",
    `auth_token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800;${secure ? " Secure;" : ""}`, // 7 días
  );

  return response;
}

// Solicitud de recuperación de contraseña
export async function PATCH(request: Request) {
  const limited = rateLimit(request, {
    key: "users:recovery",
    limit: 5,
    windowMs: 15 * 60_000,
  });

  if (limited) return limited;

  const { email } = await request.json();

  if (!email) {
    return new Response("Email required", { status: 400 });
  }
  const user = await iamDb.select().from(users).where(eq(users.email, email));

  if (user.length === 0) {
    return new Response("User not found", { status: 404 });
  }
  // Generar token único
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 minutos

  await iamDb
    .insert(passwordResetTokens)
    .values({ userId: user[0].id, token, expiresAt });
  await sendPasswordResetEmail(email, token);

  return new Response("Recovery email sent", { status: 200 });
}

// Confirmación y cambio de contraseña
export async function DELETE(request: Request) {
  const limited = rateLimit(request, {
    key: "users:reset",
    limit: 10,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const { email, token, newPassword } = await request.json();

  if (!email || !token || !newPassword) {
    return new Response("All fields required", { status: 400 });
  }
  // Validación avanzada de contraseña
  if (newPassword.length < 7) {
    return new Response("Password must be at least 7 characters", {
      status: 400,
    });
  }
  if (!/[A-Z]/.test(newPassword)) {
    return new Response("Password must contain at least one uppercase letter", {
      status: 400,
    });
  }
  if (/[^A-Za-z0-9.*]/.test(newPassword)) {
    return new Response("Password can only contain letters, numbers, . and *", {
      status: 400,
    });
  }
  const user = await iamDb
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (user.length === 0) {
    return new Response("User not found", { status: 404 });
  }

  const tokenRow = await iamDb
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.token, token),
        eq(passwordResetTokens.userId, user[0].id),
      ),
    )
    .limit(1);

  if (tokenRow.length === 0) {
    return new Response("Invalid or expired token", { status: 400 });
  }
  if (new Date(tokenRow[0].expiresAt) < new Date()) {
    return new Response("Token expired", { status: 400 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const updated = await iamDb
    .update(users)
    .set({ passwordHash })
    .where(eq(users.id, user[0].id))
    .returning();

  await iamDb
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.id, tokenRow[0].id));

  return Response.json(updated);
}
