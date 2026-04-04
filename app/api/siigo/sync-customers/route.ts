import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import {
  clientLegalStatusHistory,
  clients,
  siigoSyncJobs,
} from "@/src/db/erp/schema";
import { getEmployeeIdFromRequest } from "@/src/utils/auth-middleware";
import { getRoleFromRequest } from "@/src/utils/auth-middleware";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";
import { getOptionalOfficialBankForSiigo } from "@/src/utils/siigo-bank-guard";
import { SiigoApiError, siigoJson } from "@/src/utils/siigo";

const ACCOUNTING_ROLES = new Set([
  "ADMINISTRADOR",
  "LIDER_FINANCIERA",
  "AUXILIAR_CONTABLE",
  "TESORERIA_Y_CARTERA",
]);

function isAccountingRole(role: string | null) {
  return Boolean(role && ACCOUNTING_ROLES.has(role));
}

// ── Tipos raw de Siigo ─────────────────────────────────────────────────────────

type SiigoPhone = {
  indicative?: unknown;
  number?: unknown;
  extension?: unknown;
};

type SiigoContact = {
  first_name?: unknown;
  last_name?: unknown;
  email?: unknown;
  phone?: SiigoPhone;
};

type SiigoCity = {
  country_code?: unknown;
  country_name?: unknown;
  state_code?: unknown;
  state_name?: unknown;
  city_code?: unknown;
  city_name?: unknown;
};

type SiigoAddress = {
  address?: unknown;
  city?: SiigoCity;
  postal_code?: unknown;
};

type SiigoFiscalR = {
  code?: unknown;
  name?: unknown;
};

type SiigoRawCustomer = {
  id?: unknown;
  code?: unknown;
  name?: unknown;
  commercial_name?: unknown;
  active?: unknown;
  person_type?: unknown;
  id_type?: { code?: unknown; name?: unknown };
  identification?: unknown;
  check_digit?: unknown;
  addresses?: unknown;
  phones?: unknown;
  contacts?: unknown;
  fiscal_responsibilities?: unknown;
};

type SiigoCustomersPage = {
  pagination?: {
    page?: unknown;
    page_size?: unknown;
    total_results?: unknown;
  };
  results?: unknown;
};

export type SyncStats = {
  ok: true;
  total: number;
  created: number;
  updated: number;
  errors: Array<{ identification: string; name: string; reason: string }>;
  durationMs: number;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function str(v: unknown): string | null {
  const s = String(v ?? "").trim();

  return s || null;
}

function limit(value: string | null, max: number) {
  if (!value) return null;

  return value.slice(0, max);
}

function toBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  const s = String(v ?? "")
    .trim()
    .toLowerCase();

  return s === "true" || s === "1";
}

function mapIdType(
  code: string | null,
): "CC" | "NIT" | "CE" | "PAS" | "EMPRESA_EXTERIOR" {
  switch (code) {
    case "13":
    case "10":
      return "CC";
    case "31":
      return "NIT";
    case "22":
      return "CE";
    case "41":
    case "42":
      return "PAS";
    case "91":
      return "EMPRESA_EXTERIOR";
    default:
      return "CC";
  }
}

function mapTaxRegime(
  fiscalCodes: string[],
  idType: string,
): "REGIMEN_COMUN" | "REGIMEN_SIMPLIFICADO" | "NO_RESPONSABLE" {
  if (idType === "NIT" || idType === "EMPRESA_EXTERIOR") return "REGIMEN_COMUN";
  if (
    fiscalCodes.some(
      (c) => c === "O-23" || c === "O-47" || c === "O-13" || c === "O-15",
    )
  )
    return "REGIMEN_COMUN";
  if (fiscalCodes.some((c) => c === "O-49" || c === "R-99-PN"))
    return "NO_RESPONSABLE";

  return "REGIMEN_SIMPLIFICADO";
}

