"use client";

import type { Key } from "react";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Divider } from "@heroui/divider";
import { Input, Textarea } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";
import NextLink from "next/link";

import { FileUpload } from "@/components/file-upload";
import { apiJson, getErrorMessage } from "@/app/erp/orders/_lib/api";

type OrderType = "VN" | "VI" | "VT" | "VW";

type ClientOption = {
  id: string;
  clientCode?: string | null;
  name: string;
  priceClientType?: string | null;
  email?: string | null;
  identification: string | null;
  dv?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  country?: string | null;
  city?: string | null;
  postalCode?: string | null;
  municipalityFiscal?: string | null;
  taxZone?: TaxZone | null;
  withholdingTaxRate?: string | null;
  withholdingIcaRate?: string | null;
  withholdingIvaRate?: string | null;
};

type ProductItem = {
  id: string;
  name: string | null;
  quantity: number;
  unitPrice: string | null;
  totalPrice: string | null;
  hasAdditions: boolean | null;
  status: string | null;
  confectionistName: string | null;
};

type PaymentRow = {
  id: string;
  amount: string | null;
  method: string | null;
  status: string | null;
  referenceCode: string | null;
  createdAt: string | null;
};

type PrefacturaFormMode = "create" | "edit";

type SupportedCurrency = "COP" | "USD";
type ClientPriceType = "AUTORIZADO" | "MAYORISTA" | "VIOMAR" | "COLANTA";
type TaxZone = "CONTINENTAL" | "FREE_ZONE" | "SAN_ANDRES" | "SPECIAL_REGIME";

const TAX_ZONE_DEFAULT_RATES: Record<
  TaxZone,
  {
    withholdingTaxRate: number;
    withholdingIcaRate: number;
    withholdingIvaRate: number;
  }
> = {
  CONTINENTAL: {
    withholdingTaxRate: 2.5,
    withholdingIcaRate: 0.966,
    withholdingIvaRate: 15,
  },
  FREE_ZONE: {
    withholdingTaxRate: 0,
    withholdingIcaRate: 0,
    withholdingIvaRate: 0,
  },
  SAN_ANDRES: {
    withholdingTaxRate: 0,
    withholdingIcaRate: 0.5,
    withholdingIvaRate: 0,
  },
  SPECIAL_REGIME: {
    withholdingTaxRate: 1,
    withholdingIcaRate: 0.7,
    withholdingIvaRate: 0,
  },
};

function normalizeTaxZone(value: unknown): TaxZone {
  const raw = String(value ?? "CONTINENTAL")
    .trim()
    .toUpperCase();

  if (raw === "FREE_ZONE" || raw === "SAN_ANDRES" || raw === "SPECIAL_REGIME") {
    return raw;
  }

  return "CONTINENTAL";
}

function safeRate(value: unknown, fallback: number): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) return fallback;

  return parsed;
}

export type PrefacturaFormData = {
  id?: string;
  prefacturaCode?: string | null;
  quoteCode?: string | null;
  orderId?: string | null;
  orderName?: string | null;
  orderType?: OrderType | null;
  currency?: SupportedCurrency | null;
  status?: string | null;
  clientId?: string | null;
  clientName?: string | null;
  clientCode?: string | null;
  clientIdentification?: string | null;
  clientDv?: string | null;
  clientEmail?: string | null;
  clientContactName?: string | null;
  clientContactPhone?: string | null;
  clientAddress?: string | null;
  clientCountry?: string | null;
  clientCity?: string | null;
  clientPostalCode?: string | null;
  clientPriceType?: string | null;
  total?: string | null;
  subtotal?: string | null;
  advanceRequired?: string | null;
  advanceReceived?: string | null;
  advanceStatus?: string | null;
  advanceDate?: string | null;
  advancePaymentImageUrl?: string | null;
  advanceMethod?: string | null;
  advanceBankId?: string | null;
  advanceReferenceNumber?: string | null;
  advanceCurrency?: SupportedCurrency | null;
  hasConvenio?: boolean | null;
  convenioType?: string | null;
  convenioNotes?: string | null;
  convenioExpiresAt?: string | null;
  convenioImageUrl?: string | null;
  hasClientApproval?: boolean | null;
  clientApprovalDate?: string | null;
  clientApprovalBy?: string | null;
  clientApprovalNotes?: string | null;
  clientApprovalImageUrl?: string | null;
  municipalityFiscalSnapshot?: string | null;
  taxZoneSnapshot?: TaxZone | null;
  withholdingTaxRate?: string | null;
  withholdingIcaRate?: string | null;
  withholdingIvaRate?: string | null;
  withholdingTaxAmount?: string | null;
  withholdingIcaAmount?: string | null;
  withholdingIvaAmount?: string | null;
  totalAfterWithholdings?: string | null;
  ivaAmount?: string | null;
};

