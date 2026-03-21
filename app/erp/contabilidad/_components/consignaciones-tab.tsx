"use client";

import type { Paginated } from "@/app/erp/orders/_lib/types";

import { useEffect, useMemo, useState } from "react";
import NextLink from "next/link";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@heroui/dropdown";
import { Input } from "@heroui/input";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";
import { BsThreeDotsVertical } from "react-icons/bs";

import { FilterSearch } from "@/app/erp/catalog/_components/ui/filter-search";
import { FilterSelect } from "@/app/erp/catalog/_components/ui/filter-select";
import { TableSkeleton } from "@/app/erp/catalog/_components/ui/table-skeleton";
import { usePaginatedApi } from "@/app/erp/orders/_hooks/use-paginated-api";
import { apiJson, getErrorMessage } from "@/app/erp/orders/_lib/api";
import { normalizePaymentStatusLabel } from "@/src/utils/payment-status";

type DepositRow = {
  id: string;
  orderId: string | null;
  bankId: string | null;
  transferBank: string | null;
  bankCode: string | null;
  bankName: string | null;
  bankAccountRef: string | null;
  orderCode: string | null;
  clientCode: string | null;
  clientName: string | null;
  referenceCode: string | null;
  method: string | null;
  status: string | null;
  transferCurrency: string | null;
  depositAmount: string | null;
  amount: string | null;
  orderTotal: string | null;
  creditBalance: string;
  proofImageUrl: string | null;
  createdAt: string | null;
};

type PaymentsData = Paginated<DepositRow> & {
  summary?: {
    totalGeneral: string;
    totalEfectivo: string;
    totalTransferencias: string;
  };
};

type BankOption = {
  id: string;
  code: string;
  name: string;
  isActive: boolean | null;
};

