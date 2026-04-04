"use client";

import type {
  Addition,
  AdditionOption,
  ClientPriceType,
  Currency,
  QuoteItem,
} from "../_lib/types";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";

import { QUOTATION_COPY } from "../_lib/constants";
import { useQuotationUiLocale } from "../_hooks/useQuotationUiLocale";
import { apiJson } from "@/app/erp/catalog/_lib/api";

type QuotationsAdditionsPanelProps = {
  row: QuoteItem;
  additions: AdditionOption[];
  currency: Currency;
  clientPriceType: ClientPriceType;
  loadingAdditions: boolean;
  onUpdateItem: (id: string, patch: Partial<QuoteItem>) => void;
  onAddAddition: (id: string, addition: Addition) => void;
  asMoney: (value: number) => string;
};

export function QuotationsAdditionsPanel({
  row,
  additions,
  currency,
  clientPriceType,
  loadingAdditions,
  onUpdateItem,
  onAddAddition,
  asMoney,
}: QuotationsAdditionsPanelProps) {
  const locale = useQuotationUiLocale();
  const copy = QUOTATION_COPY[locale].additions;
  const isAuthorizedManual =
    currency === "COP" && clientPriceType === "AUTORIZADO";
  const isConditional = ["COMPLETACION", "REFERENTE", "REPOSICION"].includes(
    row.orderType,
  );

  const [orderSearch, setOrderSearch] = useState(row.referenceOrderCode ?? "");
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderOptions, setOrderOptions] = useState<
    Array<{
      id: string;
      orderCode: string;
      status: string | null;
      kind: string | null;
      currency: string | null;
      clientName: string | null;
      itemCount: number;
    }>
  >([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");

  const [designsLoading, setDesignsLoading] = useState(false);
  const [designOptions, setDesignOptions] = useState<
    Array<{
      id: string;
      designNumber: string;
      designName: string;
      previewImageUrl: string | null;
      quantity: number | null;
      status: string | null;
    }>
  >([]);

  const selectedOrder = useMemo(
    () => orderOptions.find((order) => order.id === selectedOrderId) ?? null,
    [orderOptions, selectedOrderId],
  );
  const selectedDesign = useMemo(
    () =>
      designOptions.find(
        (design) =>
          design.id === (row.referenceDesign ?? "") ||
          design.designNumber === (row.referenceDesign ?? ""),
      ) ?? null,
    [designOptions, row.referenceDesign],
  );

  useEffect(() => {
    setOrderSearch(row.referenceOrderCode ?? "");
  }, [row.referenceOrderCode]);

  useEffect(() => {
    if (!isConditional) return;
    const code = orderSearch.trim();

    if (!code) {
      setOrderOptions([]);
      setSelectedOrderId("");
      setDesignOptions([]);

      return;
    }

    const timer = setTimeout(() => {
      setOrdersLoading(true);
      apiJson<{ orders: Array<any> }>(
        `/api/quotations/references?q=${encodeURIComponent(code)}`,
      )
        .then((res) => {
          setOrderOptions(res.orders ?? []);
          const exact = (res.orders ?? []).find(
            (order) => order.orderCode === code,
          );

          if (exact) setSelectedOrderId(exact.id);
        })
        .catch(() => {
          setOrderOptions([]);
        })
        .finally(() => {
          setOrdersLoading(false);
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [isConditional, orderSearch]);

  useEffect(() => {
    if (!isConditional || !selectedOrderId) {
      setDesignOptions([]);

      return;
    }

    setDesignsLoading(true);
    apiJson<{ designs: Array<any> }>(
      `/api/quotations/references?orderId=${encodeURIComponent(selectedOrderId)}`,
    )
      .then((res) => {
        setDesignOptions(res.designs ?? []);
      })
      .catch(() => {
        setDesignOptions([]);
      })
      .finally(() => {
        setDesignsLoading(false);
      });
  }, [isConditional, selectedOrderId]);

  return (
    <Card className="border border-default-200 mt-2" radius="md" shadow="none">
      <CardHeader className="flex items-center justify-between">
        <span className="text-sm font-semibold">
          {copy.titleForProduct(row.product)}
        </span>
        <Button
          color="primary"
          size="sm"
          variant="light"
          onPress={() => {
            const newAddition: Addition = {
              id: "",
              quantity: row.quantity,
              unitPrice: 0,
            };

            onAddAddition(row.id, newAddition);
          }}
        >
          + {copy.addAddition}
        </Button>
      </CardHeader>
      <CardBody className="space-y-3">
        {/* Campos de referencia si es condicional */}
        {isConditional && (
          <div className="space-y-3 rounded-lg border border-default-200 bg-default-50 dark:bg-default-100/10 p-3">
            <p className="text-xs font-semibold text-default-600">
              {copy.conditionalReferenceSection}
            </p>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <Input
                label={copy.searchOrderByCode}
                placeholder={copy.searchOrderPlaceholder}
                size="sm"
                value={orderSearch}
                variant="bordered"
                onValueChange={setOrderSearch}
              />

              <Select
                isLoading={ordersLoading}
                label={copy.referenceOrder}
                selectedKeys={selectedOrderId ? [selectedOrderId] : []}
                size="sm"
                variant="bordered"
                onSelectionChange={(keys) => {
                  const first = String(Array.from(keys)[0] ?? "");
                  const selected = orderOptions.find(
                    (order) => order.id === first,
                  );

                  setSelectedOrderId(first);
                  onUpdateItem(row.id, {
                    referenceOrderCode: selected?.orderCode ?? "",
                    referenceDesign: "",
                  });
                }}
              >
                {orderOptions.map((order) => (
                  <SelectItem
                    key={order.id}
                  >{`${order.orderCode} · ${order.clientName ?? copy.noClient}`}</SelectItem>
                ))}
              </Select>

              <Select
                isDisabled={!selectedOrderId}
                isLoading={designsLoading}
                label={copy.referenceDesign}
                selectedKeys={row.referenceDesign ? [row.referenceDesign] : []}
                size="sm"
                variant="bordered"
                onSelectionChange={(keys) => {
                  const first = String(Array.from(keys)[0] ?? "");

                  onUpdateItem(row.id, { referenceDesign: first });
                }}
              >
                {designOptions.map((design) => (
                  <SelectItem
                    key={design.id}
                  >{`${design.designNumber} · ${design.designName}`}</SelectItem>
                ))}
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="rounded-md border border-default-200 bg-content1 p-3">
                <p className="text-xs font-semibold text-default-600">
                  {copy.orderPreview}
                </p>
                {selectedOrder ? (
                  <div className="mt-1 space-y-1 text-xs text-default-700">
                    <p>
                      <span className="font-medium">{copy.orderCode}:</span>{" "}
                      {selectedOrder.orderCode}
                    </p>
                    <p>
                      <span className="font-medium">{copy.client}:</span>{" "}
                      {selectedOrder.clientName ?? "-"}
                    </p>
                    <p>
                      <span className="font-medium">{copy.type}:</span>{" "}
                      {selectedOrder.kind ?? "-"}
                    </p>
                    <p>
                      <span className="font-medium">{copy.status}:</span>{" "}
                      {selectedOrder.status ?? "-"}
                    </p>
                    <p>
                      <span className="font-medium">{copy.designs}:</span>{" "}
                      {selectedOrder.itemCount ?? 0}
                    </p>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-default-500">
                    {copy.selectOrderSummary}
                  </p>
                )}
              </div>

              <div className="rounded-md border border-default-200 bg-content1 p-3">
                <p className="text-xs font-semibold text-default-600">
                  {copy.designPreview}
                </p>
                {selectedDesign ? (
                  <div className="mt-1 space-y-2 text-xs text-default-700">
                    <p>
                      <span className="font-medium">{copy.number}:</span>{" "}
                      {selectedDesign.designNumber}
                    </p>
                    <p>
                      <span className="font-medium">{copy.name}:</span>{" "}
                      {selectedDesign.designName}
                    </p>
                    <p>
                      <span className="font-medium">{copy.status}:</span>{" "}
                      {selectedDesign.status ?? "-"}
                    </p>
                    <p>
                      <span className="font-medium">{copy.quantity}:</span>{" "}
                      {selectedDesign.quantity ?? 0}
                    </p>
                    {selectedDesign.previewImageUrl ? (
                      <img
                        alt={`Design ${selectedDesign.designNumber}`}
                        className="h-28 w-full rounded border border-default-200 object-cover"
                        src={selectedDesign.previewImageUrl}
                      />
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-default-500">
                    {copy.selectDesignPreview}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Additions list */}
        {row.additions.length === 0 ? (
          <p className="text-xs text-default-500">
            {copy.empty}
          </p>
        ) : (
          <div className="space-y-2">
            {row.additions.map((add, addIndex) => {
              const addTotal = row.quantity * add.unitPrice;

              return (
                <div
                  key={`${row.id}-${addIndex}`}
                  className="flex gap-2 items-center bg-content1 p-2 rounded border border-default-200"
                >
                  <Select
                    className="flex-1 min-w-64"
                    isLoading={loadingAdditions}
                    label={copy.addition}
                    placeholder={copy.selectProduct}
                    selectedKeys={add.id ? [add.id] : []}
                    size="sm"
                    variant="flat"
                    onSelectionChange={(keys) => {
                      const first = String(Array.from(keys)[0] ?? "");
                      const selectedAddition = additions.find(
                        (p) => p.id === first,
                      );
                      const updated = row.additions.map((a, index) =>
                        index === addIndex
                          ? {
                              ...a,
                              id: first,
                              quantity: row.quantity,
                              unitPrice:
                                selectedAddition && !isAuthorizedManual
                                  ? Number(
                                      currency === "USD"
                                        ? (selectedAddition.priceUSD ?? 0)
                                        : (selectedAddition.priceCopBase ?? 0),
                                    )
                                  : isAuthorizedManual
                                    ? 0
                                    : add.unitPrice,
                            }
                          : a,
                      );

                      onUpdateItem(row.id, { additions: updated });
                    }}
                  >
                    {additions.map((addition) => (
                      <SelectItem key={addition.id}>
                        {`${addition.additionCode ?? "-"} - ${addition.name}`}
                      </SelectItem>
                    ))}
                  </Select>
                  <Input
                    isReadOnly
                    classNames={{ input: "w-16 text-center" }}
                    label={copy.qty}
                    size="sm"
                    type="number"
                    value={String(row.quantity)}
                    variant="flat"
                  />
                  <Input
                    classNames={{ input: "w-20 text-center" }}
                    isReadOnly={!isAuthorizedManual}
                    placeholder={copy.valuePlaceholder(currency)}
                    size="sm"
                    type="number"
                    value={String(add.unitPrice)}
                    variant="flat"
                    onValueChange={(v) => {
                      if (!isAuthorizedManual) return;
                      const updated = row.additions.map((a, index) =>
                        index === addIndex
                          ? {
                              ...a,
                              quantity: row.quantity,
                              unitPrice: Math.max(0, Number(v || 0)),
                            }
                          : a,
                      );

                      onUpdateItem(row.id, { additions: updated });
                    }}
                  />
                  <span className="text-xs font-semibold w-24 text-right">{`${asMoney(addTotal)} ${currency}`}</span>
                  <Button
                    color="danger"
                    size="sm"
                    variant="light"
                    onPress={() => {
                      const updated = row.additions.filter(
                        (_, index) => index !== addIndex,
                      );

                      onUpdateItem(row.id, { additions: updated });
                    }}
                  >
                    {copy.remove}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
