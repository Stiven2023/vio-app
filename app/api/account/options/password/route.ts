import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { getUserIdFromRequest } from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { rateLimit } from "@/src/utils/rate-limit";

function isValidUserPassword(password: string): boolean {
  return (
    password.length >= 7 &&
    /[A-Z]/.test(password) &&
    /^[A-Za-z0-9.*]+$/.test(password)
  );
}

export async function PUT(request: Request) {
  const limited = rateLimit(request, {
    key: "account:options:password:put",
    limit: 20,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const payload = await request.json();
    const currentPassword = String(payload.currentPassword ?? "").trim();
    const newPassword = String(payload.newPassword ?? "").trim();

    if (!currentPassword || !newPassword) {
      return new Response("currentPassword y newPassword son requeridos", {
        status: 400,
      });
    }

    if (!isValidUserPassword(newPassword)) {
      return new Response(
        "Contraseña inválida: mínimo 7, 1 mayúscula, solo letras, números, . y *",
        { status: 400 },
      );
    }

    const [user] = await db
      .select({ id: users.id, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return new Response("Usuario no encontrado", { status: 404 });
    }

    const validCurrentPassword = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );

    if (!validCurrentPassword) {
      return new Response("La contraseña actual no es válida", {
        status: 401,
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, userId));

    return Response.json({ ok: true });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;

    return new Response("No se pudo cambiar la contraseña", { status: 500 });
  }
}
