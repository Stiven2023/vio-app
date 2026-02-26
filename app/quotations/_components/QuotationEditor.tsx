"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Input } from "@heroui/input";
import { Switch } from "@heroui/switch";
import { Button } from "@heroui/button";
import { toast } from "react-hot-toast";

import { useSessionStore } from "@/store/session";
import { apiJson, getErrorMessage } from "@/app/catalog/_lib/api";
import {
  buildDeliveryDateFromItems,
  buildExpiryDateFromDelivery,
  getMaxLeadDays,
} from "@/src/utils/quotation-delivery";
import { QuotationsForm } from "./QuotationsForm";
import { QuotationsProductsTable } from "./QuotationsProductsTable";
import type { ClientPriceType, QuoteForm } from "../_lib/types";
import {
  useClientsData,
  useProductsData,
  useAdditionsData,
  useQuoteItems,
  useQuoteCalculations,
  useSaveQuotation,
} from "../_hooks";

type QuotationEditorProps = {
  quoteId?: string;
};

type QuotationDetailResponse = {
  id: string;
  quoteCode: string;
  clientId: string;
  sellerId: string;
  clientPriceType: ClientPriceType | null;
  documentType: "P" | "R";
  currency: "COP" | "USD";
  deliveryDate: string | null;
  expiryDate: string | null;
  paymentTerms: string | null;
  promissoryNoteNumber: string | null;
  shippingEnabled: boolean | null;
  shippingFee: string | null;
  insuranceEnabled: boolean | null;
  insuranceFee: string | null;
  items: Array<{
    id: string;
    productId: string;
    orderType: "NORMAL" | "COMPLETACION" | "REFERENTE" | "REPOSICION" | "BODEGA";
    negotiation:
      | ""
      | "MUESTRA"
      | "BODEGA"
      | "COMPRAS"
      | "PRODUCCION"
      | "MUESTRA_G"
      | "MUESTRA_C";
    quantity: number;
    unitPrice: number;
    discount: number;
    referenceOrderCode?: string | null;
    referenceDesign?: string | null;
    additions: Array<{ id: string; quantity: number; unitPrice: number }>;
  }>;
};

