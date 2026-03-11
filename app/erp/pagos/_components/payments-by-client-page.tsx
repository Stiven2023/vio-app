"use client";

import { useEffect, useMemo, useState, type Key } from "react";
import { toast } from "react-hot-toast";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@heroui/dropdown";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";
import { BsThreeDotsVertical } from "react-icons/bs";

import { DistributedPaymentsPage } from "@/app/erp/abonos/_components/distributed-payments-page";
import { apiJson, getErrorMessage } from "@/app/erp/orders/_lib/api";
import { OrderPaymentsPage } from "@/app/erp/orders/[id]/payments/_components/order-payments-page";

type ClientOption = {
  id: string;
  clientCode: string;
  name: string;
  identification: string;
  email: string;
  ordersCount: number;
};

type ClientOrderRow = {
  id: string;
  orderCode: string;
  status: string;
  prefacturaDocumentType: string | null;
  prefacturaCode: string | null;
  total: string | null;
  paidTotal: string | null;
  remainingTotal: string | null;
  movementsCount: number;
  lastPaymentAt: string | null;
  currency: string | null;
  createdAt: string | null;
};

type ClientOrdersResponse = {
  client: {
    id: string;
    clientCode: string;
    name: string;
    identificationType: string;
    identification: string;
    contactName: string;
    email: string;
    address: string;
    city: string;
    department: string;
  };
  billedTotal: string;
  dueTotal: string;
  orders: ClientOrderRow[];
};

function asMoney(value: string | number | null | undefined, currency = "COP") {
  const n = Number(value ?? 0);

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: currency.toUpperCase() === "USD" ? "USD" : "COP",
  }).format(Number.isFinite(n) ? n : 0);
}

function formatPrefacturaDocumentType(value: string | null | undefined) {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();

  if (normalized === "F" || normalized === "P") return "F";
  if (normalized === "R") return "R";

  return "-";
}

