import jwt, { type JwtPayload } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = "7d";

function requireJwtSecret() {
  if (!JWT_SECRET || JWT_SECRET.trim() === "") {
    throw new Error(
      "JWT_SECRET no está configurado. Define JWT_SECRET en tus variables de entorno (.env.local) para poder firmar/verificar tokens.",
    );
  }

  return JWT_SECRET;
}

export function signAuthToken(payload: object) {
  return jwt.sign(payload, requireJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
}

export function verifyAuthToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, requireJwtSecret());

    if (typeof decoded === "object" && decoded) return decoded;

    return null;
  } catch {
    return null;
  }
}

type EmailVerificationTicketPayload = {
  typ: "email_verification_ticket";
  email: string;
};

type ExternalAccessTokenPayload = {
  typ: "external_access";
  clientId: string;
  clientCode: string;
  audience: "CLIENTE" | "TERCERO";
};

export function signEmailVerificationTicket(email: string) {
  const normalizedEmail = String(email ?? "")
    .trim()
    .toLowerCase();

  if (!normalizedEmail) {
    throw new Error("Email inválido para ticket de verificación");
  }

  return jwt.sign(
    { typ: "email_verification_ticket", email: normalizedEmail },
    requireJwtSecret(),
    { expiresIn: "15m" },
  );
}

export function verifyEmailVerificationTicket(
  token: string,
): EmailVerificationTicketPayload | null {
  try {
    const decoded = jwt.verify(token, requireJwtSecret());

    if (!decoded || typeof decoded !== "object") return null;
    const typ = (decoded as any).typ;
    const email = (decoded as any).email;

    if (typ !== "email_verification_ticket") return null;
    if (typeof email !== "string" || email.trim() === "") return null;

    return { typ, email: email.trim().toLowerCase() };
  } catch {
    return null;
  }
}

export function signExternalAccessToken(payload: {
  clientId: string;
  clientCode: string;
  audience: "CLIENTE" | "TERCERO";
}) {
  const clientId = String(payload.clientId ?? "").trim();
  const clientCode = String(payload.clientCode ?? "").trim().toUpperCase();

  if (!clientId || !clientCode) {
    throw new Error("Datos inválidos para token externo");
  }

  return jwt.sign(
    {
      typ: "external_access",
      clientId,
      clientCode,
      audience: payload.audience,
    },
    requireJwtSecret(),
    { expiresIn: "1d" },
  );
}

export function verifyExternalAccessToken(token: string): ExternalAccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, requireJwtSecret());

    if (!decoded || typeof decoded !== "object") return null;

    const typ = (decoded as any).typ;
    const clientId = (decoded as any).clientId;
    const clientCode = (decoded as any).clientCode;
    const audience = (decoded as any).audience;

    if (typ !== "external_access") return null;
    if (typeof clientId !== "string" || clientId.trim() === "") return null;
    if (typeof clientCode !== "string" || clientCode.trim() === "") return null;
    if (audience !== "CLIENTE" && audience !== "TERCERO") return null;

    return {
      typ,
      clientId: clientId.trim(),
      clientCode: clientCode.trim().toUpperCase(),
      audience,
    };
  } catch {
    return null;
  }
}
