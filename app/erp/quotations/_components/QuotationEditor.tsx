"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Input } from "@heroui/input";
import { Switch } from "@heroui/switch";
import { Button } from "@heroui/button";
import { Select, SelectItem } from "@heroui/select";
import { toast } from "react-hot-toast";

import { useSessionStore } from "@/store/session";
import { apiJson, getErrorMessage } from "@/app/erp/catalog/_lib/api";
import {
  buildExpiryDateFromDelivery,
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
  mode?: "quotation" | "prefactura";
};

type PrefacturaOrderType = "VN" | "VI" | "VT" | "VW";

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

export function QuotationEditor({ quoteId, mode = "quotation" }: QuotationEditorProps) {
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
  });

  const [shippingEnabled, setShippingEnabled] = useState(false);
  const [insuranceEnabled, setInsuranceEnabled] = useState(false);
  const [shippingFee, setShippingFee] = useState(0);
  const [insuranceFee, setInsuranceFee] = useState(0);
  const [initialItems, setInitialItems] = useState<QuotationDetailResponse["items"] | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [loadedQuoteCode, setLoadedQuoteCode] = useState("");
  const [prefacturaOrderType, setPrefacturaOrderType] =
    useState<PrefacturaOrderType>("VN");
  const [prefacturaOrderName, setPrefacturaOrderName] = useState("");
  const [hasConvenio, setHasConvenio] = useState(false);
  const [hasClientApproval, setHasClientApproval] = useState(false);
  const [hasAdvance, setHasAdvance] = useState(true);
  const [creatingPrefactura, setCreatingPrefactura] = useState(false);

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
        const normalizedOrderType = item.orderType === "BODEGA" ? "REPOSICION" : item.orderType;

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
          documentType: quote.documentType ?? "F",
          currency: quote.currency,
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
    if (!hasConvenio) {
      setHasAdvance(true);
    }
  }, [hasConvenio]);

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

    if (mode === "prefactura" && !quoteId) {
      if (creatingPrefactura) return;

      if (!form.clientId) {
        toast.error("Selecciona un cliente activo");
        return;
      }

      const validItems = items.filter(
        (row) => row.productId && row.quantity > 0 && row.unitPrice >= 0,
      );

      if (validItems.length === 0) {
        toast.error("Agrega al menos un item válido");
        return;
      }

      const orderName = prefacturaOrderName.trim()
        ? prefacturaOrderName.trim()
        : String(form.customerName ?? "").trim()
          ? `Pedido ${String(form.customerName ?? "").trim()}`
          : "Pedido prefactura";

      try {
        setCreatingPrefactura(true);
        const created = await apiJson<{ prefactura?: { id: string } }>("/api/prefacturas", {
          method: "POST",
          body: JSON.stringify({
            clientId: form.clientId,
            documentType: form.documentType,
            currency: form.currency,
            shippingEnabled,
            shippingFee,
            subtotal: computed.subtotal,
            total: computed.total,
            orderName,
            orderType: prefacturaOrderType,
            advanceRequired: hasAdvance ? computed.advancePayment : 0,
            hasConvenio,
            hasClientApproval,
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
        });

        toast.success("Prefactura creada");

        if (!quoteId) {
          try {
            localStorage.removeItem(draftCacheKey);
          } catch {
            // ignore
          }
        }

        if (created?.prefactura?.id) {
          router.push("/prefacturas");
          router.refresh();
          return;
        }

        router.push("/prefacturas");
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
              ? "Editar cotización"
              : mode === "prefactura"
                ? "Crear prefactura"
                : "Crear cotización"}
          </h1>
          <p className="text-default-600">
            Código: {loadedQuoteCode || quoteCode}
            {mode === "prefactura" && !quoteId ? " (se creará como prefactura directa)" : ""}
          </p>
        </div>
        <Button
          variant="flat"
          onPress={() =>
            router.push(mode === "prefactura" && !quoteId ? "/prefacturas" : "/quotations")
          }
        >
          Volver
        </Button>
      </div>

      {mode === "prefactura" && !quoteId ? (
        <Card radius="md" shadow="none" className="border border-default-200">
          <CardBody className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Nombre del pedido"
              placeholder="Ej: Pedido Club Deportivo"
              value={prefacturaOrderName}
              onValueChange={setPrefacturaOrderName}
            />
            <Select
              label="Tipo de pedido"
              selectedKeys={[prefacturaOrderType]}
              onSelectionChange={(keys) => {
                const first = String(Array.from(keys)[0] ?? "VN");
                setPrefacturaOrderType(
                  first === "VI" || first === "VT" || first === "VW" ? first : "VN",
                );
              }}
            >
              <SelectItem key="VN">VN - Nacional</SelectItem>
              <SelectItem key="VI">VI - Internacional</SelectItem>
              <SelectItem key="VT">VT</SelectItem>
              <SelectItem key="VW">VW</SelectItem>
            </Select>

            <div className="rounded-medium border border-default-200 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Convenio</p>
                  <p className="text-xs text-default-500">Habilita edición del anticipo.</p>
                </div>
                <Switch isSelected={hasConvenio} onValueChange={setHasConvenio} />
              </div>
            </div>

            <div className="rounded-medium border border-default-200 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Aval del cliente</p>
                  <p className="text-xs text-default-500">Confirmación comercial del cliente.</p>
                </div>
                <Switch isSelected={hasClientApproval} onValueChange={setHasClientApproval} />
              </div>
            </div>

            <div className="rounded-medium border border-default-200 p-3 md:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Anticipo</p>
                  <p className="text-xs text-default-500">
                    Inicia en true y solo se puede cambiar cuando Convenio está en true.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-default-500">{hasAdvance ? "true" : "false"}</span>
                  <Switch
                    isDisabled={!hasConvenio}
                    isSelected={hasAdvance}
                    onValueChange={setHasAdvance}
                  />
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <Card radius="md" shadow="none" className="border border-default-200">
        <CardHeader className="text-sm font-semibold">Información General</CardHeader>
        <CardBody className="space-y-4">
          <QuotationsForm
            form={form}
            clients={clients}
            loadingClients={loadingClients || loadingQuote}
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

            <Button
              color="primary"
              isLoading={submitting || creatingPrefactura}
              onPress={handleSaveQuotation}
            >
              {quoteId ? "Guardar cambios" : mode === "prefactura" ? "Guardar prefactura" : "Guardar cotización"}
            </Button>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