export function QuotationEditor({ quoteId }: QuotationEditorProps) {
  const router = useRouter();
  const user = useSessionStore((s) => s.user);

  const { clients, loading: loadingClients } = useClientsData();

  const [form, setForm] = useState<QuoteForm>({
    clientId: "",
    sellerId: user?.id ?? "",
    documentType: "P",
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
    deliveryDate: "",
    expiryDate: "",
    paymentTerms: "TRANSFERENCIA",
    promissoryNoteNumber: "",
    clientPriceTypeDisplay: null,
  });

  const [shippingEnabled, setShippingEnabled] = useState(false);
  const [insuranceEnabled, setInsuranceEnabled] = useState(false);
  const [shippingFee, setShippingFee] = useState(0);
  const [insuranceFee, setInsuranceFee] = useState(0);
  const [initialItems, setInitialItems] = useState<QuotationDetailResponse["items"] | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [loadedQuoteCode, setLoadedQuoteCode] = useState("");

  const { products, loading: loadingProducts } = useProductsData(form.currency);
  const { additions, loading: loadingAdditions } = useAdditionsData(form.currency);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === form.clientId) ?? null,
    [clients, form.clientId],
  );

  const isInternationalClient =
    ["CE", "PAS", "EMPRESA_EXTERIOR"].includes(
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

  const estimatedLeadDays = useMemo(() => getMaxLeadDays(items), [items]);

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

        return {
          id: item.id,
          productId: item.productId,
          orderType: item.orderType,
          negotiation:
            item.negotiation === "MUESTRA_G" || item.negotiation === "MUESTRA_C"
              ? "MUESTRA"
              : item.negotiation,
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
    setForm((s) => ({ ...s, seller: user?.name ?? "", sellerId: user?.id ?? "" }));
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
          documentType: quote.documentType ?? "P",
          currency: quote.currency,
          deliveryDate: quote.deliveryDate ?? "",
          expiryDate: quote.expiryDate ?? "",
          paymentTerms: quote.paymentTerms ?? "TRANSFERENCIA",
          promissoryNoteNumber: quote.promissoryNoteNumber ?? "",
        }));

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
    if (!items.length) return;

    const nextDelivery = buildDeliveryDateFromItems(items);
    const nextExpiry = buildExpiryDateFromDelivery(nextDelivery, 30);

    if (!nextDelivery || !nextExpiry) return;

    setForm((s) => {
      if (s.deliveryDate === nextDelivery && s.expiryDate === nextExpiry) {
        return s;
      }

      return {
        ...s,
        deliveryDate: nextDelivery,
        expiryDate: nextExpiry,
      };
    });
  }, [items]);

  const computed = useQuoteCalculations(
    items,
    shippingEnabled,
    shippingFee,
    insuranceEnabled,
    insuranceFee,
    form.documentType,
  );

  const { quoteCode, submitting, saveQuotation } = useSaveQuotation(
    quoteId,
    quoteId ? "" : "Se asigna al guardar",
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

      if (updates.deliveryDate !== undefined && updates.deliveryDate) {
        const deliveryDate = new Date(updates.deliveryDate);
        const expiryDate = new Date(deliveryDate);
        expiryDate.setDate(expiryDate.getDate() + 30);
        next.expiryDate = expiryDate.toISOString().split("T")[0];
      }

      return next;
    });
  };

  const handleSaveQuotation = async () => {
    if (form.paymentTerms === "CREDITO") {
      const hasActiveCredit = Boolean(selectedClient?.hasCredit);
      const hasPromissoryNumber = Boolean(
        String(selectedClient?.promissoryNoteNumber ?? form.promissoryNoteNumber ?? "").trim(),
      );

      if (!hasActiveCredit || !hasPromissoryNumber) {
        toast.error(
          !hasActiveCredit
            ? "El cliente no tiene crédito activo."
            : "El cliente no tiene número de pagaré registrado.",
        );
        return;
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
    );

    if (saved) {
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
            {quoteId ? "Editar cotización" : "Crear cotización"}
          </h1>
          <p className="text-default-600">Código: {loadedQuoteCode || quoteCode}</p>
        </div>
        <Button variant="flat" onPress={() => router.push("/quotations")}>Volver</Button>
      </div>

      <Card radius="md" shadow="none" className="border border-default-200">
        <CardHeader className="text-sm font-semibold">Información General</CardHeader>
        <CardBody className="space-y-4">
          <QuotationsForm
            form={form}
            clients={clients}
            loadingClients={loadingClients || loadingQuote}
            estimatedLeadDays={estimatedLeadDays}
            onFormChange={onFormChange}
          />

          <Card radius="md" shadow="none" className="border border-default-200">
            <CardBody className="py-3">
              <p className="text-xs text-default-500">Tipo de cliente (COP)</p>
              <p className="text-sm font-semibold">{selectedClientPriceType}</p>
            </CardBody>
          </Card>
        </CardBody>
      </Card>

      <QuotationsProductsTable
        items={items}
        products={products}
        additions={additions}
        currency={form.currency}
        clientPriceType={selectedClientPriceType}
        loadingProducts={loadingProducts || loadingQuote}
        loadingAdditions={loadingAdditions || loadingQuote}
        onAddItem={addItem}
        onUpdateItem={updateItem}
        onRemoveItem={removeItem}
        onAddAddition={(itemId, addition) => {
          updateItem(itemId, {
            additions: [...(items.find((i) => i.id === itemId)?.additions ?? []), addition],
          });
        }}
        asMoney={asMoney}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2" />
        <Card radius="md" shadow="none" className="border border-default-200 lg:col-span-1">
          <CardHeader className="text-sm font-semibold">Totales</CardHeader>
          <CardBody className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>{asMoney(computed.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>IVA (19%)</span>
              <span>{asMoney(computed.iva)}</span>
            </div>

            <div className="space-y-2 border-t border-default-200 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Envío</span>
                <Switch isSelected={shippingEnabled} onValueChange={setShippingEnabled} />
              </div>
              <Input
                isDisabled={!shippingEnabled}
                label="Valor envío"
                type="number"
                value={String(shippingFee)}
                variant="flat"
                onValueChange={(v) => setShippingFee(Math.max(0, Number(v || 0)))}
              />
            </div>

            <div className="space-y-2 border-t border-default-200 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Seguro</span>
                <Switch isSelected={insuranceEnabled} onValueChange={setInsuranceEnabled} />
              </div>
              <Input
                isDisabled={!insuranceEnabled}
                label="Valor seguro"
                type="number"
                value={String(insuranceFee)}
                variant="flat"
                onValueChange={(v) => setInsuranceFee(Math.max(0, Number(v || 0)))}
              />
            </div>

            <div className="flex justify-between text-sm font-semibold border-t border-default-200 pt-3">
              <span>Total General</span>
              <span>{asMoney(computed.total)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Anticipo (50%)</span>
              <span>{asMoney(computed.advancePayment)}</span>
            </div>

            <Button color="primary" isLoading={submitting} onPress={handleSaveQuotation}>
              {quoteId ? "Guardar cambios" : "Guardar cotización"}
            </Button>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
