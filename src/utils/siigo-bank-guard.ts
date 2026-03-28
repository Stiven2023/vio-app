import { db } from "@/src/db";
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