function formatMobile(intlCode: string, mobile: string): string {
  const clean = mobile.replace(/\s/g, "");
  const code = intlCode.replace(/\+/g, "").trim();

  if (code === "57" && clean.length === 10) {
    return `+${code} ${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6, 8)} ${clean.slice(8)}`;
  }

  const parts: string[] = [];

  for (let i = 0; i < clean.length; i += 3) {
    parts.push(clean.slice(i, i + 3));
  }

  return `+${code} ${parts.join(" ")}`;
}

function formatLandline(
  intlCode: string,
  localCode: string | null,
  landline: string,
  extension: string | null,
): string {
  const clean = landline.replace(/\s/g, "");
  const intl = intlCode.replace(/\+/g, "").trim();

  let formatted = "";

  if (intl === "57" && localCode) {
    const local = localCode.trim();

    if (clean.length === 7) {
      formatted = `+${intl} (${local}) ${clean.slice(0, 3)} ${clean.slice(3)}`;
    } else {
      formatted = `+${intl} (${local}) ${clean}`;
    }
  } else if (localCode) {
    formatted = `+${intl} (${localCode.trim()}) ${clean}`;
  } else {
    formatted = `+${intl} ${clean}`;
  }

  if (extension) {
    formatted += ` ext. ${extension}`;
  }

  return formatted;
}

type PhoneParts = {
  intlDialCode: string;
  mobile: string | null;
  fullMobile: string | null;
  localDialCode: string | null;
  landline: string | null;
  extension: string | null;
  fullLandline: string | null;
};

function normalizePhoneParts(
  rawPhone: string | null,
  rawIndicative: string | null,
): PhoneParts {
  const digits = String(rawPhone ?? "").replace(/\D/g, "");
  const indicative = String(rawIndicative ?? "")
    .replace(/\D/g, "")
    .trim();

  const fallback: PhoneParts = {
    intlDialCode: "57",
    mobile: null,
    fullMobile: null,
    localDialCode: null,
    landline: null,
    extension: null,
    fullLandline: null,
  };

  if (!digits) return fallback;

  if (digits.length === 10 && digits.startsWith("3")) {
    return {
      ...fallback,
      intlDialCode: indicative || "57",
      mobile: digits,
      fullMobile: formatMobile(indicative || "57", digits),
    };
  }

  if (digits.length === 7) {
    const localCode = indicative && indicative !== "57" ? indicative : null;

    return {
      ...fallback,
      localDialCode: localCode,
      landline: digits,
      fullLandline: formatLandline("57", localCode, digits, null),
    };
  }

  if (digits.length === 10 && /^(601|604|605|606|607|608)$/.test(indicative)) {
    return {
      ...fallback,
      localDialCode: indicative,
      landline: digits.slice(3),
      fullLandline: formatLandline("57", indicative, digits.slice(3), null),
    };
  }

  if (digits.length === 10 && !digits.startsWith("3")) {
    return {
      ...fallback,
      localDialCode: digits.slice(0, 3),
      landline: digits.slice(3),
      fullLandline: formatLandline("57", digits.slice(0, 3), digits.slice(3), null),
    };
  }

  if (digits.length >= 7 && digits.length <= 15) {
    return {
      ...fallback,
      intlDialCode: indicative || "57",
      mobile: digits,
      fullMobile: formatMobile(indicative || "57", digits),
    };
  }

  return fallback;
}

type DbErrorLike = {
  message?: string;
  code?: string;
  detail?: string;
  constraint?: string;
  cause?: DbErrorLike | null;
};

function describeDbError(error: unknown) {
  if (!error || typeof error !== "object") {
    return String(error ?? "Error desconocido en base de datos");
  }

  const err = error as DbErrorLike;
  const parts = [
    err.cause?.message,
    err.cause?.detail,
    err.cause?.constraint ? `constraint=${err.cause.constraint}` : null,
    err.message,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" | ") : "Error desconocido en base de datos";
}

// ── Normalización raw → datos locales ─────────────────────────────────────────

