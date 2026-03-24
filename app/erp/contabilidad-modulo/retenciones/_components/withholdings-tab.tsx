"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Input } from "@heroui/input";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";
import { Tab, Tabs } from "@heroui/tabs";
import * as XLSX from "xlsx";

import { usePaginatedApi } from "@/app/erp/orders/_hooks/use-paginated-api";
import { apiJson, getErrorMessage } from "@/app/erp/orders/_lib/api";

type TaxZone = "CONTINENTAL" | "FREE_ZONE" | "SAN_ANDRES" | "SPECIAL_REGIME";

type WithholdingItem = {
  id: string;
  prefacturaCode: string;
  createdAt: string | null;
  clientId: string;
  clientName: string;
  clientIdentification: string;
  taxZone: TaxZone;
  subtotal: string | null;
  ivaAmount: string | null;
  total: string | null;
  withholdingTaxRate: string | null;
  withholdingIcaRate: string | null;
  withholdingIvaRate: string | null;
  withholdingTaxAmount: string | null;
  withholdingIcaAmount: string | null;
  withholdingIvaAmount: string | null;
  totalWithholding: string | null;
  totalAfterWithholding: string | null;
};

type RatesItem = {
  taxZone: TaxZone;
  withholdingTaxRate: string | null;
  withholdingIcaRate: string | null;
  withholdingIvaRate: string | null;
  updatedAt: string | null;
};

type WithholdingsData = {
  items: WithholdingItem[];
  clients: Array<{ id: string; name: string; taxZone: TaxZone | null }>;
  taxZones: TaxZone[];
  summary: {
    totalBase: string;
    totalIvaBase: string;
    totalReteFuente: string;
    totalReteIca: string;
    totalReteIva: string;
    totalWithholding: string;
  };
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
};

type RatesData = {
  items: RatesItem[];
};

