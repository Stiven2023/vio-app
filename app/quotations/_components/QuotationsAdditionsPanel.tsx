"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";

import { apiJson } from "@/app/catalog/_lib/api";

import type {
  Addition,
  AdditionOption,
  ClientPriceType,
  Currency,
  QuoteItem,
} from "../_lib/types";

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
  const isAuthorizedManual = currency === "COP" && clientPriceType === "AUTORIZADO";
  const isConditional = ["COMPLETACION", "REFERENTE", "REPOSICION"].includes(row.orderType);

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
        (design) => design.designNumber === (row.referenceDesign ?? ""),
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
      apiJson<{ orders: Array<any> }>(`/api/quotations/references?q=${encodeURIComponent(code)}`)
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
    apiJson<{ designs: Array<any> }>(`/api/quotations/references?orderId=${encodeURIComponent(selectedOrderId)}`)
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
    <Card radius="md" shadow="none" className="border border-default-200 mt-2">
      <CardHeader className="flex items-center justify-between">
        <span className="text-sm font-semibold">Adiciones para {row.product}</span>
        <Button
          size="sm"
          variant="light"
          color="primary"
          onPress={() => {
            const newAddition: Addition = {
              id: "",
              quantity: row.quantity,
              unitPrice: 0,
            };
            onAddAddition(row.id, newAddition);
          }}
        >
          + Agregar Adición
        </Button>
      </CardHeader>
      <CardBody className="space-y-3">
        {/* Campos de referencia si es condicional */}
        {isConditional && (
          <div className="space-y-3 rounded-lg border border-default-200 bg-default-50 dark:bg-default-100/10 p-3">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <Input
                size="sm"
                label="Buscar pedido por código"
                placeholder="Ej: PED-001"
                value={orderSearch}
                variant="bordered"
                onValueChange={setOrderSearch}
              />

              <Select
                size="sm"
                label="Order Code"
                variant="bordered"
                isLoading={ordersLoading}
                selectedKeys={selectedOrderId ? [selectedOrderId] : []}
                onSelectionChange={(keys) => {
                  const first = String(Array.from(keys)[0] ?? "");
                  const selected = orderOptions.find((order) => order.id === first);
                  setSelectedOrderId(first);
                  onUpdateItem(row.id, {
                    referenceOrderCode: selected?.orderCode ?? "",
                    referenceDesign: "",
                  });
                }}
              >
                {orderOptions.map((order) => (
                  <SelectItem key={order.id}>{`${order.orderCode} · ${order.clientName ?? "Sin cliente"}`}</SelectItem>
                ))}
              </Select>

              <Select
                size="sm"
                label="Número de diseño"
                variant="bordered"
                isLoading={designsLoading}
                isDisabled={!selectedOrderId}
                selectedKeys={row.referenceDesign ? [row.referenceDesign] : []}
                onSelectionChange={(keys) => {
                  const first = String(Array.from(keys)[0] ?? "");
                  onUpdateItem(row.id, { referenceDesign: first });
                }}
              >
                {designOptions.map((design) => (
                  <SelectItem key={design.designNumber}>{`${design.designNumber} · ${design.designName}`}</SelectItem>
                ))}
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="rounded-md border border-default-200 bg-content1 p-3">
                <p className="text-xs font-semibold text-default-600">Preview pedido</p>
                {selectedOrder ? (
                  <div className="mt-1 space-y-1 text-xs text-default-700">
                    <p><span className="font-medium">Código:</span> {selectedOrder.orderCode}</p>
                    <p><span className="font-medium">Cliente:</span> {selectedOrder.clientName ?? "-"}</p>
                    <p><span className="font-medium">Tipo:</span> {selectedOrder.kind ?? "-"}</p>
                    <p><span className="font-medium">Estado:</span> {selectedOrder.status ?? "-"}</p>
                    <p><span className="font-medium">Diseños:</span> {selectedOrder.itemCount ?? 0}</p>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-default-500">Selecciona un pedido para ver su resumen.</p>
                )}
              </div>

              <div className="rounded-md border border-default-200 bg-content1 p-3">
                <p className="text-xs font-semibold text-default-600">Preview diseño</p>
                {selectedDesign ? (
                  <div className="mt-1 space-y-2 text-xs text-default-700">
                    <p><span className="font-medium">Número:</span> {selectedDesign.designNumber}</p>
                    <p><span className="font-medium">Nombre:</span> {selectedDesign.designName}</p>
                    <p><span className="font-medium">Estado:</span> {selectedDesign.status ?? "-"}</p>
                    <p><span className="font-medium">Cantidad:</span> {selectedDesign.quantity ?? 0}</p>
                    {selectedDesign.previewImageUrl ? (
                      <img
                        src={selectedDesign.previewImageUrl}
                        alt={`Diseño ${selectedDesign.designNumber}`}
                        className="h-28 w-full rounded border border-default-200 object-cover"
                      />
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-default-500">Selecciona un diseño para ver vista previa.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Lista de adiciones */}
        {row.additions.length === 0 ? (
          <p className="text-xs text-default-500">No hay adiciones para este producto</p>
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
                    size="sm"
                    placeholder="Seleccionar producto"
                    label="Adición"
                    variant="flat"
                    className="flex-1 min-w-64"
                    isLoading={loadingAdditions}
                    selectedKeys={add.id ? [add.id] : []}
                    onSelectionChange={(keys) => {
                      const first = String(Array.from(keys)[0] ?? "");
                      const selectedAddition = additions.find((p) => p.id === first);
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
                                        ? selectedAddition.priceUSD ?? 0
                                        : selectedAddition.priceCopBase ?? 0,
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
                    size="sm"
                    type="number"
                    label="Cant"
                    value={String(row.quantity)}
                    variant="flat"
                    classNames={{ input: "w-16 text-center" }}
                    isReadOnly
                  />
                  <Input
                    size="sm"
                    type="number"
                    placeholder={`Vr (${currency})`}
                    value={String(add.unitPrice)}
                    variant="flat"
                    classNames={{ input: "w-20 text-center" }}
                    isReadOnly={!isAuthorizedManual}
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
                    size="sm"
                    variant="light"
                    color="danger"
                    onPress={() => {
                      const updated = row.additions.filter((_, index) => index !== addIndex);
                      onUpdateItem(row.id, { additions: updated });
                    }}
                  >
                    X
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
