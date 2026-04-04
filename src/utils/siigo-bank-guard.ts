import { sql } from "drizzle-orm";

import { db } from "@/src/db";
import { banks } from "@/src/db/schema";
import { resolvePaymentBankById } from "@/src/utils/payment-banks";

function readHeader(request: Request, name: string) {
  return String(request.headers.get(name) ?? "").trim();
}

function readBankIdFromRequest(request: Request) {
  const url = new URL(request.url);
  const queryValue = String(url.searchParams.get("bankId") ?? "").trim();

  if (queryValue) return queryValue;

  const headerValue = readHeader(request, "x-siigo-bank-id");

  if (headerValue) return headerValue;

  const envValue = String(process.env.SIIGO_OFFICIAL_BANK_ID ?? "").trim();

  if (envValue) return envValue;

  return null;
}

export async function requireOfficialBankForSiigo(request: Request) {
  const bankId = readBankIdFromRequest(request);

  if (!bankId) {
    throw new Error(
      "Missing official bank for Siigo. Provide bankId query param, x-siigo-bank-id header, or SIIGO_OFFICIAL_BANK_ID.",
    );
  }

  const bank = await resolvePaymentBankById(db, bankId);

  if (!bank) {
    throw new Error("The selected bank does not exist.");
  }

  if (bank.isActive === false) {
    throw new Error("The selected bank is inactive.");
  }

  if (bank.isOfficial !== true) {
    throw new Error("Siigo sync requires an official bank.");
  }

  return bank;
}

/**
 * Obtiene un banco oficial para SIIGO, buscando en orden de prioridad:
 * 1. Query param bankId
 * 2. Header x-siigo-bank-id
 * 3. Env SIIGO_OFFICIAL_BANK_ID
 * 4. Primer banco oficial disponible en la BD
 * Si ninguno se encuentra, lanza un error detallado.
 */
export async function getOfficialBankForSiigo(request: Request) {
  const bankId = readBankIdFromRequest(request);

  if (bankId) {
    const bank = await resolvePaymentBankById(db, bankId);

    if (!bank) {
      throw new Error(`Bank ${bankId} does not exist.`);
    }

    if (bank.isActive === false) {
      throw new Error(`Bank ${bankId} is inactive.`);
    }

    if (bank.isOfficial !== true) {
      throw new Error(`Bank ${bankId} is not official.`);
    }

    return bank;
  }

  // Fallback: obtener el primer banco oficial
  const [officialBank] = await db
    .select()
    .from(banks)
    .where(
      sql`
        "is_official"::boolean = true
        AND "is_active"::boolean = true
      `,
    )
    .limit(1);

  if (!officialBank) {
    throw new Error(
      "No official bank configured for Siigo. Provide bankId query param, x-siigo-bank-id header, or SIIGO_OFFICIAL_BANK_ID.",
    );
  }

  return officialBank;
}

export async function getOptionalOfficialBankForSiigo(request: Request) {
  try {
    return await getOfficialBankForSiigo(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "");

    // For customer sync we allow proceeding without bank when none is configured.
    if (
      message.includes("No official bank configured for Siigo") ||
      message.includes("Missing official bank for Siigo")
    ) {
      return null;
    }

    throw error;
  }
}