function toNumber(value: unknown) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: unknown) {
  return new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

function formatRate(value: unknown) {
  return `${toNumber(value).toFixed(4)}%`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("es-CO");
}

function exportRowsToExcel(rows: WithholdingItem[]) {
  const headers = [
    "Prefactura",
    "Fecha",
    "Cliente",
    "Identificacion",
    "Zona",
    "Subtotal",
    "IVA",
    "Total",
    "ReteFuente %",
    "ReteICA %",
    "ReteIVA %",
    "ReteFuente",
    "ReteICA",
    "ReteIVA",
    "Total Retenciones",
    "Total Neto",
  ];

  const lines = rows.map((row) => [
    row.prefacturaCode,
    formatDate(row.createdAt),
    row.clientName,
    row.clientIdentification,
    row.taxZone,
    toNumber(row.subtotal).toFixed(2),
    toNumber(row.ivaAmount).toFixed(2),
    toNumber(row.total).toFixed(2),
    toNumber(row.withholdingTaxRate).toFixed(4),
    toNumber(row.withholdingIcaRate).toFixed(4),
    toNumber(row.withholdingIvaRate).toFixed(4),
    toNumber(row.withholdingTaxAmount).toFixed(2),
    toNumber(row.withholdingIcaAmount).toFixed(2),
    toNumber(row.withholdingIvaAmount).toFixed(2),
    toNumber(row.totalWithholding).toFixed(2),
    toNumber(row.totalAfterWithholding).toFixed(2),
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...lines]);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Retenciones");
  XLSX.writeFile(
    workbook,
    `retenciones-${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
}

export function WithholdingsTab({
  canManageRates,
}: {
  canManageRates: boolean;
}) {
  const [activeTab, setActiveTab] = useState<"prefacturas" | "rates">(
    "prefacturas",
  );

  const [query, setQuery] = useState("");
  const [clientId, setClientId] = useState("");
  const [taxZone, setTaxZone] = useState<"ALL" | TaxZone>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const endpoint = useMemo(() => {
    const params = new URLSearchParams();

    if (query.trim()) params.set("query", query.trim());
    if (clientId) params.set("clientId", clientId);
    if (taxZone !== "ALL") params.set("taxZone", taxZone);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

    return `/api/contabilidad/retenciones?${params.toString()}`;
  }, [clientId, dateFrom, dateTo, query, taxZone]);

  const { data, loading, page, setPage, refresh } =
    usePaginatedApi<WithholdingItem>(endpoint, 15);

  const withholdingsData = data as WithholdingsData | null;

  const [ratesLoading, setRatesLoading] = useState(false);
  const [rates, setRates] = useState<RatesItem[]>([]);

  const [editRateOpen, setEditRateOpen] = useState(false);
  const [saveRateLoading, setSaveRateLoading] = useState(false);
  const [editingRate, setEditingRate] = useState<RatesItem | null>(null);
  const [withholdingTaxRate, setWithholdingTaxRate] = useState("0");
  const [withholdingIcaRate, setWithholdingIcaRate] = useState("0");
  const [withholdingIvaRate, setWithholdingIvaRate] = useState("0");

  const loadRates = async () => {
    try {
      setRatesLoading(true);
      const response = await apiJson<RatesData>("/api/tax-zone-rates");

      setRates(response.items ?? []);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setRatesLoading(false);
    }
  };

  useEffect(() => {
    loadRates();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [clientId, dateFrom, dateTo, query, setPage, taxZone]);

  const resetRateDraft = () => {
    setEditingRate(null);
    setWithholdingTaxRate("0");
    setWithholdingIcaRate("0");
    setWithholdingIvaRate("0");
  };

  const openRateEditor = (item: RatesItem) => {
    setEditingRate(item);
    setWithholdingTaxRate(String(toNumber(item.withholdingTaxRate)));
    setWithholdingIcaRate(String(toNumber(item.withholdingIcaRate)));
    setWithholdingIvaRate(String(toNumber(item.withholdingIvaRate)));
    setEditRateOpen(true);
  };

  const saveRates = async () => {
    if (!editingRate) return;

    const tax = toNumber(withholdingTaxRate);
    const ica = toNumber(withholdingIcaRate);
    const iva = toNumber(withholdingIvaRate);

    if (
      !Number.isFinite(tax) ||
      !Number.isFinite(ica) ||
      !Number.isFinite(iva) ||
      tax < 0 ||
      ica < 0 ||
      iva < 0 ||
      tax > 100 ||
      ica > 100 ||
      iva > 100
    ) {
      toast.error("Las tasas deben estar entre 0 y 100");

      return;
    }

    try {
      setSaveRateLoading(true);
      await apiJson(`/api/tax-zone-rates/${editingRate.taxZone}`, {
        method: "PATCH",
        body: JSON.stringify({
          withholdingTaxRate: tax,
          withholdingIcaRate: ica,
          withholdingIvaRate: iva,
        }),
      });

      toast.success("Tasas actualizadas");
      setEditRateOpen(false);
      resetRateDraft();
      await loadRates();
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaveRateLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-default-500">
          La tabla de retenciones usa tasas configurables por zona tributaria.
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="flat" onPress={refresh}>
            Refresh
          </Button>
          <Button
            isDisabled={
              !withholdingsData || withholdingsData.items.length === 0
            }
            size="sm"
            variant="flat"
            onPress={() => exportRowsToExcel(withholdingsData?.items ?? [])}
          >
            Export to Excel
          </Button>
          {canManageRates ? (
            <Button
              color="primary"
              size="sm"
              onPress={() => setActiveTab("rates")}
            >
              Edit rates
            </Button>
          ) : null}
        </div>
      </div>

      <Tabs
        aria-label="Retenciones"
        selectedKey={activeTab}
        onSelectionChange={(key) =>
          setActiveTab(key as "prefacturas" | "rates")
        }
      >
        <Tab key="prefacturas" title="By Pre-invoice" />
        <Tab key="rates" title="Rate configuration" />
      </Tabs>

      {activeTab === "prefacturas" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Card>
              <CardBody className="gap-1">
                <div className="text-xs uppercase tracking-wide text-default-500">
                  Total base
                </div>
                <div className="text-2xl font-semibold">
                  {formatMoney(withholdingsData?.summary?.totalBase ?? 0)}
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="gap-1">
                <div className="text-xs uppercase tracking-wide text-default-500">
                  Total retenciones
                </div>
                <div className="text-2xl font-semibold text-warning-600">
                  {formatMoney(
                    withholdingsData?.summary?.totalWithholding ?? 0,
                  )}
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="gap-1">
                <div className="text-xs uppercase tracking-wide text-default-500">
                  Total registros
                </div>
                <div className="text-2xl font-semibold">
                  {withholdingsData?.total ?? 0}
                </div>
              </CardBody>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Card>
              <CardBody className="gap-1">
                <div className="text-xs uppercase tracking-wide text-default-500">
                  ReteFuente
                </div>
                <div className="text-xl font-semibold">
                  {formatMoney(withholdingsData?.summary?.totalReteFuente ?? 0)}
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="gap-1">
                <div className="text-xs uppercase tracking-wide text-default-500">
                  ReteICA
                </div>
                <div className="text-xl font-semibold">
                  {formatMoney(withholdingsData?.summary?.totalReteIca ?? 0)}
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="gap-1">
                <div className="text-xs uppercase tracking-wide text-default-500">
                  ReteIVA
                </div>
                <div className="text-xl font-semibold">
                  {formatMoney(withholdingsData?.summary?.totalReteIva ?? 0)}
                </div>
              </CardBody>
            </Card>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <Input
              className="sm:w-72"
              label="Buscar"
              placeholder="Prefactura, cliente o identificacion"
              size="sm"
              value={query}
              variant="bordered"
              onValueChange={setQuery}
            />

            <Select
              className="sm:w-72"
              label="Cliente"
              placeholder="Todos"
              selectedKeys={clientId ? [clientId] : []}
              size="sm"
              variant="bordered"
              onSelectionChange={(keys) => {
                const value = String(Array.from(keys)[0] ?? "");

                setClientId(value);
              }}
            >
              {(withholdingsData?.clients ?? []).map((client) => (
                <SelectItem key={client.id}>{client.name}</SelectItem>
              ))}
            </Select>

            <Select
              className="sm:w-56"
              items={[
                { key: "ALL", label: "ALL" },
                ...((withholdingsData?.taxZones ?? []).map((zone) => ({
                  key: zone,
                  label: zone,
                })) as Array<{ key: string; label: string }>),
              ]}
              label="Zona tributaria"
              selectedKeys={[taxZone]}
              size="sm"
              variant="bordered"
              onSelectionChange={(keys) => {
                const value = String(
                  Array.from(keys)[0] ?? "ALL",
                ).toUpperCase();

                setTaxZone(value as "ALL" | TaxZone);
              }}
            >
              {(zone) => <SelectItem key={zone.key}>{zone.label}</SelectItem>}
            </Select>

            <Input
              className="sm:w-48"
              label="Fecha desde"
              size="sm"
              type="date"
              value={dateFrom}
              variant="bordered"
              onValueChange={setDateFrom}
            />

            <Input
              className="sm:w-48"
              label="Fecha hasta"
              size="sm"
              type="date"
              value={dateTo}
              variant="bordered"
              onValueChange={setDateTo}
            />

            <Button
              size="sm"
              variant="flat"
              onPress={() => {
                setQuery("");
                setClientId("");
                setTaxZone("ALL");
                setDateFrom("");
                setDateTo("");
              }}
            >
              Limpiar
            </Button>
          </div>

          <Table aria-label="Retenciones por prefactura">
            <TableHeader>
              <TableColumn>Prefactura</TableColumn>
              <TableColumn>Fecha</TableColumn>
              <TableColumn>Cliente</TableColumn>
              <TableColumn>Zona</TableColumn>
              <TableColumn>Subtotal</TableColumn>
              <TableColumn>IVA</TableColumn>
              <TableColumn>ReteFuente %</TableColumn>
              <TableColumn>ReteICA %</TableColumn>
              <TableColumn>ReteIVA %</TableColumn>
              <TableColumn>Total Retenciones</TableColumn>
              <TableColumn>Total Neto</TableColumn>
            </TableHeader>
            <TableBody
              emptyContent={
                loading ? "Cargando..." : "No hay prefacturas con retenciones"
              }
              items={withholdingsData?.items ?? []}
            >
              {(row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.prefacturaCode}</TableCell>
                  <TableCell>{formatDate(row.createdAt)}</TableCell>
                  <TableCell>{row.clientName}</TableCell>
                  <TableCell>{row.taxZone}</TableCell>
                  <TableCell>{formatMoney(row.subtotal)}</TableCell>
                  <TableCell>{formatMoney(row.ivaAmount)}</TableCell>
                  <TableCell>{formatRate(row.withholdingTaxRate)}</TableCell>
                  <TableCell>{formatRate(row.withholdingIcaRate)}</TableCell>
                  <TableCell>{formatRate(row.withholdingIvaRate)}</TableCell>
                  <TableCell>{formatMoney(row.totalWithholding)}</TableCell>
                  <TableCell>
                    {formatMoney(row.totalAfterWithholding)}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {withholdingsData ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-default-500">
                Total: {withholdingsData.total ?? 0}
              </p>
              <div className="flex gap-2">
                <Button
                  isDisabled={loading || page <= 1}
                  size="sm"
                  variant="flat"
                  onPress={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </Button>
                <Button
                  isDisabled={loading || !withholdingsData.hasNextPage}
                  size="sm"
                  variant="flat"
                  onPress={() => setPage((current) => current + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {activeTab === "rates" ? (
        <div className="space-y-4">
          <Table aria-label="Configuracion de tasas por zona tributaria">
            <TableHeader>
              <TableColumn>Zona tributaria</TableColumn>
              <TableColumn>ReteFuente %</TableColumn>
              <TableColumn>ReteICA %</TableColumn>
              <TableColumn>ReteIVA %</TableColumn>
              <TableColumn>Ultima actualizacion</TableColumn>
              <TableColumn>Acciones</TableColumn>
            </TableHeader>
            <TableBody
              emptyContent={
                ratesLoading ? "Cargando..." : "No hay tasas configuradas"
              }
              items={rates}
            >
              {(row) => (
                <TableRow key={row.taxZone}>
                  <TableCell>{row.taxZone}</TableCell>
                  <TableCell>{formatRate(row.withholdingTaxRate)}</TableCell>
                  <TableCell>{formatRate(row.withholdingIcaRate)}</TableCell>
                  <TableCell>{formatRate(row.withholdingIvaRate)}</TableCell>
                  <TableCell>{formatDate(row.updatedAt)}</TableCell>
                  <TableCell>
                    <Button
                      isDisabled={!canManageRates}
                      size="sm"
                      variant="flat"
                      onPress={() => openRateEditor(row)}
                    >
                      Editar
                    </Button>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      ) : null}

      <Modal
        disableAnimation
        isOpen={editRateOpen}
        onOpenChange={(open) => {
          setEditRateOpen(open);
          if (!open) resetRateDraft();
        }}
      >
        <ModalContent>
          <ModalHeader>
            Edit rates {editingRate ? `(${editingRate.taxZone})` : ""}
          </ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 gap-3">
              <Input
                isRequired
                label="ReteFuente (%)"
                type="number"
                value={withholdingTaxRate}
                variant="bordered"
                onValueChange={setWithholdingTaxRate}
              />
              <Input
                isRequired
                label="ReteICA (%)"
                type="number"
                value={withholdingIcaRate}
                variant="bordered"
                onValueChange={setWithholdingIcaRate}
              />
              <Input
                isRequired
                label="ReteIVA (%)"
                type="number"
                value={withholdingIvaRate}
                variant="bordered"
                onValueChange={setWithholdingIvaRate}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setEditRateOpen(false)}>
              Cancelar
            </Button>
            <Button
              color="primary"
              isDisabled={saveRateLoading}
              onPress={saveRates}
            >
              {saveRateLoading ? "Guardando..." : "Guardar"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