type NormalizedCustomer = {
  siigoId: string | null;
  name: string;
  identification: string;
  dv: string | null;
  identificationType: "CC" | "NIT" | "CE" | "PAS" | "EMPRESA_EXTERIOR";
  clientType: "NACIONAL" | "EXTRANJERO";
  taxRegime: "REGIMEN_COMUN" | "REGIMEN_SIMPLIFICADO" | "NO_RESPONSABLE";
  active: boolean;
  email: string | null;
  contactName: string | null;
  phone: string | null;
  intlDialCode: string;
  phoneIndicative: string | null;
  address: string | null;
  city: string | null;
  department: string | null;
  country: string | null;
  postalCode: string | null;
};

function normalizeRaw(raw: unknown): NormalizedCustomer | null {
  if (!raw || typeof raw !== "object") return null;

  const r = raw as SiigoRawCustomer;
  const identification = str(r.identification);

  if (!identification) return null;

  const name = str(r.name) ?? str(r.commercial_name) ?? "Sin nombre";
  const dv = str(r.check_digit);
  const idTypeCode = str(r.id_type?.code);
  const identificationType = mapIdType(idTypeCode);

  const active = toBool(r.active);

  // Phones
  const phones = Array.isArray(r.phones) ? (r.phones as SiigoPhone[]) : [];
  const firstPhone = phones[0];
  const phone = firstPhone ? str(firstPhone.number) : null;
  const intlDialCode = firstPhone ? (str(firstPhone.indicative) ?? "57") : "57";

  // Contacts
  const contacts = Array.isArray(r.contacts)
    ? (r.contacts as SiigoContact[])
    : [];
  const firstContact = contacts[0];
  const email = firstContact ? str(firstContact.email) : null;
  const contactName = firstContact
    ? [str(firstContact.first_name), str(firstContact.last_name)]
        .filter(Boolean)
        .join(" ") || null
    : null;

  // Addresses
  const addresses = Array.isArray(r.addresses)
    ? (r.addresses as SiigoAddress[])
    : [];
  const firstAddr = addresses[0];
  const address = firstAddr ? str(firstAddr.address) : null;
  const cityObj = firstAddr?.city;
  const city = cityObj ? str(cityObj.city_name) : null;
  const department = cityObj ? str(cityObj.state_name) : null;
  const countryName = cityObj ? str(cityObj.country_name) : null;
  const countryCode = cityObj ? str(cityObj.country_code) : null;
  const postalCode = firstAddr ? str(firstAddr.postal_code) : null;

  // Fiscal
  const fiscalResp = Array.isArray(r.fiscal_responsibilities)
    ? (r.fiscal_responsibilities as SiigoFiscalR[])
    : [];
  const fiscalCodes = fiscalResp
    .map((f) => str(f.code))
    .filter(Boolean) as string[];

  const clientType =
    !countryCode || countryCode.toUpperCase() === "COL"
      ? "NACIONAL"
      : "EXTRANJERO";

  const taxRegime = mapTaxRegime(fiscalCodes, identificationType);

  return {
    siigoId: str(r.id) ?? str(r.code),
    name: limit(name.replace(/\s*,\s*/g, " "), 255) ?? "Sin nombre",
    identification,
    dv,
    identificationType,
    clientType,
    taxRegime,
    active,
    email: limit(email, 255),
    contactName: limit(
      (contactName ?? name).replace(/\s*,\s*/g, " "),
      255,
    ),
    phone,
    intlDialCode,
    phoneIndicative: firstPhone ? str(firstPhone.indicative) : null,
    address: limit(address, 255),
    city: limit(city ?? countryName, 100),
    department: limit(department, 100),
    country: limit(
      countryName ?? (countryCode === "COL" ? "COLOMBIA" : countryCode),
      100,
    ),
    postalCode: limit(postalCode, 20),
  };
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // Rate limit: máx 3 sincronizaciones por minuto
  const limited = rateLimit(request, {
    key: "siigo:sync-customers",
    limit: 3,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const retryMode =
    String(request.headers.get("x-siigo-job-retry") ?? "") === "1";
  const role = getRoleFromRequest(request);

  if (retryMode) {
    if (!isAccountingRole(role)) {
      return new Response("Forbidden", { status: 403 });
    }
  } else {
    const forbidden = await requirePermission(request, "CREAR_CLIENTE");

    if (forbidden) return forbidden;
  }

  const startMs = Date.now();
  const employeeId = getEmployeeIdFromRequest(request);

  let syncJobId: string | null = null;
  let officialBankId: string | null = null;

  try {
    const officialBank = await getOptionalOfficialBankForSiigo(request);

    officialBankId = officialBank?.id ?? null;

    const [createdJob] = await db
      .insert(siigoSyncJobs)
      .values({
        jobType: "SYNC_CUSTOMERS",
        status: "RUNNING",
        bankId: officialBankId,
        requestedBy: employeeId,
        payload: {
          source: "api/siigo/sync-customers",
        },
        startedAt: new Date(),
      })
      .returning({ id: siigoSyncJobs.id });

    syncJobId = createdJob?.id ?? null;

    // 1. Descargar todos los clientes paginados de Siigo
    const allRaw: unknown[] = [];
    let page = 1;
    const pageSize = 100;

    while (true) {
      const data = await siigoJson<SiigoCustomersPage>(
        `/v1/customers?page=${page}&page_size=${pageSize}&type=Customer`,
      );

      const results = Array.isArray(data?.results) ? data.results : [];

      allRaw.push(...results);

      const totalResults = Number(data?.pagination?.total_results ?? 0);

      if (allRaw.length >= totalResults || results.length === 0) break;
      page++;
    }

    // 2. Normalizar
    const normalized = allRaw
      .map(normalizeRaw)
      .filter((c): c is NormalizedCustomer => Boolean(c));

    // 3. Cargar clientes existentes en un Map<identification, {id, clientCode}>
    const existingRows = await db
      .select({
        identification: clients.identification,
        id: clients.id,
        clientCode: clients.clientCode,
      })
      .from(clients);

    const existingMap = new Map(existingRows.map((r) => [r.identification, r]));

    // 4. Calcular el último número usado por prefijo para generar códigos
    const lastCodeNumber: Record<string, number> = {
      CN: 10000,
      CE: 10000,
      EM: 10000,
    };

    for (const row of existingRows) {
      const match = row.clientCode?.match(/^(CN|CE|EM)(\d+)$/);

      if (match) {
        const prefix = match[1] as string;
        const num = parseInt(match[2], 10);

        if (!isNaN(num) && num > (lastCodeNumber[prefix] ?? 0)) {
          lastCodeNumber[prefix] = num;
        }
      }
    }

    // 5. Upsert secuencial
    let created = 0;
    let updated = 0;
    const errors: SyncStats["errors"] = [];

    for (const c of normalized) {
      try {
        const existing = existingMap.get(c.identification);

        if (existing) {
          // — Actualizar campos procedentes de Siigo —
          const phoneParts = normalizePhoneParts(c.phone, c.phoneIndicative);

          await db
            .update(clients)
            .set({
              name: c.name,
              ...(c.email ? { email: c.email } : {}),
              intlDialCode: phoneParts.intlDialCode,
              mobile: phoneParts.mobile,
              fullMobile: phoneParts.fullMobile,
              localDialCode: phoneParts.localDialCode,
              landline: phoneParts.landline,
              extension: phoneParts.extension,
              fullLandline: phoneParts.fullLandline,
              ...(c.address ? { address: c.address } : {}),
              ...(c.city ? { city: c.city } : {}),
              ...(c.department ? { department: c.department } : {}),
              ...(c.country ? { country: c.country } : {}),
              ...(c.postalCode ? { postalCode: c.postalCode } : {}),
              ...(c.dv ? { dv: c.dv } : {}),
              isActive: c.active,
              status: c.active ? "ACTIVO" : "INACTIVO",
            })
            .where(eq(clients.id, existing.id));

          updated++;
        } else {
          // — Insertar nuevo cliente —
          const prefix = c.clientType === "NACIONAL" ? "CN" : "CE";

          lastCodeNumber[prefix] = (lastCodeNumber[prefix] ?? 10000) + 1;

          const clientCode = `${prefix}${lastCodeNumber[prefix]}`;

          // Valores obligatorios con fallback para los no presentes en Siigo
          const email = limit(
            c.email ?? `pendiente+${c.identification}@siigo-sync.local`,
            255,
          );
          const contactName = limit(c.contactName ?? c.name, 255);
          const address = limit(
            c.address ?? "Pendiente - verificar en Siigo",
            255,
          );
          const city = limit(c.city ?? "Medellín", 100);
          const department = limit(c.department ?? "ANTIOQUIA", 100);
          const country = limit(c.country ?? "COLOMBIA", 100);
          const phoneParts = normalizePhoneParts(c.phone, c.phoneIndicative);

          const [newClient] = await db
            .insert(clients)
            .values({
              clientCode,
              clientType: c.clientType,
              name: c.name,
              identificationType: c.identificationType,
              identification: c.identification,
              ...(c.dv ? { dv: c.dv } : {}),
              branch: "01",
              taxRegime: c.taxRegime,
              contactName: contactName ?? c.name,
              email: email ?? `pendiente@siigo-sync.local`,
              address: address ?? "Pendiente - verificar en Siigo",
              ...(c.postalCode ? { postalCode: c.postalCode } : {}),
              country: country ?? "COLOMBIA",
              department: department ?? "ANTIOQUIA",
              city: city ?? "Medellín",
              intlDialCode: phoneParts.intlDialCode,
              mobile: phoneParts.mobile,
              fullMobile: phoneParts.fullMobile,
              localDialCode: phoneParts.localDialCode,
              landline: phoneParts.landline,
              extension: phoneParts.extension,
              fullLandline: phoneParts.fullLandline,
              status: c.active ? "ACTIVO" : "INACTIVO",
              isActive: c.active,
              hasCredit: false,
            })
            .returning({ id: clients.id });

          if (newClient) {
            await db.insert(clientLegalStatusHistory).values({
              clientId: newClient.id,
              clientName: c.name,
              status: "EN_REVISION",
              notes: `Importado desde Siigo (ID Siigo: ${c.siigoId ?? "N/D"})`,
              reviewedBy: "Sincronización Siigo",
            });
          }

          created++;
        }
      } catch (err) {
        errors.push({
          identification: c.identification,
          name: c.name,
          reason: describeDbError(err),
        });
      }
    }

    const payload = {
      ok: true,
      total: normalized.length,
      created,
      updated,
      errors,
      durationMs: Date.now() - startMs,
    } satisfies SyncStats;

    if (syncJobId) {
      await db
        .update(siigoSyncJobs)
        .set({
          status: "SUCCESS",
          result: {
            ...payload,
            bankId: officialBankId,
          },
          finishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(siigoSyncJobs.id, syncJobId));
    }

    return Response.json(payload);
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : String(err ?? "unknown");

    if (syncJobId) {
      try {
        await db
          .update(siigoSyncJobs)
          .set({
            status: "FAILED",
            result: {
              error: errorMessage,
              cause: err instanceof Error ? err.cause : null,
            },
            finishedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(siigoSyncJobs.id, syncJobId));
      } catch {
        // Log silently if sync job update fails
      }
    }

    if (err instanceof SiigoApiError) {
      return Response.json(
        { ok: false, error: err.message },
        { status: err.status },
      );
    }

    // Return detailed error for debugging
    return Response.json(
      {
        ok: false,
        error: errorMessage || "Error unknown in Siigo sync",
        hint: errorMessage.includes("Missing")
          ? "Verify bank id, x-siigo-bank-id header, or SIIGO_OFFICIAL_BANK_ID env"
          : errorMessage.includes("No official bank configured for Siigo")
            ? "No hay banco oficial y en sync de clientes no es obligatorio. Reintente y si persiste revise conectividad SIIGO."
          : errorMessage.includes("does not exist")
            ? "The bank ID provided does not exist in the system"
            : errorMessage.includes("inactive")
              ? "The bank is inactive, cannot sync"
              : errorMessage.includes("official")
                ? "Only official banks can be used for Siigo sync"
                : undefined,
      },
      { status: 500 },
    );
  }
}