export function PaymentsByClientPage({
  canApprove,
  canCreate,
  canEdit,
}: {
  canApprove: boolean;
  canCreate: boolean;
  canEdit: boolean;
}) {
  const [query, setQuery] = useState("");
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [loadingClientData, setLoadingClientData] = useState(false);
  const [clientData, setClientData] = useState<ClientOrdersResponse | null>(
    null,
  );
  const [selectedOrderId, setSelectedOrderId] = useState("");

  const selectedClient = useMemo(
    () => clients.find((item) => item.id === selectedClientId) ?? null,
    [clients, selectedClientId],
  );

  useEffect(() => {
    let active = true;

    setLoadingClients(true);
    apiJson<{ items: ClientOption[] }>(
      `/api/pagos/clients?q=${encodeURIComponent(query.trim())}&limit=20`,
    )
      .then((res) => {
        if (!active) return;
        setClients(Array.isArray(res.items) ? res.items : []);
      })
      .catch(() => {
        if (!active) return;
        setClients([]);
      })
      .finally(() => {
        if (active) setLoadingClients(false);
      });

    return () => {
      active = false;
    };
  }, [query]);

  const loadClientData = async (clientId: string) => {
    if (!clientId) {
      setClientData(null);

      return;
    }

    try {
      setLoadingClientData(true);
      const res = await apiJson<ClientOrdersResponse>(
        `/api/pagos/client-orders?clientId=${encodeURIComponent(clientId)}`,
      );

      setClientData(res);
      setSelectedOrderId("");
    } catch (error) {
      setClientData(null);
      toast.error(getErrorMessage(error));
    } finally {
      setLoadingClientData(false);
    }
  };

  const onSelectClient = (key: Key | null) => {
    const nextId = String(key ?? "");

    setSelectedClientId(nextId);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="font-semibold">Pagos por cliente</CardHeader>
        <CardBody className="space-y-3">
          <Autocomplete
            defaultItems={clients}
            inputValue={query}
            isLoading={loadingClients}
            label="Buscar cliente"
            placeholder="Código, nombre o identificación"
            selectedKey={selectedClientId || null}
            onInputChange={setQuery}
            onSelectionChange={onSelectClient}
          >
            {(item) => (
              <AutocompleteItem
                key={item.id}
                textValue={`${item.clientCode} ${item.name} ${item.identification}`}
              >
                <div className="flex flex-col">
                  <span className="font-medium">
                    {item.clientCode} · {item.name}
                  </span>
                  <span className="text-xs text-default-500">
                    {item.identification} · Pedidos: {item.ordersCount}
                  </span>
                </div>
              </AutocompleteItem>
            )}
          </Autocomplete>

          <div className="flex justify-end">
            <Button
              color="primary"
              isDisabled={!selectedClientId || loadingClientData}
              isLoading={loadingClientData}
              onPress={() => loadClientData(selectedClientId)}
            >
              Cargar cartera del cliente
            </Button>
          </div>
        </CardBody>
      </Card>

      {clientData ? (
        <>
          <Card>
            <CardHeader className="font-semibold">
              Información del cliente
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <div className="text-xs text-default-500">Cliente</div>
                  <div className="font-medium">
                    {clientData.client.clientCode} · {clientData.client.name}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-default-500">Identificación</div>
                  <div className="font-medium">
                    {clientData.client.identificationType}{" "}
                    {clientData.client.identification}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-default-500">Contacto</div>
                  <div className="font-medium">
                    {clientData.client.contactName} · {clientData.client.email}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-medium border border-default-200 p-3">
                  <div className="text-xs text-default-500">
                    Valor facturado
                  </div>
                  <div className="font-semibold">
                    {asMoney(clientData.billedTotal)}
                  </div>
                </div>
                <div className="rounded-medium border border-default-200 p-3">
                  <div className="text-xs text-default-500">Total a deber</div>
                  <div className="font-semibold">
                    {asMoney(clientData.dueTotal)}
                  </div>
                </div>
                <div className="rounded-medium border border-default-200 p-3">
                  <div className="text-xs text-default-500">
                    Pedidos asociados
                  </div>
                  <div className="font-semibold">
                    {clientData.orders.length}
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="font-semibold">
              Estado de cuenta del cliente (historial de todos los pedidos
              asociados)
            </CardHeader>
            <CardBody>
              <Table removeWrapper aria-label="Pedidos del cliente">
                <TableHeader>
                  <TableColumn>Pedido</TableColumn>
                  <TableColumn>Fecha pedido</TableColumn>
                  <TableColumn>Estado</TableColumn>
                  <TableColumn>Prefactura</TableColumn>
                  <TableColumn>Documento</TableColumn>
                  <TableColumn>Total</TableColumn>
                  <TableColumn>Abonado</TableColumn>
                  <TableColumn>Saldo</TableColumn>
                  <TableColumn>Último abono</TableColumn>
                  <TableColumn>Acciones</TableColumn>
                </TableHeader>
                <TableBody emptyContent="Sin pedidos" items={clientData.orders}>
                  {(order) => (
                    <TableRow key={order.id}>
                      <TableCell>{order.orderCode}</TableCell>
                      <TableCell>
                        {order.createdAt
                          ? new Date(order.createdAt).toLocaleDateString(
                              "es-CO",
                            )
                          : "-"}
                      </TableCell>
                      <TableCell>{order.status}</TableCell>
                      <TableCell>{order.prefacturaCode ?? "-"}</TableCell>
                      <TableCell>
                        {formatPrefacturaDocumentType(
                          order.prefacturaDocumentType,
                        )}
                      </TableCell>
                      <TableCell>
                        {asMoney(order.total, order.currency ?? "COP")}
                      </TableCell>
                      <TableCell>
                        {asMoney(order.paidTotal, order.currency ?? "COP")}
                      </TableCell>
                      <TableCell>
                        {asMoney(order.remainingTotal, order.currency ?? "COP")}
                      </TableCell>
                      <TableCell>
                        {order.lastPaymentAt
                          ? new Date(order.lastPaymentAt).toLocaleString(
                              "es-CO",
                            )
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Dropdown>
                          <DropdownTrigger>
                            <Button isIconOnly size="sm" variant="flat">
                              <BsThreeDotsVertical />
                            </Button>
                          </DropdownTrigger>
                          <DropdownMenu aria-label="Acciones de pago por cliente">
                            <DropdownItem
                              key="individual-payment"
                              onPress={() => setSelectedOrderId(order.id)}
                            >
                              Abono individual
                            </DropdownItem>
                          </DropdownMenu>
                        </Dropdown>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardBody>
          </Card>

          {selectedOrderId ? (
            <Card>
              <CardHeader className="font-semibold">
                Abono individual por pedido
              </CardHeader>
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
            <CardHeader className="font-semibold">
              Abono distribuido del cliente
            </CardHeader>
            <CardBody>
              <DistributedPaymentsPage
                fixedClientId={clientData.client.id}
                fixedClientName={selectedClient?.name ?? clientData.client.name}
              />
            </CardBody>
          </Card>
        </>
      ) : null}
    </div>
  );
}
