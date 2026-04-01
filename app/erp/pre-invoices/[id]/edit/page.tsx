export const dynamic = "force-dynamic";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  PrefacturaForm,
  type PrefacturaFormData,
} from "@/app/erp/prefacturas/_components/prefactura-form";
import { requirePermission } from "@/src/utils/permission-middleware";

async function fetchPrefactura(
  id: string,
  req: Request,
): Promise<PrefacturaFormData | null> {
  try {
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.NEXTAUTH_URL ??
      "http://localhost:3000";

    const res = await fetch(`${origin}/api/prefacturas/${id}`, {
      headers: {
        cookie: req.headers.get("cookie") ?? "",
      },
      cache: "no-store",
    });

    if (!res.ok) return null;
    const data = await res.json();

    return data ?? null;
  } catch {
    return null;
  }
}

export default async function EditPreInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const forbidden = await requirePermission(req, "EDITAR_PEDIDO");

  if (forbidden) redirect("/unauthorized");

  const data = await fetchPrefactura(id, req);

  if (!data) redirect("/erp/pre-invoices");

  const initial: PrefacturaFormData = {
    id,
    prefacturaCode: (data as any).prefacturaCode ?? null,
    quoteCode: (data as any).quoteCode ?? null,
    orderId: (data as any).orderId ?? null,
    orderName: (data as any).orderName ?? null,
    orderType: (data as any).orderType ?? null,
    currency: (data as any).currency ?? "COP",
    status: (data as any).status ?? "PENDIENTE_CONTABILIDAD",
    clientId: (data as any).clientId ?? null,
    clientName: (data as any).clientName ?? null,
    clientCode: (data as any).clientCode ?? null,
    clientIdentification: (data as any).clientIdentification ?? null,
    clientDv: (data as any).clientDv ?? null,
    clientEmail: (data as any).clientEmail ?? null,
    clientContactName: (data as any).clientContactName ?? null,
    clientContactPhone: (data as any).clientContactPhone ?? null,
    clientAddress: (data as any).clientAddress ?? null,
    clientCountry: (data as any).clientCountry ?? null,
    clientCity: (data as any).clientCity ?? null,
    clientPostalCode: (data as any).clientPostalCode ?? null,
    clientPriceType: (data as any).clientPriceType ?? null,
    total: (data as any).total ?? null,
    subtotal: (data as any).subtotal ?? null,
    advanceRequired: (data as any).advanceRequired ?? null,
    advanceReceived: (data as any).advanceReceived ?? null,
    advanceStatus: (data as any).advanceStatus ?? null,
    advanceDate: (data as any).advanceDate ?? null,
    advancePaymentImageUrl: (data as any).advancePaymentImageUrl ?? null,
    advanceMethod: (data as any).advanceMethod ?? null,
    advanceBankId: (data as any).advanceBankId ?? null,
    advanceReferenceNumber: (data as any).advanceReferenceNumber ?? null,
    advanceCurrency: (data as any).advanceCurrency ?? null,
    hasConvenio: Boolean((data as any).hasConvenio),
    convenioType: (data as any).convenioType ?? null,
    convenioNotes: (data as any).convenioNotes ?? null,
    convenioExpiresAt: (data as any).convenioExpiresAt ?? null,
    convenioImageUrl: (data as any).convenioImageUrl ?? null,
    hasClientApproval: Boolean((data as any).hasClientApproval),
    clientApprovalDate: (data as any).clientApprovalDate ?? null,
    clientApprovalBy: (data as any).clientApprovalBy ?? null,
    clientApprovalNotes: (data as any).clientApprovalNotes ?? null,
    clientApprovalImageUrl: (data as any).clientApprovalImageUrl ?? null,
    municipalityFiscalSnapshot:
      (data as any).municipalityFiscalSnapshot ?? null,
    taxZoneSnapshot: (data as any).taxZoneSnapshot ?? null,
    withholdingTaxRate: (data as any).withholdingTaxRate ?? null,
    withholdingIcaRate: (data as any).withholdingIcaRate ?? null,
    withholdingIvaRate: (data as any).withholdingIvaRate ?? null,
    withholdingTaxAmount: (data as any).withholdingTaxAmount ?? null,
    withholdingIcaAmount: (data as any).withholdingIcaAmount ?? null,
    withholdingIvaAmount: (data as any).withholdingIvaAmount ?? null,
    totalAfterWithholdings: (data as any).totalAfterWithholdings ?? null,
    ivaAmount: (data as any).ivaAmount ?? null,
  };

  return <PrefacturaForm initial={initial} mode="edit" />;
}
