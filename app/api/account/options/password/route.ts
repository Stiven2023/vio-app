import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import { iamDb } from "@/src/db";
import { users } from "@/src/db/iam/schema";
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
      return new Response("currentPassword and newPassword are required", {
        status: 400,
      });
    }

    if (!isValidUserPassword(newPassword)) {
      return new Response(
        "Invalid password: at least 7 characters, 1 uppercase letter, only letters, numbers, . and *",
        { status: 400 },
      );
    }

    const [user] = await iamDb
      .select({ id: users.id, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return new Response("User not found", { status: 404 });
    }

    const validCurrentPassword = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );

    if (!validCurrentPassword) {
      return new Response("Current password is invalid", {
        status: 401,
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await iamDb
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, userId));

    return Response.json({ ok: true });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("Failed to change password", { status: 500 });
  }
}