function formatMoney(
  value: string | number | null | undefined,
  currency: string,
) {
  const n = Number(value ?? 0);
  const cur = String(currency ?? "COP").toUpperCase() === "USD" ? "USD" : "COP";

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: cur,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

export function DepositsTab({
  canApprovePayments,
}: {
  canApprovePayments: boolean;
}) {
  const [detailRow, setDetailRow] = useState<DepositRow | null>(null);
  const [q, setQ] = useState("");
  const [method, setMethod] = useState("all");
  const [bank, setBank] = useState("all");
  const [currency, setCurrency] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [bankOptions, setBankOptions] = useState<
    Array<{ value: string; label: string }>
  >([{ value: "all", label: "Todos" }]);

  const methodOptions = [
    { value: "all", label: "Todos" },
    { value: "EFECTIVO", label: "Efectivo" },
    { value: "TRANSFERENCIA", label: "Transferencia bancaria" },
    { value: "CREDITO", label: "Crédito" },
  ];

  const currencyOptions = [
    { value: "all", label: "Todas" },
    { value: "COP", label: "COP" },
    { value: "USD", label: "USD" },
  ];

  useEffect(() => {
    apiJson<{ items: BankOption[] }>("/api/banks?page=1&pageSize=200")
      .then((res) => {
        const options = (res.items ?? [])
          .filter((item) => item.isActive !== false)
          .map((item) => ({
            value: item.id,
            label: `${item.code} - ${item.name}`,
          }));

        setBankOptions([{ value: "all", label: "Todos" }, ...options]);
      })
      .catch(() => {
        setBankOptions([{ value: "all", label: "Todos" }]);
      });
  }, []);

  const endpoint = useMemo(() => {
    const sp = new URLSearchParams();
    const query = q.trim();

    if (query) sp.set("q", query);
    if (method !== "all") sp.set("method", method);
    if (bank !== "all") sp.set("bank", bank);
    if (currency !== "all") sp.set("currency", currency);
    if (dateFrom) sp.set("dateFrom", dateFrom);
    if (dateTo) sp.set("dateTo", dateTo);
    const qs = sp.toString();

    return `/api/contabilidad/consignaciones${qs ? `?${qs}` : ""}`;
  }, [bank, currency, dateFrom, dateTo, method, q]);

  const { data, loading, page, setPage, refresh } = usePaginatedApi<DepositRow>(
    endpoint,
    15,
  );
  const paymentsData = data as PaymentsData | null;
  const cardCurrency = currency === "USD" ? "USD" : "COP";

  const updateStatus = async (id: string, nextStatus: "PAGADO" | "ANULADO") => {
    try {
      await apiJson(`/api/contabilidad/consignaciones/${id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: nextStatus }),
      });

      toast.success(
        nextStatus === "PAGADO" ? "Pago aprobado" : "Pago rechazado",
      );
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card>
          <CardBody className="gap-1">
            <div className="text-xs uppercase tracking-wide text-default-500">
              Total Efectivo
            </div>
            <div className="text-2xl font-semibold">
              {formatMoney(
                paymentsData?.summary?.totalEfectivo ?? 0,
                cardCurrency,
              )}
            </div>
            <p className="text-xs text-default-500">
              Suma de pagos en efectivo según los filtros.
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="gap-1">
            <div className="text-xs uppercase tracking-wide text-default-500">
              Total Transferencias
            </div>
            <div className="text-2xl font-semibold">
              {formatMoney(
                paymentsData?.summary?.totalTransferencias ?? 0,
                cardCurrency,
              )}
            </div>
            <p className="text-xs text-default-500">
              Suma de transferencias bancarias según los filtros.
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="gap-1">
            <div className="text-xs uppercase tracking-wide text-default-500">
              Total General
            </div>
            <div className="text-2xl font-semibold">
              {formatMoney(
                paymentsData?.summary?.totalGeneral ?? 0,
                cardCurrency,
              )}
            </div>
            <p className="text-xs text-default-500">
              Incluye créditos y otros métodos si existen en el período.
            </p>
          </CardBody>
        </Card>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <FilterSearch
            className="sm:w-80"
            placeholder="Buscar por pedido, cliente, referencia o banco..."
            value={q}
            onValueChange={setQ}
          />
          <FilterSelect
            className="sm:w-48"
            label="Método"
            options={methodOptions}
            value={method}
            onChange={setMethod}
          />
          <FilterSelect
            className="sm:w-48"
            label="Banco"
            options={bankOptions}
            value={bank}
            onChange={setBank}
          />
          <FilterSelect
            className="sm:w-36"
            label="Moneda"
            options={currencyOptions}
            value={currency}
            onChange={setCurrency}
          />
          <Input
            className="sm:w-44"
            label="Fecha desde"
            size="sm"
            type="date"
            value={dateFrom}
            onValueChange={setDateFrom}
          />
          <Input
            className="sm:w-44"
            label="Fecha hasta"
            size="sm"
            type="date"
            value={dateTo}
            onValueChange={setDateTo}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button
            variant="flat"
            onPress={() => {
              setQ("");
              setMethod("all");
              setBank("all");
              setCurrency("all");
              setDateFrom("");
              setDateTo("");
            }}
          >
            Limpiar filtros
          </Button>
          <Button variant="flat" onPress={refresh}>
            Actualizar
          </Button>
        </div>
      </div>

      {loading ? (
        <TableSkeleton
          ariaLabel="Payments"
          headers={[
            "Fecha",
            "Pedido",
            "Cliente",
            "Método",
            "Banco",
            "Estado",
            "Moneda",
            "Pagado",
            "Valor pedido",
            "Soporte",
            "Acciones",
          ]}
        />
      ) : (
        <Table aria-label="Payments">
          <TableHeader>
            <TableColumn>Fecha</TableColumn>
            <TableColumn>Pedido</TableColumn>
            <TableColumn>Cliente</TableColumn>
            <TableColumn>Método</TableColumn>
            <TableColumn>Banco</TableColumn>
            <TableColumn>Estado</TableColumn>
            <TableColumn>Moneda</TableColumn>
            <TableColumn>Total pagado</TableColumn>
            <TableColumn>Valor pedido</TableColumn>
            <TableColumn>Soporte</TableColumn>
            <TableColumn>Acciones</TableColumn>
          </TableHeader>
          <TableBody
            emptyContent="No hay pagos"
            items={paymentsData?.items ?? []}
          >
            {(row) => {
              const rowCurrency = String(
                row.transferCurrency ?? "COP",
              ).toUpperCase();

              return (
                <TableRow key={row.id}>
                  <TableCell>
                    {row.createdAt
                      ? new Date(row.createdAt).toLocaleString("es-CO")
                      : "-"}
                  </TableCell>
                  <TableCell>{row.orderCode ?? "-"}</TableCell>
                  <TableCell>{row.clientCode ?? "-"}</TableCell>
                  <TableCell>{row.method ?? "-"}</TableCell>
                  <TableCell>
                    {row.method === "TRANSFERENCIA"
                      ? (row.bankCode ?? row.transferBank ?? "-")
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {normalizePaymentStatusLabel(row.status)}
                  </TableCell>
                  <TableCell>{rowCurrency}</TableCell>
                  <TableCell>
                    {formatMoney(row.depositAmount, rowCurrency)}
                  </TableCell>
                  <TableCell>
                    {formatMoney(row.orderTotal, rowCurrency)}
                  </TableCell>
                  <TableCell>
                    {row.proofImageUrl ? (
                      <Button
                        as={NextLink}
                        href={row.proofImageUrl}
                        rel="noreferrer"
                        size="sm"
                        target="_blank"
                        variant="flat"
                      >
                        Ver
                      </Button>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    <Dropdown>
                      <DropdownTrigger>
                        <Button isIconOnly size="sm" variant="flat">
                          <BsThreeDotsVertical />
                        </Button>
                      </DropdownTrigger>
                      <DropdownMenu aria-label="Payment actions">
                        <DropdownItem
                          key="view"
                          onPress={() => setDetailRow(row)}
                        >
                          Ver
                        </DropdownItem>
                        <DropdownItem
                          key="approve"
                          isDisabled={
                            !canApprovePayments || row.status === "PAGADO"
                          }
                          onPress={() => updateStatus(row.id, "PAGADO")}
                        >
                          Aprobar transferencia
                        </DropdownItem>
                        <DropdownItem
                          key="reject"
                          isDisabled={
                            !canApprovePayments || row.status === "PAGADO"
                          }
                          onPress={() => updateStatus(row.id, "ANULADO")}
                        >
                          Rechazar pago
                        </DropdownItem>
                      </DropdownMenu>
                    </Dropdown>
                  </TableCell>
                </TableRow>
              );
            }}
          </TableBody>
        </Table>
      )}

      <Modal
        isOpen={Boolean(detailRow)}
        size="lg"
        onOpenChange={(open) => {
          if (!open) setDetailRow(null);
        }}
      >
        <ModalContent>
          <ModalHeader>Detalle de depósito</ModalHeader>
          <ModalBody>
            {detailRow ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs text-default-500">Fecha</div>
                  <div className="font-medium">
                    {detailRow.createdAt
                      ? new Date(detailRow.createdAt).toLocaleString("es-CO")
                      : "-"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-default-500">Pedido</div>
                  <div className="font-medium">
                    {detailRow.orderCode ?? "-"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-default-500">Cliente</div>
                  <div className="font-medium">
                    {detailRow.clientCode ?? "-"}{" "}
                    {detailRow.clientName ? `- ${detailRow.clientName}` : ""}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-default-500">Metodo</div>
                  <div className="font-medium">{detailRow.method ?? "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-default-500">Banco</div>
                  <div className="font-medium">
                    {[detailRow.bankCode, detailRow.bankName]
                      .filter(Boolean)
                      .join(" - ") ||
                      detailRow.transferBank ||
                      "-"}
                  </div>
                  <div className="text-xs text-default-500">
                    {detailRow.bankAccountRef
                      ? `Cuenta: ${detailRow.bankAccountRef}`
                      : "Cuenta: -"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-default-500">Referencia</div>
                  <div className="font-medium">
                    {detailRow.referenceCode ?? "-"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-default-500">Estado</div>
                  <div className="font-medium">
                    {normalizePaymentStatusLabel(detailRow.status)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-default-500">Moneda</div>
                  <div className="font-medium">
                    {String(detailRow.transferCurrency ?? "COP").toUpperCase()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-default-500">Total pagado</div>
                  <div className="font-medium">
                    {formatMoney(
                      detailRow.depositAmount,
                      String(detailRow.transferCurrency ?? "COP").toUpperCase(),
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-default-500">Valor pedido</div>
                  <div className="font-medium">
                    {formatMoney(
                      detailRow.orderTotal,
                      String(detailRow.transferCurrency ?? "COP").toUpperCase(),
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </ModalBody>
          <ModalFooter>
            {detailRow?.proofImageUrl ? (
              <Button
                as={NextLink}
                href={detailRow.proofImageUrl}
                rel="noreferrer"
                target="_blank"
                variant="flat"
              >
                Ver soporte
              </Button>
            ) : null}
            <Button variant="flat" onPress={() => setDetailRow(null)}>
              Cerrar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {paymentsData ? (
        <div className="flex items-center justify-end gap-2">
          <Button
            isDisabled={page <= 1 || loading}
            variant="flat"
            onPress={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <Button
            isDisabled={!paymentsData.hasNextPage || loading}
            variant="flat"
            onPress={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}
