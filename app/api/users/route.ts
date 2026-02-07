import crypto from "crypto";

import bcrypt from "bcryptjs";
import { eq, and } from "drizzle-orm";

import { db } from "@/src/db";
import { users, employees, roles } from "@/src/db/schema";
import { passwordResetTokens } from "@/src/db/password_reset_tokens";
import { sendPasswordResetEmail } from "@/src/utils/gmail";
import { signAuthToken } from "@/src/utils/auth";
import { rateLimit } from "@/src/utils/rate-limit";

// Registro
export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "users:register",
    limit: 10,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const { email, password } = await request.json();

  if (!email || !password) {
    return new Response("Email and password required", { status: 400 });
  }
  // Validación avanzada de contraseña
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
  const exists = await db.select().from(users).where(eq(users.email, email));

  if (exists.length > 0) {
    return new Response("User already exists", { status: 409 });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const newUser = await db
    .insert(users)
    .values({ email, passwordHash, isActive: true })
    .returning();

  return Response.json(newUser);
}

// Login
export async function PUT(request: Request) {
  const limited = rateLimit(request, {
    key: "users:login",
    limit: 12,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const { email, password } = await request.json();

  if (!email || !password) {
    return new Response("Email and password required", { status: 400 });
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
  const user = await db.select().from(users).where(eq(users.email, email));

  if (user.length === 0) {
    return new Response("User not found", { status: 404 });
  }
  const valid = await bcrypt.compare(password, user[0].passwordHash);

  if (!valid) {
    return new Response("Invalid password", { status: 401 });
  }
  // Generar JWT con datos útiles y setear cookie httpOnly
  // Buscar empleado asociado al usuario
  const employee = await db
    .select()
    .from(employees)
    .where(eq(employees.userId, user[0].id));
  let name = null;
  let roleId = null;
  let roleName = null;

  if (employee.length > 0) {
    name = employee[0].name;
    roleId = employee[0].roleId;
    if (roleId) {
      const role = await db.select().from(roles).where(eq(roles.id, roleId));

      if (role.length > 0) {
        roleName = role[0].name;
      }
    }
  }
  // Incluir name y roleName en el JWT y la respuesta
  let token: string;

  try {
    token = signAuthToken({ name, role: roleName });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error firmando token";

    return new Response(message, { status: 500 });
  }
  const response = Response.json({
    user: {
      name,
      role: roleName,
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
  const user = await db.select().from(users).where(eq(users.email, email));

  if (user.length === 0) {
    return new Response("User not found", { status: 404 });
  }
  // Generar token único
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 minutos

  await db
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
  // Buscar el token válido y no expirado
  const tokenRow = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.token, token),
        eq(passwordResetTokens.userId, email),
      ),
    ) // email es userId si es UUID, si no, buscar user primero
    .limit(1);
  let userId = null;

  if (tokenRow.length === 0) {
    // Si no se encontró por userId, buscar el usuario por email
    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (user.length === 0) {
      return new Response("User not found", { status: 404 });
    }
    userId = user[0].id;
    const tokenRow2 = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.token, token),
          eq(passwordResetTokens.userId, userId),
        ),
      )
      .limit(1);

    if (tokenRow2.length === 0) {
      return new Response("Invalid or expired token", { status: 400 });
    }
    if (new Date(tokenRow2[0].expiresAt) < new Date()) {
      return new Response("Token expired", { status: 400 });
    }
    // Cambiar contraseña
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const updated = await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, userId))
      .returning();

    // Eliminar el token usado
    await db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.id, tokenRow2[0].id));

    return Response.json(updated);
  } else {
    if (new Date(tokenRow[0].expiresAt) < new Date()) {
      return new Response("Token expired", { status: 400 });
    }
    // Cambiar contraseña
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const updated = await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, tokenRow[0].userId))
      .returning();

    // Eliminar el token usado
    await db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.id, tokenRow[0].id));

    return Response.json(updated);
  }
}