const typeOptions: Array<{ value: OrderType; label: string }> = [
  { value: "VN", label: "VN - Nacional" },
  { value: "VI", label: "VI - Internacional" },
  { value: "VT", label: "VT" },
  { value: "VW", label: "VW" },
];

const clientPriceTypeOptions: Array<{ value: ClientPriceType; label: string }> =
  [
    { value: "AUTORIZADO", label: "Cliente autorizado" },
    { value: "MAYORISTA", label: "Cliente mayorista" },
    { value: "VIOMAR", label: "Cliente Viomar" },
    { value: "COLANTA", label: "Cliente Colanta" },
  ];

const STATUS_LABEL: Record<string, string> = {
  PENDIENTE_CONTABILIDAD: "Pendiente contabilidad",
  APROBACION: "Aprobacion",
  PROGRAMACION: "Programacion",
  PENDIENTE: "Pendiente",
  APROBADA: "Aprobada",
  CANCELADA: "Cancelada",
  ANULADA: "Anulada",
};

const STATUS_COLOR: Record<
  string,
  "default" | "primary" | "success" | "warning" | "danger"
> = {
  PENDIENTE_CONTABILIDAD: "warning",
  APROBACION: "primary",
  PROGRAMACION: "primary",
  PENDIENTE: "default",
  APROBADA: "success",
  CANCELADA: "danger",
  ANULADA: "danger",
};

function normalizeCurrency(
  value: string | null | undefined,
): SupportedCurrency {
  return String(value ?? "COP")
    .trim()
    .toUpperCase() === "USD"
    ? "USD"
    : "COP";
}

function formatMoney(
  value: string | number | null | undefined,
  currency: SupportedCurrency,
): string {
  const n = Number(value ?? 0);

  if (!Number.isFinite(n)) return "--";

  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "es-CO", {
    currency,
    maximumFractionDigits: currency === "USD" ? 2 : 0,
    minimumFractionDigits: currency === "USD" ? 2 : 0,
    style: "currency",
  }).format(n);
}

function toMoneyInputString(
  value: string | number | null | undefined,
  currency: SupportedCurrency,
): string {
  const n = Number(value ?? 0);

  if (!Number.isFinite(n) || n <= 0) return "";

  if (currency === "USD") {
    return n
      .toFixed(2)
      .replace(/\.0+$/, "")
      .replace(/(\.\d*[1-9])0+$/, "$1");
  }

  return String(Math.round(n));
}

