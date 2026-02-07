import crypto from "crypto";

import { and, eq } from "drizzle-orm";

import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { emailVerificationTokens } from "@/src/db/email_verification_tokens";
import { sendEmailVerificationToken } from "@/src/utils/gmail";
import { rateLimit } from "@/src/utils/rate-limit";

function generateCode(): string {
  return String(crypto.randomInt(100_000, 1_000_000));
}

// Reenviar/solicitar token de verificación
export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "users:verifyEmail:request",
    limit: 5,
    windowMs: 15 * 60_000,
  });

  if (limited) return limited;

  const { email } = await request.json();

  if (!email) return new Response("Email required", { status: 400 });

  const row = await db
    .select({ id: users.id, emailVerified: users.emailVerified })
    .from(users)
    .where(eq(users.email, String(email)))
    .limit(1);

  if (row.length === 0) return new Response("User not found", { status: 404 });
  if (row[0].emailVerified)
    return new Response("Email already verified", { status: 409 });

  const token = generateCode();
  const expiresAt = new Date(Date.now() + 15 * 60_000);

  await db
    .delete(emailVerificationTokens)
    .where(eq(emailVerificationTokens.userId, row[0].id));
  await db
    .insert(emailVerificationTokens)
    .values({ userId: row[0].id, token, expiresAt });

  await sendEmailVerificationToken(String(email), token);

  return new Response("Verification token sent", { status: 200 });
}

// Confirmar verificación
export async function PUT(request: Request) {
  const limited = rateLimit(request, {
    key: "users:verifyEmail:confirm",
    limit: 10,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const { email, token } = await request.json();

  if (!email || !token)
    return new Response("Email and token required", { status: 400 });

  const row = await db
    .select({ id: users.id, emailVerified: users.emailVerified })
    .from(users)
    .where(eq(users.email, String(email)))
    .limit(1);

  if (row.length === 0) return new Response("User not found", { status: 404 });
  if (row[0].emailVerified)
    return new Response("Email already verified", { status: 200 });

  const tokenRow = await db
    .select()
    .from(emailVerificationTokens)
    .where(
      and(
        eq(emailVerificationTokens.userId, row[0].id),
        eq(emailVerificationTokens.token, String(token).trim()),
      ),
    )
    .limit(1);

  if (tokenRow.length === 0)
    return new Response("Invalid token", { status: 400 });
  if (new Date(tokenRow[0].expiresAt) < new Date())
    return new Response("Token expired", { status: 400 });

  await db
    .update(users)
    .set({ emailVerified: true })
    .where(eq(users.id, row[0].id));
  await db
    .delete(emailVerificationTokens)
    .where(eq(emailVerificationTokens.id, tokenRow[0].id));

  return new Response("Email verified", { status: 200 });
}
