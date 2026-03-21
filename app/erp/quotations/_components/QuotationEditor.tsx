"use client";

import type { ClientPriceType, QuoteForm, TaxZone } from "../_lib/types";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Input } from "@heroui/input";
import { Switch } from "@heroui/switch";
import { Button } from "@heroui/button";
import { Select, SelectItem } from "@heroui/select";
import { toast } from "react-hot-toast";

import {
  useClientsData,
  useProductsData,
  useAdditionsData,
  useQuoteItems,
  useQuoteCalculations,
  useSaveQuotation,
} from "../_hooks";

import { QuotationsForm } from "./QuotationsForm";
import { QuotationsProductsTable } from "./QuotationsProductsTable";

import { useSessionStore } from "@/store/session";
import { FileUpload } from "@/components/file-upload";
import { apiJson, getErrorMessage } from "@/app/erp/catalog/_lib/api";
import { buildExpiryDateFromDelivery } from "@/src/utils/quotation-delivery";

type QuotationEditorProps = {
  quoteId?: string;
  mode?: "quotation" | "prefactura";
};

type PrefacturaOrderType = "VN" | "VI" | "VT" | "VW";

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

type QuotationDetailResponse = {
  id: string;
  quoteCode: string;
  clientId: string;
  sellerId: string;
  clientPriceType: ClientPriceType | null;
  documentType: "F" | "R";
  currency: "COP" | "USD";
  deliveryDate: string | null;
  expiryDate: string | null;
  paymentTerms: string | null;
  promissoryNoteNumber: string | null;
  shippingEnabled: boolean | null;
  shippingFee: string | null;
  insuranceEnabled: boolean | null;
  insuranceFee: string | null;
  municipalityFiscalSnapshot: string | null;
  taxZoneSnapshot: TaxZone | null;
  withholdingTaxRate: string | null;
  withholdingIcaRate: string | null;
  withholdingIvaRate: string | null;
  withholdingTaxAmount: string | null;
  withholdingIcaAmount: string | null;
  withholdingIvaAmount: string | null;
  totalAfterWithholdings: string | null;
  items: Array<{
    id: string;
    productId: string;
    orderType:
      | "NORMAL"
      | "COMPLETACION"
      | "REFERENTE"
      | "REPOSICION"
      | "MUESTRA"
      | "OBSEQUIO"
      | "BODEGA";
    process: "PRODUCCION" | "BODEGA" | "COMPRAS";
    quantity: number;
    unitPrice: number;
    discount: number;
    referenceOrderCode?: string | null;
    referenceDesign?: string | null;
    additions: Array<{ id: string; quantity: number; unitPrice: number }>;
  }>;
};

