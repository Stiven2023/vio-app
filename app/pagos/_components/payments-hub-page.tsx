"use client";

import { useMemo, useState, type Key } from "react";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";

import { apiJson } from "@/app/orders/_lib/api";
import { DistributedPaymentsPage } from "@/app/abonos/_components/distributed-payments-page";
import { OrderPaymentsPage } from "@/app/orders/[id]/payments/_components/order-payments-page";

type OrderOption = {
  id: string;
  orderCode: string;
  clientName: string | null;
  clientCode?: string | null;
};

export function PaymentsHubPage({
  canApprove,
  canCreate,
  canEdit,
  initialOrderId,
}: {
  canApprove: boolean;
  canCreate: boolean;
  canEdit: boolean;
  initialOrderId?: string;
}) {
  const [query, setQuery] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string>(initialOrderId ?? "");
  const [options, setOptions] = useState<OrderOption[]>([]);
  const [loading, setLoading] = useState(false);

  const selectedOrder = useMemo(
    () => options.find((o) => o.id === selectedOrderId) ?? null,
    [options, selectedOrderId],
  );

  const onSearch = async (value: string) => {
    setQuery(value);

    setLoading(true);
    try {
      const res = await apiJson<{ items: OrderOption[] }>(
        `/api/pagos/orders?q=${encodeURIComponent(value.trim())}&limit=20`,
      );
      setOptions(Array.isArray(res.items) ? res.items : []);
    } catch {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  };

  const onSelectOrder = (key: Key | null) => {
    const nextId = String(key ?? "");
    setSelectedOrderId(nextId);

    const option = options.find((item) => item.id === nextId);
    if (option) {
      setQuery(option.orderCode);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="font-semibold">Pagos por pedido</CardHeader>
        <CardBody className="space-y-3">
          <Autocomplete
            defaultItems={options}
            inputValue={query}
            isLoading={loading}
            label="Buscar pedido"
            placeholder="Código pedido o cliente"
            selectedKey={selectedOrderId || null}
            onInputChange={onSearch}
            onSelectionChange={onSelectOrder}
          >
            {(item) => (
              <AutocompleteItem
                key={item.id}
                textValue={`${item.orderCode} ${item.clientCode ?? ""} ${item.clientName ?? ""}`}
              >
                <div className="flex flex-col">
                  <span className="font-medium">{item.orderCode}</span>
                  <span className="text-xs text-default-500">
                    {item.clientCode ?? "-"} · {item.clientName ?? "-"}
                  </span>
                </div>
              </AutocompleteItem>
            )}
          </Autocomplete>

          <div className="flex justify-end">
            <Button
              color="primary"
              isDisabled={!selectedOrder}
              onPress={() => {
                if (!selectedOrder) return;
                setSelectedOrderId(selectedOrder.id);
              }}
            >
              Cargar pagos del pedido
            </Button>
          </div>
        </CardBody>
      </Card>

      {selectedOrderId ? (
        <Card>
          <CardHeader className="font-semibold">Detalle de pagos por pedido</CardHeader>
          <CardBody>
            <OrderPaymentsPage
              canApprove={canApprove}
              canCreate={canCreate}
              canEdit={canEdit}
              orderId={selectedOrderId}
            />
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="font-semibold">Abonos distribuidos</CardHeader>
        <CardBody>
          <DistributedPaymentsPage
            preselectedOrderId={selectedOrderId || undefined}
            preselectedOrderLabel={selectedOrder?.orderCode ?? undefined}
          />
        </CardBody>
      </Card>
    </div>
  );
}
