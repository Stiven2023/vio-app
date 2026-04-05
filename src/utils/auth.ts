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

export type MesAccessTokenPayload = {
  typ: "mes_access";
  email: string;
  role: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string | null;
  userId: string | null;
  processKey: string;
  mesProcess: string;
  operationType: string;
  machineId: string | null;
  machineName: string | null;
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
  const clientCode = String(payload.clientCode ?? "")
    .trim()
    .toUpperCase();

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

export function verifyExternalAccessToken(
  token: string,
): ExternalAccessTokenPayload | null {
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

export function signMesAccessToken(payload: MesAccessTokenPayload) {
  const email = String(payload.email ?? "")
    .trim()
    .toLowerCase();
  const role = String(payload.role ?? "")
    .trim()
    .toUpperCase();
  const employeeId = String(payload.employeeId ?? "").trim();
  const employeeName = String(payload.employeeName ?? "").trim();
  const processKey = String(payload.processKey ?? "").trim();
  const mesProcess = String(payload.mesProcess ?? "").trim();
  const operationType = String(payload.operationType ?? "")
    .trim()
    .toUpperCase();

  if (
    !email ||
    !role ||
    !employeeId ||
    !employeeName ||
    !processKey ||
    !mesProcess ||
    !operationType
  ) {
    throw new Error("Datos inválidos para token MES");
  }

  return jwt.sign(
    {
      typ: "mes_access",
      email,
      role,
      employeeId,
      employeeName,
      employeeEmail:
        payload.employeeEmail && String(payload.employeeEmail).trim() !== ""
          ? String(payload.employeeEmail).trim().toLowerCase()
          : null,
      userId:
        payload.userId && String(payload.userId).trim() !== ""
          ? String(payload.userId).trim()
          : null,
      processKey,
      mesProcess,
      operationType,
      machineId:
        payload.machineId && String(payload.machineId).trim() !== ""
          ? String(payload.machineId).trim()
          : null,
      machineName:
        payload.machineName && String(payload.machineName).trim() !== ""
          ? String(payload.machineName).trim()
          : null,
    },
    requireJwtSecret(),
    { expiresIn: "12h" },
  );
}

export function verifyMesAccessToken(
  token: string,
): MesAccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, requireJwtSecret());

    if (!decoded || typeof decoded !== "object") return null;

    const typ = (decoded as any).typ;
    const email = (decoded as any).email;
    const role = (decoded as any).role;
    const employeeId = (decoded as any).employeeId;
    const employeeName = (decoded as any).employeeName;
    const processKey = (decoded as any).processKey;
    const mesProcess = (decoded as any).mesProcess;
    const operationType = (decoded as any).operationType;

    if (typ !== "mes_access") return null;
    if (typeof email !== "string" || email.trim() === "") return null;
    if (typeof role !== "string" || role.trim() === "") return null;
    if (typeof employeeId !== "string" || employeeId.trim() === "") return null;
    if (typeof employeeName !== "string" || employeeName.trim() === "") return null;
    if (typeof processKey !== "string" || processKey.trim() === "") return null;
    if (typeof mesProcess !== "string" || mesProcess.trim() === "") return null;
    if (typeof operationType !== "string" || operationType.trim() === "") return null;

    return {
      typ,
      email: email.trim().toLowerCase(),
      role: role.trim().toUpperCase(),
      employeeId: employeeId.trim(),
      employeeName: employeeName.trim(),
      employeeEmail:
        typeof (decoded as any).employeeEmail === "string" &&
        (decoded as any).employeeEmail.trim() !== ""
          ? (decoded as any).employeeEmail.trim().toLowerCase()
          : null,
      userId:
        typeof (decoded as any).userId === "string" &&
        (decoded as any).userId.trim() !== ""
          ? (decoded as any).userId.trim()
          : null,
      processKey: processKey.trim(),
      mesProcess: mesProcess.trim(),
      operationType: operationType.trim().toUpperCase(),
      machineId:
        typeof (decoded as any).machineId === "string" &&
        (decoded as any).machineId.trim() !== ""
          ? (decoded as any).machineId.trim()
          : null,
      machineName:
        typeof (decoded as any).machineName === "string" &&
        (decoded as any).machineName.trim() !== ""
          ? (decoded as any).machineName.trim()
          : null,
    };
  } catch {
    return null;
  }
}
