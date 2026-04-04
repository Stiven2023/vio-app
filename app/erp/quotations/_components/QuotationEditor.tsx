"use client";

import type {
  ClientPriceType,
  PrefactureOrderType,
  QuoteForm,
  QuoteProcess,
  TaxZone,
} from "../_lib/types";

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
  useQuotationUiLocale,
} from "../_hooks";

import { QuotationsForm } from "./QuotationsForm";
import { QuotationsProductsTable } from "./QuotationsProductsTable";
import {
  DEFAULT_COUNTRY,
  DEFAULT_PAYMENT_TERM,
  getPrefactureOrderTypeOptions,
  QUOTATION_COPY,
} from "../_lib/constants";
import {
  normalizeTaxZone,
  safeRate,
  TAX_ZONE_DEFAULT_RATES,
} from "../_lib/utils";

import { useSessionStore } from "@/store/session";
import { FileUpload } from "@/components/file-upload";
import { apiJson, getErrorMessage } from "@/app/erp/catalog/_lib/api";
import { buildExpiryDateFromDelivery } from "@/src/utils/quotation-delivery";

type QuotationEditorProps = {
  quoteId?: string;
  mode?: "quotation" | "prefactura";
};

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
    process: QuoteProcess;
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
  const locale = useQuotationUiLocale();
  const copy = QUOTATION_COPY[locale];
  const prefactureOrderTypeOptions = getPrefactureOrderTypeOptions(locale);
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
    country: DEFAULT_COUNTRY,
    city: "",
    postalCode: "",
    seller: user?.name ?? "",
    currency: "COP",
    expiryDate: "",
    paymentTerms: DEFAULT_PAYMENT_TERM,
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
    useState<PrefactureOrderType>("VN");
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
    form.clientPriceTypeDisplay ?? selectedClient?.priceClientType ?? "VIOMAR";
  const clientPriceTypeForQuote: ClientPriceType | null = isInternationalClient
    ? form.currency === "COP"
      ? selectedClientPriceType
      : null
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
          paymentTerms:
            quote.paymentTerms === "EFECTIVO" ||
            quote.paymentTerms === "TARJETA" ||
            quote.paymentTerms === "CHEQUE" ||
            quote.paymentTerms === "CREDITO" ||
            quote.paymentTerms === "OTROS" ||
            quote.paymentTerms === "TRANSFERENCIA"
              ? quote.paymentTerms
              : DEFAULT_PAYMENT_TERM,
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
      country: selectedClient.country ?? DEFAULT_COUNTRY,
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

  const chargesEnabled = form.documentType === "F";
  const effectiveWithholdingTaxRate = chargesEnabled ? withholdingTaxRate : 0;
  const effectiveWithholdingIcaRate = chargesEnabled ? withholdingIcaRate : 0;
  const effectiveWithholdingIvaRate = chargesEnabled ? withholdingIvaRate : 0;

  const withholdingTaxAmount = useMemo(
    () => (computed.subtotal * effectiveWithholdingTaxRate) / 100,
    [computed.subtotal, effectiveWithholdingTaxRate],
  );
  const withholdingIcaAmount = useMemo(
    () => (computed.subtotal * effectiveWithholdingIcaRate) / 100,
    [computed.subtotal, effectiveWithholdingIcaRate],
  );
  const withholdingIvaAmount = useMemo(
    () => (computed.iva * effectiveWithholdingIvaRate) / 100,
    [computed.iva, effectiveWithholdingIvaRate],
  );
  const totalWithholdings =
    withholdingTaxAmount + withholdingIcaAmount + withholdingIvaAmount;
  const totalAfterWithholdings = chargesEnabled
    ? computed.total - totalWithholdings
    : computed.total;

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
            ? copy.editor.validation.noCredit
            : copy.editor.validation.noPromissory,
        );

        return;
      }
    }

    if (mode === "prefactura" && !quoteId) {
      if (creatingPrefactura) return;

      if (!form.clientId) {
        toast.error(copy.toasts.selectClient);

        return;
      }

      const validItems = items.filter(
        (row) => row.productId && row.quantity > 0 && row.unitPrice >= 0,
      );

      if (validItems.length === 0) {
        toast.error(copy.toasts.addValidItem);

        return;
      }

      if (hasClientApproval && !clientApprovalImageUrl.trim()) {
        toast.error(copy.editor.validation.approvalEvidenceRequired);

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
              clientPriceType:
                form.currency === "COP" ? selectedClientPriceType : null,
              withholdingTaxRate: effectiveWithholdingTaxRate,
              withholdingIcaRate: effectiveWithholdingIcaRate,
              withholdingIvaRate: effectiveWithholdingIvaRate,
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

        toast.success(copy.editor.validation.prefactureCreated);

        if (!quoteId) {
          try {
            localStorage.removeItem(draftCacheKey);
          } catch {
            // ignore
          }
        }

        if (created?.prefactura?.id) {
          router.replace("/erp/pre-invoices");

          return;
        }

        router.replace("/erp/pre-invoices");

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
        withholdingTaxRate: effectiveWithholdingTaxRate,
        withholdingIcaRate: effectiveWithholdingIcaRate,
        withholdingIvaRate: effectiveWithholdingIvaRate,
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
      router.replace("/quotations");
    }
  };

  return (
    <div className="container mx-auto max-w-7xl px-6 py-10 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {quoteId
              ? copy.editor.titleEdit
              : mode === "prefactura"
                ? copy.editor.titleCreatePrefacture
                : copy.editor.titleCreate}
          </h1>
          <p className="text-default-600">
            {copy.editor.code}: {loadedQuoteCode || quoteCode}
            {mode === "prefactura" && !quoteId
              ? ` ${copy.editor.directPrefactureNote}`
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
          {copy.editor.back}
        </Button>
      </div>

      {mode === "prefactura" && !quoteId ? (
        <Card className="border border-default-200" radius="md" shadow="none">
          <CardBody className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label={copy.editor.orderName}
              placeholder={copy.editor.orderNamePlaceholder}
              value={prefacturaOrderName}
              onValueChange={setPrefacturaOrderName}
            />
            <Select
              label={copy.editor.orderType}
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
              {prefactureOrderTypeOptions.map((option) => (
                <SelectItem key={option.value}>{option.label}</SelectItem>
              ))}
            </Select>

            <div className="rounded-medium border border-default-200 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">
                    {copy.editor.clientApproval}
                  </p>
                  <p className="text-xs text-default-500">
                    {copy.editor.clientApprovalHelp}
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
                  label={copy.editor.approvalEvidence}
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
          {copy.editor.generalInformation}
        </CardHeader>
        <CardBody className="space-y-4">
          <QuotationsForm
            clients={clients}
            form={form}
            loadingClients={loadingClients || loadingQuote}
            onFormChange={onFormChange}
          />
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
          <CardHeader className="text-sm font-semibold">
            {copy.editor.totals}
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>{copy.editor.subtotal}</span>
              <span>{asMoney(computed.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>{copy.editor.vat}</span>
              <span>{asMoney(computed.iva)}</span>
            </div>

            <div className="space-y-2 border-t border-default-200 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">{copy.editor.shipping}</span>
                <Switch
                  isSelected={shippingEnabled}
                  onValueChange={setShippingEnabled}
                />
              </div>
              <Input
                isDisabled={!shippingEnabled}
                label={copy.editor.shippingValue}
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
                <span className="text-sm">{copy.editor.insurance}</span>
                <Switch
                  isSelected={insuranceEnabled}
                  onValueChange={setInsuranceEnabled}
                />
              </div>
              <Input
                isDisabled={!insuranceEnabled}
                label={copy.editor.insuranceValue}
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
                    <span className="text-sm">{copy.editor.advance}</span>
                    <p className="text-xs text-default-500">
                      {copy.editor.advanceHelp}
                    </p>
                  </div>
                  <Switch
                    isSelected={hasAdvance}
                    onValueChange={setHasAdvance}
                  />
                </div>
                <div className="flex justify-between text-sm">
                  <span>{copy.editor.advanceAmount}</span>
                  <span>
                    {hasAdvance
                      ? asMoney(computed.advancePayment)
                      : copy.editor.notApplicable}
                  </span>
                </div>
              </div>
            ) : null}

            <div className="flex justify-between text-sm font-semibold border-t border-default-200 pt-3">
              <span>{copy.editor.generalTotal}</span>
              <span>{asMoney(computed.total)}</span>
            </div>

            <div className="space-y-2 border-t border-default-200 pt-3">
              <p className="text-sm font-semibold">{copy.editor.withholdings}</p>
              <div className="grid grid-cols-1 gap-2">
                <Input
                  isDisabled={!chargesEnabled}
                  label={copy.editor.withholdingTax}
                  type="number"
                  value={String(effectiveWithholdingTaxRate)}
                  variant="flat"
                  onValueChange={(v) =>
                    setWithholdingTaxRate(Math.max(0, Number(v || 0)))
                  }
                />
                <Input
                  isDisabled={!chargesEnabled}
                  label={copy.editor.withholdingIca}
                  type="number"
                  value={String(effectiveWithholdingIcaRate)}
                  variant="flat"
                  onValueChange={(v) =>
                    setWithholdingIcaRate(Math.max(0, Number(v || 0)))
                  }
                />
                <Input
                  isDisabled={!chargesEnabled}
                  label={copy.editor.withholdingIva}
                  type="number"
                  value={String(effectiveWithholdingIvaRate)}
                  variant="flat"
                  onValueChange={(v) =>
                    setWithholdingIvaRate(Math.max(0, Number(v || 0)))
                  }
                />
              </div>
              {!chargesEnabled ? (
                <p className="text-xs text-default-500">
                  {copy.editor.noTaxesForR}
                </p>
              ) : null}
              <div className="rounded-medium border border-default-200 p-3 text-xs text-default-600">
                <p>
                  {copy.editor.fiscalSnapshot}:{" "}
                  {form.municipalityFiscalSnapshot || copy.editor.noMunicipality} /{" "}
                  {form.taxZoneSnapshot}
                </p>
              </div>
              <div className="flex justify-between text-sm">
                <span>{copy.editor.withholdingTaxValue}</span>
                <span>{asMoney(withholdingTaxAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>{copy.editor.withholdingIcaValue}</span>
                <span>{asMoney(withholdingIcaAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>{copy.editor.withholdingIvaValue}</span>
                <span>{asMoney(withholdingIvaAmount)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold">
                <span>{copy.editor.totalWithholdings}</span>
                <span>{asMoney(totalWithholdings)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold text-primary">
                <span>{copy.editor.totalAfterWithholdings}</span>
                <span>{asMoney(totalAfterWithholdings)}</span>
              </div>
            </div>

            <Button
              color="primary"
              isDisabled={submitting || creatingPrefactura}
              onPress={handleSaveQuotation}
            >
              {submitting || creatingPrefactura
                ? copy.editor.saving
                : quoteId
                  ? copy.editor.saveChanges
                  : mode === "prefactura"
                    ? copy.editor.savePrefacture
                    : copy.editor.saveQuotation}
            </Button>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