export function PrefacturaForm({
  mode,
  initial,
}: {
  mode: PrefacturaFormMode;
  initial?: PrefacturaFormData;
}) {
  const router = useRouter();

  const [orderName, setOrderName] = useState(initial?.orderName ?? "");
  const [orderType, setOrderType] = useState<OrderType>(
    initial?.orderType ?? "VN",
  );
  const [quotationCode, setQuotationCode] = useState(initial?.quoteCode ?? "");
  const [currency, setCurrency] = useState<SupportedCurrency>(
    normalizeCurrency(initial?.currency),
  );
  const [paymentTerms, setPaymentTerms] = useState("TRANSFERENCIA");
  const [priceClientType, setPriceClientType] = useState<ClientPriceType>(
    String(initial?.clientPriceType ?? "VIOMAR")
      .trim()
      .toUpperCase() === "AUTORIZADO"
      ? "AUTORIZADO"
      : String(initial?.clientPriceType ?? "VIOMAR")
            .trim()
            .toUpperCase() === "MAYORISTA"
        ? "MAYORISTA"
        : String(initial?.clientPriceType ?? "VIOMAR")
              .trim()
              .toUpperCase() === "COLANTA"
          ? "COLANTA"
          : "VIOMAR",
  );

  const [clientQuery, setClientQuery] = useState(initial?.clientName ?? "");
  const [clientId, setClientId] = useState(initial?.clientId ?? "");
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
  const [clientLoading, setClientLoading] = useState(false);
  const selectedClient = clientOptions.find((c) => c.id === clientId) ?? null;

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  const [hasAdvance, setHasAdvance] = useState(
    Number(initial?.advanceRequired ?? 0) > 0,
  );
  const [advanceRequired] = useState(
    toMoneyInputString(
      initial?.advanceRequired,
      normalizeCurrency(initial?.currency),
    ),
  );
  const [advanceMethod, setAdvanceMethod] = useState<
    "EFECTIVO" | "TRANSFERENCIA" | ""
  >(
    initial?.advanceMethod === "EFECTIVO" ||
      initial?.advanceMethod === "TRANSFERENCIA"
      ? initial.advanceMethod
      : "",
  );

  const [hasClientApproval, setHasClientApproval] = useState(
    initial?.hasClientApproval ?? false,
  );
  const [clientApprovalBy, setClientApprovalBy] = useState(
    initial?.clientApprovalBy ?? "",
  );
  const [clientApprovalNotes, setClientApprovalNotes] = useState(
    initial?.clientApprovalNotes ?? "",
  );
  const [clientApprovalImageUrl, setClientApprovalImageUrl] = useState(
    initial?.clientApprovalImageUrl ?? "",
  );

  const isCreationFromQuotation =
    mode === "create" && Boolean(quotationCode.trim());

  const [submitting, setSubmitting] = useState(false);

  const [municipalityFiscalSnapshot, setMunicipalityFiscalSnapshot] = useState(
    initial?.municipalityFiscalSnapshot ?? "",
  );
  const [taxZoneSnapshot, setTaxZoneSnapshot] = useState<TaxZone>(
    normalizeTaxZone(initial?.taxZoneSnapshot),
  );
  const [withholdingTaxRate, setWithholdingTaxRate] = useState<number>(
    safeRate(
      initial?.withholdingTaxRate,
      TAX_ZONE_DEFAULT_RATES[normalizeTaxZone(initial?.taxZoneSnapshot)]
        .withholdingTaxRate,
    ),
  );
  const [withholdingIcaRate, setWithholdingIcaRate] = useState<number>(
    safeRate(
      initial?.withholdingIcaRate,
      TAX_ZONE_DEFAULT_RATES[normalizeTaxZone(initial?.taxZoneSnapshot)]
        .withholdingIcaRate,
    ),
  );
  const [withholdingIvaRate, setWithholdingIvaRate] = useState<number>(
    safeRate(
      initial?.withholdingIvaRate,
      TAX_ZONE_DEFAULT_RATES[normalizeTaxZone(initial?.taxZoneSnapshot)]
        .withholdingIvaRate,
    ),
  );

  const totalPrefactura = Number(initial?.total ?? 0);
  const subtotalValue = Number(initial?.subtotal ?? 0);
  const ivaValue = Number(initial?.ivaAmount ?? 0);
  const halfTotal = totalPrefactura / 2;
  const requiredAdvanceValue = hasAdvance
    ? totalPrefactura > 0
      ? currency === "USD"
        ? Number(halfTotal.toFixed(2))
        : Math.round(halfTotal)
      : Number(advanceRequired || 0)
    : 0;

  const withholdingTaxAmount = (subtotalValue * withholdingTaxRate) / 100;
  const withholdingIcaAmount = (subtotalValue * withholdingIcaRate) / 100;
  const withholdingIvaAmount = (ivaValue * withholdingIvaRate) / 100;
  const totalWithholdings =
    withholdingTaxAmount + withholdingIcaAmount + withholdingIvaAmount;
  const totalAfterWithholdings = totalPrefactura - totalWithholdings;

  useEffect(() => {
    if (mode !== "edit" || !initial?.orderId) return;
    setLoadingProducts(true);
    apiJson<{ items: ProductItem[] }>(
      `/api/orders/items?orderId=${initial.orderId}`,
    )
      .then((res) => setProducts(Array.isArray(res?.items) ? res.items : []))
      .catch(() => setProducts([]))
      .finally(() => setLoadingProducts(false));
  }, [mode, initial?.orderId]);

  useEffect(() => {
    if (mode !== "edit" || !initial?.orderId) return;

    setLoadingPayments(true);
    apiJson<{ items: PaymentRow[] }>(
      `/api/orders/${initial.orderId}/payments?page=1&pageSize=200`,
    )
      .then((res) => setPayments(Array.isArray(res?.items) ? res.items : []))
      .catch(() => setPayments([]))
      .finally(() => setLoadingPayments(false));
  }, [mode, initial?.orderId]);

  const searchClients = async (q: string) => {
    setClientLoading(true);
    try {
      const res = await apiJson<{ items: ClientOption[] }>(
        `/api/clients?q=${encodeURIComponent(q.trim())}&pageSize=20&forAutocomplete=1`,
      );

      setClientOptions(Array.isArray(res?.items) ? res.items : []);
    } catch {
      setClientOptions([]);
    } finally {
      setClientLoading(false);
    }
  };

  const onClientInputChange = (value: string) => {
    setClientQuery(value);
    if (value.trim().length >= 2) searchClients(value);
    else setClientOptions([]);
  };

  const onClientSelect = (key: Key | null) => {
    const id = String(key ?? "");

    setClientId(id);
    const opt = clientOptions.find((c) => c.id === id);

    if (opt) {
      setClientQuery(opt.name);

      const nextType = String(opt.priceClientType ?? "VIOMAR")
        .trim()
        .toUpperCase();

      setPriceClientType(
        nextType === "AUTORIZADO"
          ? "AUTORIZADO"
          : nextType === "MAYORISTA"
            ? "MAYORISTA"
            : nextType === "COLANTA"
              ? "COLANTA"
              : "VIOMAR",
      );

      const zone = normalizeTaxZone(opt.taxZone);
      const fallbackRates = TAX_ZONE_DEFAULT_RATES[zone];

      setMunicipalityFiscalSnapshot(String(opt.municipalityFiscal ?? ""));
      setTaxZoneSnapshot(zone);
      setWithholdingTaxRate(
        safeRate(opt.withholdingTaxRate, fallbackRates.withholdingTaxRate),
      );
      setWithholdingIcaRate(
        safeRate(opt.withholdingIcaRate, fallbackRates.withholdingIcaRate),
      );
      setWithholdingIvaRate(
        safeRate(opt.withholdingIvaRate, fallbackRates.withholdingIvaRate),
      );
    }
  };

  const cf = (
    searchField: keyof ClientOption,
    initialField: keyof PrefacturaFormData,
  ): string => {
    if (selectedClient)
      return String((selectedClient as any)[searchField] ?? "");

    return String((initial as any)?.[initialField] ?? "");
  };

  const handleSubmit = async () => {
    if (submitting) return;

    const qCode = quotationCode.trim();
    const oName = orderName.trim();

    if (!qCode && !clientId) {
      toast.error("Ingresa el codigo de cotizacion o selecciona un cliente");

      return;
    }

    if (hasAdvance) {
      const amt = requiredAdvanceValue;

      if (!Number.isFinite(amt) || amt <= 0) {
        toast.error("Ingresa el monto del anticipo");

        return;
      }

      if (!advanceMethod) {
        toast.error("Selecciona el metodo del anticipo");

        return;
      }
    }

    if (hasClientApproval && !clientApprovalImageUrl.trim()) {
      toast.error("Debes adjuntar la captura/evidencia del aval del cliente");

      return;
    }

    setSubmitting(true);
    try {
      if (mode === "create") {
        const payload: Record<string, unknown> = {
          quotationCode: qCode || undefined,
          clientId: qCode ? undefined : clientId,
          orderName: oName || undefined,
          orderType,
          currency,
          clientPriceType: priceClientType,
          advanceRequired: hasAdvance ? requiredAdvanceValue : 0,
          advanceMethod: hasAdvance ? advanceMethod : null,
          hasConvenio: false,
          convenioType: null,
          convenioNotes: null,
          convenioImageUrl: null,
          hasClientApproval,
          clientApprovalBy: hasClientApproval
            ? clientApprovalBy.trim() || null
            : null,
          clientApprovalNotes: hasClientApproval
            ? clientApprovalNotes.trim() || null
            : null,
          clientApprovalImageUrl: hasClientApproval
            ? clientApprovalImageUrl || null
            : null,
          municipalityFiscalSnapshot: municipalityFiscalSnapshot || null,
          taxZoneSnapshot,
          withholdingTaxRate,
          withholdingIcaRate,
          withholdingIvaRate,
          withholdingTaxAmount,
          withholdingIcaAmount,
          withholdingIvaAmount,
          totalAfterWithholdings,
        };

        const created = await apiJson<{ prefactura?: { id?: string } }>(
          "/api/prefacturas",
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
        );

        toast.success(
          isCreationFromQuotation
            ? "Prefactura de cotizacion lista para edicion"
            : "Prefactura creada",
        );

        if (created?.prefactura?.id) {
          router.push(`/erp/pre-invoices/${created.prefactura.id}/edit`);
        } else {
          router.push("/erp/pre-invoices");
        }
      } else {
        if (!initial?.id) return;

        await apiJson(`/api/prefacturas/${initial.id}`, {
          method: "PUT",
          body: JSON.stringify({
            orderName: oName || undefined,
            orderType,
            currency,
          }),
        });

        await apiJson(`/api/prefacturas/${initial.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            clientPriceType: priceClientType,
            advanceRequired: hasAdvance ? requiredAdvanceValue : 0,
            advanceMethod: hasAdvance ? advanceMethod : null,
            hasConvenio: false,
            convenioType: null,
            convenioNotes: null,
            convenioImageUrl: null,
            hasClientApproval,
            clientApprovalBy: hasClientApproval
              ? clientApprovalBy.trim() || null
              : null,
            clientApprovalNotes: hasClientApproval
              ? clientApprovalNotes.trim() || null
              : null,
            clientApprovalImageUrl: hasClientApproval
              ? clientApprovalImageUrl || null
              : null,
            municipalityFiscalSnapshot: municipalityFiscalSnapshot || null,
            taxZoneSnapshot,
            withholdingTaxRate,
            withholdingIcaRate,
            withholdingIvaRate,
            withholdingTaxAmount,
            withholdingIcaAmount,
            withholdingIvaAmount,
            totalAfterWithholdings,
          }),
        });

        toast.success("Prefactura actualizada");
        router.push("/erp/pre-invoices");
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const showClientSearch = mode === "create" && !quotationCode.trim();
  const statusVal = initial?.status ?? "PENDIENTE_CONTABILIDAD";

  return (
    <div className="container mx-auto max-w-7xl space-y-6 px-6 py-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {mode === "create" ? "Nueva prefactura" : "Editar prefactura"}
          </h1>
          {initial?.prefacturaCode ? (
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-default-500">
              <span>Codigo:</span>
              <Chip color="primary" size="sm" variant="flat">
                {initial.prefacturaCode}
              </Chip>
              {initial.quoteCode ? (
                <>
                  <span>Cotizacion:</span>
                  <Chip color="default" size="sm" variant="bordered">
                    {initial.quoteCode}
                  </Chip>
                </>
              ) : null}
              <span>Estado:</span>
              <Chip
                color={STATUS_COLOR[statusVal] ?? "default"}
                size="sm"
                variant="flat"
              >
                {STATUS_LABEL[statusVal] ?? statusVal}
              </Chip>
            </div>
          ) : (
            <p className="mt-0.5 text-sm text-default-500">
              Estructura tipo cotización con validaciones comerciales de
              prefactura.
            </p>
          )}
        </div>
        <Button
          as={NextLink}
          href="/erp/pre-invoices"
          isDisabled={submitting}
          variant="flat"
        >
          Volver
        </Button>
      </div>

      <Card className="border border-default-200" radius="md" shadow="none">
        <CardHeader className="text-sm font-semibold">
          Informacion general
        </CardHeader>
        <Divider />
        <CardBody className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Input
            isReadOnly
            label="Codigo Cliente"
            value={cf("clientCode", "clientCode")}
            variant="bordered"
          />

          <Input
            isReadOnly
            label="Email"
            value={cf("email", "clientEmail")}
            variant="bordered"
          />

          <Input
            isReadOnly
            label="NIT / CC"
            value={cf("identification", "clientIdentification")}
            variant="bordered"
          />

          <Input
            isReadOnly
            label="DV"
            value={cf("dv", "clientDv")}
            variant="bordered"
          />

          <Input
            isReadOnly
            label="Nombre Contacto"
            value={cf("contactName", "clientContactName")}
            variant="bordered"
          />

          <Input
            isReadOnly
            label="Telefono Contacto"
            value={cf("contactPhone", "clientContactPhone")}
            variant="bordered"
          />

          <Input
            isReadOnly
            label="Direccion"
            value={cf("address", "clientAddress")}
            variant="bordered"
          />

          <Input
            isReadOnly
            label="Pais"
            value={cf("country", "clientCountry") || "COLOMBIA"}
            variant="bordered"
          />

          <Input
            isReadOnly
            label="Ciudad"
            value={cf("city", "clientCity")}
            variant="bordered"
          />

          <Input
            isReadOnly
            label="Codigo Postal"
            value={cf("postalCode", "clientPostalCode")}
            variant="bordered"
          />

          <Select
            label="Moneda"
            selectedKeys={[currency]}
            variant="bordered"
            onSelectionChange={(keys) => {
              const first = String(Array.from(keys)[0] ?? "COP");

              setCurrency(first === "USD" ? "USD" : "COP");
            }}
          >
            <SelectItem key="COP">COP</SelectItem>
            <SelectItem key="USD">USD</SelectItem>
          </Select>

          <div className="space-y-4 lg:col-span-3">
            {mode === "create" ? (
              <Input
                description="Deja en blanco para crear sin cotizacion vinculada"
                label="Codigo de cotizacion"
                placeholder="Ej: COT-10001"
                value={quotationCode}
                variant="bordered"
                onValueChange={setQuotationCode}
              />
            ) : (
              <Input
                isReadOnly
                label="Codigo de cotizacion"
                value={initial?.quoteCode ?? "Sin cotizacion"}
                variant="bordered"
              />
            )}

            {showClientSearch ? (
              <Autocomplete
                defaultItems={clientOptions}
                inputValue={clientQuery}
                isLoading={clientLoading}
                label="Cliente"
                placeholder="Busca por nombre o NIT..."
                selectedKey={clientId || null}
                variant="bordered"
                onInputChange={onClientInputChange}
                onSelectionChange={onClientSelect}
              >
                {(item) => (
                  <AutocompleteItem
                    key={item.id}
                    textValue={`${item.name} ${item.identification ?? ""}`}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{item.name}</span>
                      {item.identification ? (
                        <span className="text-xs text-default-500">
                          {item.identification}
                        </span>
                      ) : null}
                    </div>
                  </AutocompleteItem>
                )}
              </Autocomplete>
            ) : mode === "edit" ? (
              <Input
                isReadOnly
                label="Cliente"
                value={initial?.clientName ?? "---"}
                variant="bordered"
              />
            ) : null}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Input
                label="Nombre del pedido"
                placeholder="Ej: Pedido empresa XYZ"
                value={orderName}
                variant="bordered"
                onValueChange={setOrderName}
              />
              <Select
                label="Tipo de pedido"
                selectedKeys={[orderType]}
                variant="bordered"
                onSelectionChange={(keys) => {
                  const first = String(
                    Array.from(keys)[0] ?? "VN",
                  ) as OrderType;

                  setOrderType(
                    first === "VI" || first === "VT" || first === "VW"
                      ? first
                      : "VN",
                  );
                }}
              >
                {typeOptions.map((opt) => (
                  <SelectItem key={opt.value}>{opt.label}</SelectItem>
                ))}
              </Select>
              <Select
                label="Tipo de cliente (COP)"
                selectedKeys={[priceClientType]}
                variant="bordered"
                onSelectionChange={(keys) => {
                  const first = String(Array.from(keys)[0] ?? "VIOMAR")
                    .trim()
                    .toUpperCase();

                  setPriceClientType(
                    first === "AUTORIZADO"
                      ? "AUTORIZADO"
                      : first === "MAYORISTA"
                        ? "MAYORISTA"
                        : first === "COLANTA"
                          ? "COLANTA"
                          : "VIOMAR",
                  );
                }}
              >
                {clientPriceTypeOptions.map((opt) => (
                  <SelectItem key={opt.value}>{opt.label}</SelectItem>
                ))}
              </Select>
              <Input
                isReadOnly
                label="Municipio fiscal (snapshot)"
                value={municipalityFiscalSnapshot}
                variant="bordered"
              />
              <Input
                isReadOnly
                label="Zona fiscal (snapshot)"
                value={taxZoneSnapshot}
                variant="bordered"
              />
            </div>

            <Select
              label="Condiciones de pago"
              selectedKeys={[paymentTerms]}
              variant="bordered"
              onSelectionChange={(keys) => {
                const first = String(Array.from(keys)[0] ?? "TRANSFERENCIA");

                setPaymentTerms(first || "TRANSFERENCIA");
              }}
            >
              <SelectItem key="TRANSFERENCIA">Transferencia</SelectItem>
              <SelectItem key="EFECTIVO">Efectivo</SelectItem>
              <SelectItem key="CREDITO">Credito</SelectItem>
            </Select>
          </div>
        </CardBody>
      </Card>

      {mode === "edit" && initial?.orderId ? (
        <Card className="border border-default-200" radius="md" shadow="none">
          <CardHeader className="flex items-center justify-between text-sm font-semibold">
            <span>Productos del pedido</span>
            {initial.total ? (
              <div className="flex items-center gap-4 text-xs font-normal">
                <span className="text-default-500">
                  Subtotal:{" "}
                  <strong className="text-default-700">
                    {formatMoney(initial.subtotal, currency)}
                  </strong>
                </span>
                <span className="font-semibold text-default-800">
                  Total:{" "}
                  <strong className="text-primary">
                    {formatMoney(initial.total, currency)}
                  </strong>
                </span>
              </div>
            ) : null}
          </CardHeader>
          <Divider />
          <CardBody className="px-0 py-0">
            {loadingProducts ? (
              <p className="px-4 py-6 text-sm text-default-400">
                Cargando productos...
              </p>
            ) : products.length === 0 ? (
              <p className="px-4 py-6 text-sm text-default-400">
                Sin items registrados en este pedido.
              </p>
            ) : (
              <Table
                aria-label="Productos de la prefactura"
                classNames={{ wrapper: "rounded-none shadow-none" }}
              >
                <TableHeader>
                  <TableColumn>Diseno / Producto</TableColumn>
                  <TableColumn className="text-right">Cant.</TableColumn>
                  <TableColumn className="text-right">Precio unit.</TableColumn>
                  <TableColumn className="text-right">Total</TableColumn>
                  <TableColumn>Adiciones</TableColumn>
                  <TableColumn>Estado</TableColumn>
                  <TableColumn>Confeccionista</TableColumn>
                </TableHeader>
                <TableBody>
                  {products.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.name ?? "---"}</TableCell>
                      <TableCell className="text-right">{p.quantity}</TableCell>
                      <TableCell className="text-right">
                        {formatMoney(p.unitPrice, currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMoney(p.totalPrice, currency)}
                      </TableCell>
                      <TableCell>
                        {p.hasAdditions ? (
                          <Chip color="secondary" size="sm" variant="flat">
                            Si
                          </Chip>
                        ) : (
                          <span className="text-xs text-default-400">No</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {p.status ? (
                          <Chip size="sm" variant="flat">
                            {p.status}
                          </Chip>
                        ) : (
                          "---"
                        )}
                      </TableCell>
                      <TableCell>
                        {p.confectionistName ?? (
                          <span className="text-xs text-default-400">
                            Sin asignar
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardBody>
        </Card>
      ) : null}

      {mode === "edit" && initial?.orderId ? (
        <Card className="border border-default-200" radius="md" shadow="none">
          <CardHeader className="text-sm font-semibold">
            Abonos registrados
          </CardHeader>
          <Divider />
          <CardBody className="px-0 py-0">
            {loadingPayments ? (
              <p className="px-4 py-6 text-sm text-default-400">
                Cargando abonos...
              </p>
            ) : payments.length === 0 ? (
              <p className="px-4 py-6 text-sm text-default-400">
                Sin abonos registrados.
              </p>
            ) : (
              <Table
                aria-label="Abonos de la prefactura"
                classNames={{ wrapper: "rounded-none shadow-none" }}
              >
                <TableHeader>
                  <TableColumn>Fecha</TableColumn>
                  <TableColumn>Método</TableColumn>
                  <TableColumn>Estado</TableColumn>
                  <TableColumn>Referencia</TableColumn>
                  <TableColumn className="text-right">Valor</TableColumn>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        {p.createdAt
                          ? new Date(p.createdAt).toLocaleString("es-CO")
                          : "-"}
                      </TableCell>
                      <TableCell>{p.method ?? "-"}</TableCell>
                      <TableCell>
                        <Chip size="sm" variant="flat">
                          {p.status ?? "-"}
                        </Chip>
                      </TableCell>
                      <TableCell>{p.referenceCode ?? "-"}</TableCell>
                      <TableCell className="text-right">
                        {formatMoney(p.amount, currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardBody>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="border border-default-200" radius="md" shadow="none">
            <CardHeader className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Aval del cliente</p>
                <p className="text-xs text-default-500">
                  Registra evidencia de aprobación comercial.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Chip
                  color={hasClientApproval ? "success" : "default"}
                  size="sm"
                  variant="flat"
                >
                  {hasClientApproval ? "true" : "false"}
                </Chip>
                <Switch
                  isSelected={hasClientApproval}
                  size="sm"
                  onValueChange={setHasClientApproval}
                />
              </div>
            </CardHeader>
            <Divider />
            {hasClientApproval ? (
              <CardBody className="space-y-3">
                <Input
                  label="Fuente del aval"
                  placeholder="Ej: WhatsApp, correo, llamada..."
                  value={clientApprovalBy}
                  variant="bordered"
                  onValueChange={setClientApprovalBy}
                />
                <Textarea
                  label="Observaciones"
                  minRows={2}
                  placeholder="Detalles del aval, condiciones, acuerdos..."
                  value={clientApprovalNotes}
                  variant="bordered"
                  onValueChange={setClientApprovalNotes}
                />
                <FileUpload
                  acceptedFileTypes="image/*"
                  label="Imagen / evidencia del aval"
                  uploadFolder="prefacturas/avales"
                  value={clientApprovalImageUrl}
                  onChange={setClientApprovalImageUrl}
                  onClear={() => setClientApprovalImageUrl("")}
                />
              </CardBody>
            ) : (
              <CardBody>
                <p className="text-xs text-default-400">
                  El cliente aún no ha dado aval formal.
                </p>
              </CardBody>
            )}
          </Card>
        </div>

        <Card
          className="border border-default-200 lg:col-span-1"
          radius="md"
          shadow="none"
        >
          <CardHeader className="text-sm font-semibold">
            Resumen de prefactura
          </CardHeader>
          <Divider />
          <CardBody className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-default-500">Subtotal</span>
              <span className="font-medium">
                {formatMoney(initial?.subtotal, currency)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-default-500">Total</span>
              <span className="font-semibold text-primary">
                {formatMoney(totalPrefactura, currency)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-default-500">Anticipo requerido</span>
              <span className="font-medium">
                {hasAdvance
                  ? formatMoney(requiredAdvanceValue, currency)
                  : "N/A"}
              </span>
            </div>

            <div className="space-y-2 border-t border-default-200 pt-3">
              <p className="text-sm font-semibold">Retenciones</p>
              <Input
                label="Retención en la fuente (%)"
                type="number"
                value={String(withholdingTaxRate)}
                variant="bordered"
                onValueChange={(value) =>
                  setWithholdingTaxRate(Math.max(0, Number(value || 0)))
                }
              />
              <Input
                label="Retención ICA (%)"
                type="number"
                value={String(withholdingIcaRate)}
                variant="bordered"
                onValueChange={(value) =>
                  setWithholdingIcaRate(Math.max(0, Number(value || 0)))
                }
              />
              <Input
                label="Retención IVA (%)"
                type="number"
                value={String(withholdingIvaRate)}
                variant="bordered"
                onValueChange={(value) =>
                  setWithholdingIvaRate(Math.max(0, Number(value || 0)))
                }
              />
              <div className="flex justify-between text-xs">
                <span className="text-default-500">Valor Retefuente</span>
                <span>{formatMoney(withholdingTaxAmount, currency)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-default-500">Valor Retención ICA</span>
                <span>{formatMoney(withholdingIcaAmount, currency)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-default-500">Valor Retención IVA</span>
                <span>{formatMoney(withholdingIvaAmount, currency)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold">
                <span>Total retenciones</span>
                <span>{formatMoney(totalWithholdings, currency)}</span>
              </div>
            </div>

            <div className="flex justify-between text-sm font-semibold text-primary">
              <span>Total después de retenciones</span>
              <span>{formatMoney(totalAfterWithholdings, currency)}</span>
            </div>

            <div className="space-y-2 border-t border-default-200 pt-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm">Anticipo</span>
                  <p className="text-xs text-default-500">
                    Define si la prefactura exige el 50% para programación.
                  </p>
                </div>
                <Switch
                  isSelected={hasAdvance}
                  size="sm"
                  onValueChange={setHasAdvance}
                />
              </div>

              {hasAdvance ? (
                <>
                  {totalPrefactura > 0 ? (
                    <div className="space-y-1 rounded-lg bg-default-50 p-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-default-500">
                          Total prefactura
                        </span>
                        <span className="font-semibold">
                          {formatMoney(totalPrefactura, currency)}
                        </span>
                      </div>
                      <div className="flex justify-between text-primary">
                        <span>50% para programación</span>
                        <span className="font-semibold">
                          {formatMoney(halfTotal, currency)}
                        </span>
                      </div>
                    </div>
                  ) : null}

                  <Select
                    label="Método de pago"
                    selectedKeys={advanceMethod ? [advanceMethod] : []}
                    variant="bordered"
                    onSelectionChange={(keys) => {
                      const first = String(Array.from(keys)[0] ?? "");

                      setAdvanceMethod(
                        first === "EFECTIVO" || first === "TRANSFERENCIA"
                          ? first
                          : "",
                      );
                    }}
                  >
                    <SelectItem key="EFECTIVO">Efectivo</SelectItem>
                    <SelectItem key="TRANSFERENCIA">Transferencia</SelectItem>
                  </Select>

                  {mode === "edit" ? (
                    <p className="rounded-lg border border-primary-200 bg-primary-50 p-3 text-xs text-primary-700">
                      El pago del anticipo se registra desde el listado de
                      prefacturas en Acciones &gt; Realizar anticipo.
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-xs text-default-400">
                  Prefactura sin anticipo obligatorio.
                </p>
              )}
            </div>

            <Divider />

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-default-500">Anticipo</span>
                <Chip
                  color={hasAdvance ? "success" : "default"}
                  size="sm"
                  variant="flat"
                >
                  {hasAdvance ? "true" : "false"}
                </Chip>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-default-500">Aval cliente</span>
                <Chip
                  color={hasClientApproval ? "success" : "default"}
                  size="sm"
                  variant="flat"
                >
                  {hasClientApproval ? "true" : "false"}
                </Chip>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button
          as={NextLink}
          href="/erp/pre-invoices"
          isDisabled={submitting}
          variant="flat"
        >
          Cancelar
        </Button>
        <Button color="primary" isLoading={submitting} onPress={handleSubmit}>
          {mode === "create" ? "Crear prefactura" : "Guardar cambios"}
        </Button>
      </div>
    </div>
  );
}
