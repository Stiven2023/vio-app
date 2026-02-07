import crypto from "crypto";

import { rateLimit } from "@/src/utils/rate-limit";
import { requirePermission } from "@/src/utils/permission-middleware";
import { sendEmailVerificationToken } from "@/src/utils/gmail";
import { signEmailVerificationTicket } from "@/src/utils/auth";

const OTP_WINDOW_MS = 15 * 60_000;

function normalizeEmail(email: unknown) {
  return String(email ?? "")
    .trim()
    .toLowerCase();
}

function currentWindow(timestampMs: number) {
  return Math.floor(timestampMs / OTP_WINDOW_MS);
}

function windowExpiresAtMs(window: number) {
  return (window + 1) * OTP_WINDOW_MS;
}

function requireJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.trim() === "") {
    throw new Error(
      "JWT_SECRET no está configurado. Define JWT_SECRET para poder generar códigos de verificación.",
    );
  }

  return secret;
}

function codeForWindow(email: string, window: number) {
  const secret = requireJwtSecret();
  const digest = crypto
    .createHmac("sha256", secret)
    .update(`preverify:${email}:w:${window}`)
    .digest();

  const num = digest.readUInt32BE(0) % 1_000_000;

  return String(num).padStart(6, "0");
}

// Enviar código (pre-verificación) sin crear usuario todavía
export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "adminUsers:preverifyEmail:request",
    limit: 5,
    windowMs: OTP_WINDOW_MS,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_USUARIO");

  if (forbidden) return forbidden;

  const { email } = await request.json();
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return new Response("Email required", { status: 400 });
  }

  const now = Date.now();
  const w = currentWindow(now);
  const code = codeForWindow(normalizedEmail, w);
  const expiresAt = windowExpiresAtMs(w);

  await sendEmailVerificationToken(normalizedEmail, code);

  return Response.json({ expiresAt }, { status: 200 });
}

// Verificar código y devolver ticket firmado (15 min)
export async function PUT(request: Request) {
  const limited = rateLimit(request, {
    key: "adminUsers:preverifyEmail:confirm",
    limit: 10,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_USUARIO");

  if (forbidden) return forbidden;

  const { email, token } = await request.json();
  const normalizedEmail = normalizeEmail(email);
  const provided = String(token ?? "").trim();

  if (!normalizedEmail || !provided) {
    return new Response("Email and token required", { status: 400 });
  }
  if (!/^[0-9]{6}$/.test(provided)) {
    return new Response("Invalid token", { status: 400 });
  }

  const now = Date.now();
  const w = currentWindow(now);
  const expectedNow = codeForWindow(normalizedEmail, w);
  const expectedPrev = codeForWindow(normalizedEmail, w - 1);

  if (provided !== expectedNow && provided !== expectedPrev) {
    return new Response("Invalid token", { status: 400 });
  }

  const ticket = signEmailVerificationTicket(normalizedEmail);

  return Response.json({ ticket }, { status: 200 });
}
