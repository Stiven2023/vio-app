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