export function QuotationEditor({
  quoteId,
  mode = "quotation",
}: QuotationEditorProps) {
  const router = useRouter();
  const user = useSessionStore((s) => s.user);

  const { clients, loading: loadingClients } = useClientsData();

  const [form, setForm] = useState<QuoteForm>({
    clientId: "",
    sellerId: user?.id ?? "",
    documentType: "F",
    customerName: "",
    customerEmail: "",
    documentNumber: "",
    documentVerificationDigit: "",
    contactName: "",
    contactPhone: "",
    address: "",
    country: "COLOMBIA",
    city: "",
    postalCode: "",
    seller: user?.name ?? "",
    currency: "COP",
    expiryDate: "",
    paymentTerms: "TRANSFERENCIA",
    promissoryNoteNumber: "",
    clientPriceTypeDisplay: null,
    municipalityFiscalSnapshot: "",
    taxZoneSnapshot: "CONTINENTAL",
  });

  const [shippingEnabled, setShippingEnabled] = useState(false);
  const [insuranceEnabled, setInsuranceEnabled] = useState(false);
  const [shippingFee, setShippingFee] = useState(0);
  const [insuranceFee, setInsuranceFee] = useState(0);
  const [initialItems, setInitialItems] = useState<
    QuotationDetailResponse["items"] | null
  >(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [loadedQuoteCode, setLoadedQuoteCode] = useState("");
  const [prefacturaOrderType, setPrefacturaOrderType] =
    useState<PrefacturaOrderType>("VN");
  const [prefacturaOrderName, setPrefacturaOrderName] = useState("");
  const [hasClientApproval, setHasClientApproval] = useState(false);
  const [clientApprovalImageUrl, setClientApprovalImageUrl] = useState("");
  const [hasAdvance, setHasAdvance] = useState(true);
  const [creatingPrefactura, setCreatingPrefactura] = useState(false);
  const [withholdingTaxRate, setWithholdingTaxRate] = useState(0);
  const [withholdingIcaRate, setWithholdingIcaRate] = useState(0);
  const [withholdingIvaRate, setWithholdingIvaRate] = useState(0);

  const { products, loading: loadingProducts } = useProductsData(form.currency);
  const { additions, loading: loadingAdditions } = useAdditionsData(
    form.currency,
  );

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === form.clientId) ?? null,
    [clients, form.clientId],
  );

  const isInternationalClient = ["CE", "PAS", "EMPRESA_EXTERIOR"].includes(
    String(selectedClient?.identificationType ?? ""),
  );
  const selectedClientPriceType: ClientPriceType =
    selectedClient?.priceClientType ?? "VIOMAR";
  const clientPriceTypeForQuote: ClientPriceType | null = isInternationalClient
    ? null
    : selectedClientPriceType;

  const { items, setItems, updateItem, removeItem, addItem } = useQuoteItems(
    products,
    form.currency,
    selectedClientPriceType,
  );

  const draftCacheKey = quoteId
    ? `quotations:draft:${quoteId}:items`
    : "quotations:draft:new:items";

  useEffect(() => {
    if (quoteId) return;

    try {
      const raw = localStorage.getItem(draftCacheKey);

      if (!raw) return;

      const parsed = JSON.parse(raw);

      if (!Array.isArray(parsed) || parsed.length === 0) return;

      setItems(parsed);
    } catch {
      // ignore cache parse errors
    }
  }, [draftCacheKey, quoteId, setItems]);

  useEffect(() => {
    if (quoteId) return;

    try {
      localStorage.setItem(draftCacheKey, JSON.stringify(items));
    } catch {
      // ignore storage errors
    }
  }, [draftCacheKey, items, quoteId]);

  useEffect(() => {
    if (!initialItems || products.length === 0) return;

    setItems(
      initialItems.map((item) => {
        const product = products.find((p) => p.id === item.productId);
        const normalizedOrderType =
          item.orderType === "BODEGA" ? "REPOSICION" : item.orderType;

        return {
          id: item.id,
          productId: item.productId,
          orderType: normalizedOrderType,
          process: item.process,
          code: product?.productCode ?? "",
          quantity: item.quantity,
          product: product?.name ?? "",
          description: product?.description ?? "",
          unitPrice: item.unitPrice,
          discount: item.discount,
          additions: item.additions,
          referenceOrderCode: item.referenceOrderCode ?? "",
          referenceDesign: item.referenceDesign ?? "",
        };
      }),
    );
  }, [initialItems, products, setItems]);

  useEffect(() => {
    setForm((s) => ({
      ...s,
      seller: user?.name ?? "",
      sellerId: user?.id ?? "",
    }));
  }, [user?.id, user?.name]);

  useEffect(() => {
    if (!quoteId) return;

    let active = true;

    setLoadingQuote(true);

    apiJson<QuotationDetailResponse>(`/api/quotations/${quoteId}`)
      .then((quote) => {
        if (!active) return;

        setForm((s) => ({
          ...s,
          clientId: quote.clientId,
          sellerId: quote.sellerId,
          documentType: quote.documentType ?? "F",
          currency: quote.currency,
          expiryDate: quote.expiryDate ?? "",
          paymentTerms: quote.paymentTerms ?? "TRANSFERENCIA",
          promissoryNoteNumber: quote.promissoryNoteNumber ?? "",
          municipalityFiscalSnapshot: quote.municipalityFiscalSnapshot ?? "",
          taxZoneSnapshot: normalizeTaxZone(quote.taxZoneSnapshot),
        }));

        const snapshotZone = normalizeTaxZone(quote.taxZoneSnapshot);
        const fallbackRates = TAX_ZONE_DEFAULT_RATES[snapshotZone];

        setWithholdingTaxRate(
          safeRate(quote.withholdingTaxRate, fallbackRates.withholdingTaxRate),
        );
        setWithholdingIcaRate(
          safeRate(quote.withholdingIcaRate, fallbackRates.withholdingIcaRate),
        );
        setWithholdingIvaRate(
          safeRate(quote.withholdingIvaRate, fallbackRates.withholdingIvaRate),
        );

        setShippingEnabled(Boolean(quote.shippingEnabled));
        setInsuranceEnabled(Boolean(quote.insuranceEnabled));
        setShippingFee(Number(quote.shippingFee ?? 0));
        setInsuranceFee(Number(quote.insuranceFee ?? 0));
        setLoadedQuoteCode(quote.quoteCode ?? "");
        setInitialItems(quote.items ?? []);
      })
      .catch((error) => toast.error(getErrorMessage(error)))
      .finally(() => {
        if (active) setLoadingQuote(false);
      });

    return () => {
      active = false;
    };
  }, [quoteId]);

  useEffect(() => {
    if (!selectedClient || quoteId) return;

    const zone = normalizeTaxZone(selectedClient.taxZone);
    const fallbackRates = TAX_ZONE_DEFAULT_RATES[zone];

    setForm((s) => ({
      ...s,
      municipalityFiscalSnapshot: selectedClient.municipalityFiscal ?? "",
      taxZoneSnapshot: zone,
    }));
    setWithholdingTaxRate(
      safeRate(
        selectedClient.withholdingTaxRate,
        fallbackRates.withholdingTaxRate,
      ),
    );
    setWithholdingIcaRate(
      safeRate(
        selectedClient.withholdingIcaRate,
        fallbackRates.withholdingIcaRate,
      ),
    );
    setWithholdingIvaRate(
      safeRate(
        selectedClient.withholdingIvaRate,
        fallbackRates.withholdingIvaRate,
      ),
    );
  }, [quoteId, selectedClient]);

  useEffect(() => {
    if (!selectedClient) return;

    setForm((s) => ({
      ...s,
      customerName: selectedClient.name ?? "",
      customerEmail: selectedClient.email ?? "",
      documentNumber: selectedClient.identification ?? "",
      documentVerificationDigit: selectedClient.dv ?? "",
      address: selectedClient.address ?? "",
      country: selectedClient.country ?? "COLOMBIA",
      city: selectedClient.city ?? "",
      postalCode: selectedClient.postalCode ?? "",
      contactName: selectedClient.contactName ?? "",
      contactPhone: selectedClient.contactPhone ?? "",
      clientPriceTypeDisplay: selectedClient.priceClientType ?? null,
    }));
  }, [selectedClient]);

  useEffect(() => {
    if (quoteId) return;
    const baseDate = new Date();
    const nextExpiry = buildExpiryDateFromDelivery(
      baseDate.toISOString().split("T")[0] ?? null,
      30,
    );

    if (!nextExpiry) return;

    setForm((s) => ({ ...s, expiryDate: nextExpiry }));
  }, [quoteId]);

  const computed = useQuoteCalculations(
    items,
    shippingEnabled,
    shippingFee,
    insuranceEnabled,
    insuranceFee,
    form.documentType,
  );

  const withholdingTaxAmount = useMemo(
    () => (computed.subtotal * withholdingTaxRate) / 100,
    [computed.subtotal, withholdingTaxRate],
  );
  const withholdingIcaAmount = useMemo(
    () => (computed.subtotal * withholdingIcaRate) / 100,
    [computed.subtotal, withholdingIcaRate],
  );
  const withholdingIvaAmount = useMemo(
    () => (computed.iva * withholdingIvaRate) / 100,
    [computed.iva, withholdingIvaRate],
  );
  const totalWithholdings =
    withholdingTaxAmount + withholdingIcaAmount + withholdingIvaAmount;
  const totalAfterWithholdings = computed.total - totalWithholdings;

  const { quoteCode, submitting, saveQuotation } = useSaveQuotation(
    quoteId,
    quoteId ? "" : "Assigned on save",
  );

  const asMoney = (value: number) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: form.currency === "USD" ? "USD" : "COP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(value) ? value : 0);

  const onFormChange = (updates: Partial<QuoteForm>) => {
    setForm((s) => {
      const next = { ...s, ...updates };

      return next;
    });
  };

  const handleSaveQuotation = async () => {
    if (form.paymentTerms === "CREDITO") {
      const hasActiveCredit = Boolean(selectedClient?.hasCredit);
      const hasPromissoryNumber = Boolean(
        String(
          selectedClient?.promissoryNoteNumber ??
            form.promissoryNoteNumber ??
            "",
        ).trim(),
      );

      if (!hasActiveCredit || !hasPromissoryNumber) {
        toast.error(
          !hasActiveCredit
            ? "The client has no active credit."
            : "The client has no promissory note number registered.",
        );

        return;
      }
    }

    if (mode === "prefactura" && !quoteId) {
      if (creatingPrefactura) return;

      if (!form.clientId) {
        toast.error("Select an active client");

        return;
      }

      const validItems = items.filter(
        (row) => row.productId && row.quantity > 0 && row.unitPrice >= 0,
      );

      if (validItems.length === 0) {
        toast.error("Add at least one valid item");

        return;
      }

      if (hasClientApproval && !clientApprovalImageUrl.trim()) {
        toast.error(
          "You must attach the screenshot/evidence of the client's approval",
        );

        return;
      }

      const orderName = prefacturaOrderName.trim()
        ? prefacturaOrderName.trim()
        : String(form.customerName ?? "").trim()
          ? `Order ${String(form.customerName ?? "").trim()}`
          : "Prefacture order";

      try {
        setCreatingPrefactura(true);
        const created = await apiJson<{ prefactura?: { id: string } }>(
          "/api/prefacturas",
          {
            method: "POST",
            body: JSON.stringify({
              clientId: form.clientId,
              documentType: form.documentType,
              currency: form.currency,
              shippingEnabled,
              shippingFee,
              subtotal: computed.subtotal,
              total: computed.total,
              municipalityFiscalSnapshot: form.municipalityFiscalSnapshot,
              taxZoneSnapshot: form.taxZoneSnapshot,
              withholdingTaxRate,
              withholdingIcaRate,
              withholdingIvaRate,
              withholdingTaxAmount,
              withholdingIcaAmount,
              withholdingIvaAmount,
              totalAfterWithholdings,
              orderName,
              orderType: prefacturaOrderType,
              advanceRequired: hasAdvance ? computed.advancePayment : 0,
              hasConvenio: false,
              hasClientApproval,
              clientApprovalImageUrl: hasClientApproval
                ? clientApprovalImageUrl.trim() || null
                : null,
              items: validItems.map((item) => ({
                productId: item.productId,
                orderType: item.orderType,
                process: item.process,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discount: item.discount,
                orderCodeReference: item.referenceOrderCode ?? null,
                designNumber: item.referenceDesign ?? null,
                additions: item.additions.map((add) => ({
                  id: add.id,
                  quantity: add.quantity,
                  unitPrice: add.unitPrice,
                })),
              })),
            }),
          },
        );

        toast.success("Prefacture created");

        if (!quoteId) {
          try {
            localStorage.removeItem(draftCacheKey);
          } catch {
            // ignore
          }
        }

        if (created?.prefactura?.id) {
          router.push("/erp/pre-invoices");
          router.refresh();

          return;
        }

        router.push("/erp/pre-invoices");
        router.refresh();

        return;
      } catch (error) {
        toast.error(getErrorMessage(error));

        return;
      } finally {
        setCreatingPrefactura(false);
      }
    }

    const formToSave = {
      ...form,
      sellerId: form.sellerId || user?.id || "",
    };

    const saved = await saveQuotation(
      formToSave,
      items,
      computed,
      clientPriceTypeForQuote,
      shippingEnabled,
      shippingFee,
      insuranceEnabled,
      insuranceFee,
      {
        municipalityFiscalSnapshot: form.municipalityFiscalSnapshot,
        taxZoneSnapshot: form.taxZoneSnapshot,
        withholdingTaxRate,
        withholdingIcaRate,
        withholdingIvaRate,
        withholdingTaxAmount,
        withholdingIcaAmount,
        withholdingIvaAmount,
        totalAfterWithholdings,
      },
    );

    if (saved.ok) {
      if (!quoteId) {
        try {
          localStorage.removeItem(draftCacheKey);
        } catch {
          // ignore
        }
      }
      router.push("/quotations");
      router.refresh();
    }
  };

  return (
    <div className="container mx-auto max-w-7xl px-6 py-10 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {quoteId
              ? "Edit quotation"
              : mode === "prefactura"
                ? "Create prefacture"
                : "Create quotation"}
          </h1>
          <p className="text-default-600">
            Code: {loadedQuoteCode || quoteCode}
            {mode === "prefactura" && !quoteId
              ? " (will be created as direct prefacture)"
              : ""}
          </p>
        </div>
        <Button
          variant="flat"
          onPress={() =>
            router.push(
              mode === "prefactura" && !quoteId
                ? "/erp/pre-invoices"
                : "/quotations",
            )
          }
        >
          Back
        </Button>
      </div>

      {mode === "prefactura" && !quoteId ? (
        <Card className="border border-default-200" radius="md" shadow="none">
          <CardBody className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Order name"
              placeholder="E.g: Order Sports Club"
              value={prefacturaOrderName}
              onValueChange={setPrefacturaOrderName}
            />
            <Select
              label="Order type"
              selectedKeys={[prefacturaOrderType]}
              onSelectionChange={(keys) => {
                const first = String(Array.from(keys)[0] ?? "VN");

                setPrefacturaOrderType(
                  first === "VI" || first === "VT" || first === "VW"
                    ? first
                    : "VN",
                );
              }}
            >
              <SelectItem key="VN">VN - National</SelectItem>
              <SelectItem key="VI">VI - International</SelectItem>
              <SelectItem key="VT">VT</SelectItem>
              <SelectItem key="VW">VW</SelectItem>
            </Select>

            <div className="rounded-medium border border-default-200 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Client approval</p>
                  <p className="text-xs text-default-500">
                    Client's commercial confirmation.
                  </p>
                </div>
                <Switch
                  isSelected={hasClientApproval}
                  onValueChange={setHasClientApproval}
                />
              </div>
            </div>

            {hasClientApproval ? (
              <div className="rounded-medium border border-default-200 p-3 md:col-span-2">
                <FileUpload
                  acceptedFileTypes="image/*"
                  label="Screenshot / approval evidence"
                  uploadFolder="prefacturas/avales"
                  value={clientApprovalImageUrl}
                  onChange={setClientApprovalImageUrl}
                  onClear={() => setClientApprovalImageUrl("")}
                />
              </div>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      <Card className="border border-default-200" radius="md" shadow="none">
        <CardHeader className="text-sm font-semibold">
          General Information
        </CardHeader>
        <CardBody className="space-y-4">
          <QuotationsForm
            clients={clients}
            form={form}
            loadingClients={loadingClients || loadingQuote}
            onFormChange={onFormChange}
          />

          <Card className="border border-default-200" radius="md" shadow="none">
            <CardBody className="py-3">
              <p className="text-xs text-default-500">Client type (COP)</p>
              <p className="text-sm font-semibold">{selectedClientPriceType}</p>
            </CardBody>
          </Card>
        </CardBody>
      </Card>

      <QuotationsProductsTable
        additions={additions}
        asMoney={asMoney}
        clientPriceType={selectedClientPriceType}
        currency={form.currency}
        items={items}
        loadingAdditions={loadingAdditions || loadingQuote}
        loadingProducts={loadingProducts || loadingQuote}
        products={products}
        onAddAddition={(itemId, addition) => {
          updateItem(itemId, {
            additions: [
              ...(items.find((i) => i.id === itemId)?.additions ?? []),
              addition,
            ],
          });
        }}
        onAddItem={addItem}
        onRemoveItem={removeItem}
        onUpdateItem={updateItem}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2" />
        <Card
          className="border border-default-200 lg:col-span-1"
          radius="md"
          shadow="none"
        >
          <CardHeader className="text-sm font-semibold">Totals</CardHeader>
          <CardBody className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>{asMoney(computed.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>VAT (19%)</span>
              <span>{asMoney(computed.iva)}</span>
            </div>

            <div className="space-y-2 border-t border-default-200 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Shipping</span>
                <Switch
                  isSelected={shippingEnabled}
                  onValueChange={setShippingEnabled}
                />
              </div>
              <Input
                isDisabled={!shippingEnabled}
                label="Shipping value"
                type="number"
                value={String(shippingFee)}
                variant="flat"
                onValueChange={(v) =>
                  setShippingFee(Math.max(0, Number(v || 0)))
                }
              />
            </div>

            <div className="space-y-2 border-t border-default-200 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Insurance</span>
                <Switch
                  isSelected={insuranceEnabled}
                  onValueChange={setInsuranceEnabled}
                />
              </div>
              <Input
                isDisabled={!insuranceEnabled}
                label="Insurance value"
                type="number"
                value={String(insuranceFee)}
                variant="flat"
                onValueChange={(v) =>
                  setInsuranceFee(Math.max(0, Number(v || 0)))
                }
              />
            </div>

            {mode === "prefactura" ? (
              <div className="space-y-2 border-t border-default-200 pt-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm">Advance</span>
                    <p className="text-xs text-default-500">
                      Commercial control at 50% for the prefacture.
                    </p>
                  </div>
                  <Switch
                    isSelected={hasAdvance}
                    onValueChange={setHasAdvance}
                  />
                </div>
                <div className="flex justify-between text-sm">
                  <span>Advance (50%)</span>
                  <span>
                    {hasAdvance
                      ? asMoney(computed.advancePayment)
                      : "Not applicable"}
                  </span>
                </div>
              </div>
            ) : null}

            <div className="flex justify-between text-sm font-semibold border-t border-default-200 pt-3">
              <span>General Total</span>
              <span>{asMoney(computed.total)}</span>
            </div>

            <div className="space-y-2 border-t border-default-200 pt-3">
              <p className="text-sm font-semibold">Withholdings</p>
              <div className="grid grid-cols-1 gap-2">
                <Input
                  label="Withholding tax (%)"
                  type="number"
                  value={String(withholdingTaxRate)}
                  variant="flat"
                  onValueChange={(v) =>
                    setWithholdingTaxRate(Math.max(0, Number(v || 0)))
                  }
                />
                <Input
                  label="ICA withholding (%)"
                  type="number"
                  value={String(withholdingIcaRate)}
                  variant="flat"
                  onValueChange={(v) =>
                    setWithholdingIcaRate(Math.max(0, Number(v || 0)))
                  }
                />
                <Input
                  label="IVA withholding (%)"
                  type="number"
                  value={String(withholdingIvaRate)}
                  variant="flat"
                  onValueChange={(v) =>
                    setWithholdingIvaRate(Math.max(0, Number(v || 0)))
                  }
                />
              </div>
              <div className="rounded-medium border border-default-200 p-3 text-xs text-default-600">
                <p>
                  Fiscal snapshot:{" "}
                  {form.municipalityFiscalSnapshot || "No municipality"} /{" "}
                  {form.taxZoneSnapshot}
                </p>
              </div>
              <div className="flex justify-between text-sm">
                <span>Withholding value</span>
                <span>{asMoney(withholdingTaxAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>ICA withholding value</span>
                <span>{asMoney(withholdingIcaAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>IVA withholding value</span>
                <span>{asMoney(withholdingIvaAmount)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold">
                <span>Total withholdings</span>
                <span>{asMoney(totalWithholdings)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold text-primary">
                <span>Total after withholdings</span>
                <span>{asMoney(totalAfterWithholdings)}</span>
              </div>
            </div>

            <Button
              color="primary"
              isLoading={submitting || creatingPrefactura}
              onPress={handleSaveQuotation}
            >
              {quoteId
                ? "Save changes"
                : mode === "prefactura"
                  ? "Save prefacture"
                  : "Save quotation"}
            </Button>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
