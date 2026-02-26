"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@heroui/dropdown";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import {
  BsDownload,
  BsEye,
  BsFileEarmarkCheck,
  BsPencilSquare,
  BsThreeDotsVertical,
  BsTrash,
} from "react-icons/bs";

import { apiJson, getErrorMessage } from "@/app/catalog/_lib/api";
import { ConfirmActionModal } from "@/components/confirm-action-modal";
import { useClientOnly } from "../_hooks/useClientOnly";

type QuotationRow = {
  id: string;
  quoteCode: string;
  currency: string | null;
  total: string | null;
  prefacturaApproved: boolean | null;
  isActive: boolean | null;
  createdAt: string | null;
  expiryDate: string | null;
  clientName: string | null;
  sellerName: string | null;
};

type OrderType = "VN" | "VI";

type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
};

function parseDateOnly(input: string | null | undefined) {
  if (!input) return null;
  const value = String(input).trim();
  if (!value) return null;

  const normalized = value.includes("T") ? value.slice(0, 10) : value;
  const date = new Date(`${normalized}T00:00:00`);

  return Number.isNaN(date.getTime()) ? null : date;
}

function getExpiryBadge(expiryDate: string | null | undefined) {
  const expiry = parseDateOnly(expiryDate);
  if (!expiry) {
    return {
      label: "-",
      className: "text-default-600",
    };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const formatted = new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(expiry);

  if (diffDays < 0) {
    return {
      label: `${formatted} · Vencida`,
      className: "text-danger font-semibold",
    };
  }

  if (diffDays <= 1) {
    return {
      label: `${formatted} · Crítica`,
      className: "text-danger font-semibold",
    };
  }

  if (diffDays <= 5) {
    return {
      label: `${formatted} · Próxima`,
      className: "text-warning font-semibold",
    };
  }

  return {
    label: formatted,
    className: "text-default-700",
  };
}

function formatMoneyByCurrency(value: string | number | null | undefined, currency: string | null | undefined) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "-";

  const code = String(currency ?? "COP").toUpperCase() === "USD" ? "USD" : "COP";

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function QuotationsList() {
  const router = useRouter();
  const isMounted = useClientOnly();
  const [rows, setRows] = useState<Paginated<QuotationRow> | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [currency, setCurrency] = useState("ALL");
  const [status, setStatus] = useState("active");
  const [pendingDelete, setPendingDelete] = useState<QuotationRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadRow, setDownloadRow] = useState<QuotationRow | null>(null);
  const [prefacturaId, setPrefacturaId] = useState<string | null>(null);
  const [prefacturaRow, setPrefacturaRow] = useState<QuotationRow | null>(null);
  const [prefacturaOrderName, setPrefacturaOrderName] = useState("");
  const [prefacturaOrderType, setPrefacturaOrderType] = useState<OrderType>("VN");

  const endpoint = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "10",
      status,
    });

    if (query.trim()) params.set("q", query.trim());
    if (currency !== "ALL") params.set("currency", currency);

    return `/api/quotations?${params.toString()}`;
  }, [currency, page, query, status]);

  const fetchRows = async () => {
    setLoading(true);
    try {
      const data = await apiJson<Paginated<QuotationRow>>(endpoint);
      setRows(data);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setRows(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [endpoint]);

  const emptyContent = loading ? "" : "Sin cotizaciones";

  const downloadPdf = async (
    row: QuotationRow,
    audience: "interno" | "externo" = "interno",
  ) => {
    if (downloadingId) return;

    try {
      setDownloadingId(row.id);
      const params = new URLSearchParams({ audience });
      const response = await fetch(`/api/exports/quotations/${row.id}/pdf?${params.toString()}`, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `cotizacion-${row.quoteCode}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      setDownloadRow(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDownloadingId(null);
    }
  };

  const openDownloadModal = (row: QuotationRow) => {
    if (downloadingId) return;
    setDownloadRow(row);
  };

  const openPrefacturaModal = (row: QuotationRow) => {
    const defaultName = `Pedido ${row.quoteCode}`;
    const defaultType: OrderType =
      String(row.currency ?? "COP").toUpperCase() === "USD" ? "VI" : "VN";

    setPrefacturaRow(row);
    setPrefacturaOrderName(defaultName);
    setPrefacturaOrderType(defaultType);
  };

  const closePrefacturaModal = () => {
    if (prefacturaId) return;
    setPrefacturaRow(null);
    setPrefacturaOrderName("");
    setPrefacturaOrderType("VN");
  };

  const convertToPrefactura = async () => {
    if (!prefacturaRow || prefacturaId) return;

    const orderName = prefacturaOrderName.trim() || `Pedido ${prefacturaRow.quoteCode}`;

    try {
      setPrefacturaId(prefacturaRow.id);
      const result = await apiJson<{
        order: { id: string; orderCode: string; orderName: string | null } | null;
        reused: boolean;
      }>(`/api/quotations/${prefacturaRow.id}/prefactura`, {
        method: "POST",
        body: JSON.stringify({ orderName, orderType: prefacturaOrderType }),
      });

      toast.success(
        result.reused
          ? `Prefactura actualizada. Pedido: ${result.order?.orderCode ?? "-"}`
          : `Prefactura creada. Pedido: ${result.order?.orderCode ?? "-"}`,
      );

      fetchRows();

      if (result.order?.id) {
        router.push(`/orders/${result.order.id}/detail`);
      }

      setPrefacturaRow(null);
      setPrefacturaOrderName("");
      setPrefacturaOrderType("VN");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setPrefacturaId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Input
            className="sm:w-80"
            label="Buscar"
            placeholder="Código, cliente o vendedor"
            value={query}
            onValueChange={(v) => {
              setPage(1);
              setQuery(v);
            }}
          />
          {isMounted ? (
            <>
              <Select
                className="sm:w-44"
                label="Moneda"
                selectedKeys={[currency]}
                onSelectionChange={(keys) => {
                  const first = String(Array.from(keys)[0] ?? "ALL");
                  setPage(1);
                  setCurrency(first);
                }}
              >
                <SelectItem key="ALL">Todas</SelectItem>
                <SelectItem key="COP">COP</SelectItem>
                <SelectItem key="USD">USD</SelectItem>
              </Select>
              <Select
                className="sm:w-44"
                label="Estado"
                selectedKeys={[status]}
                onSelectionChange={(keys) => {
                  const first = String(Array.from(keys)[0] ?? "active");
                  setPage(1);
                  setStatus(first);
                }}
              >
                <SelectItem key="active">Activas</SelectItem>
                <SelectItem key="inactive">Inactivas</SelectItem>
                <SelectItem key="all">Todas</SelectItem>
              </Select>
            </>
          ) : (
            <>
              <div className="sm:w-44 h-14 rounded-xl border border-default-200 bg-content1" />
              <div className="sm:w-44 h-14 rounded-xl border border-default-200 bg-content1" />
            </>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="flat" onPress={fetchRows}>Refrescar</Button>
          <Button color="primary" onPress={() => router.push("/quotations/new")}>Crear cotización</Button>
        </div>
      </div>

      <Table aria-label="Cotizaciones">
        <TableHeader>
          <TableColumn>Código</TableColumn>
          <TableColumn>Cliente</TableColumn>
          <TableColumn>Vendedor</TableColumn>
          <TableColumn>Vencimiento</TableColumn>
          <TableColumn>Moneda</TableColumn>
          <TableColumn>Total</TableColumn>
          <TableColumn>Estado</TableColumn>
          <TableColumn>Acciones</TableColumn>
        </TableHeader>
        <TableBody emptyContent={emptyContent} isLoading={loading} items={rows?.items ?? []}>
          {(row) => (
            <TableRow key={row.id}>
              <TableCell>{row.quoteCode}</TableCell>
              <TableCell>{row.clientName ?? "-"}</TableCell>
              <TableCell>{row.sellerName ?? "-"}</TableCell>
              <TableCell>
                {(() => {
                  const expiryBadge = getExpiryBadge(row.expiryDate);
                  return <span className={expiryBadge.className}>{expiryBadge.label}</span>;
                })()}
              </TableCell>
              <TableCell>{row.currency ?? "-"}</TableCell>
              <TableCell>{formatMoneyByCurrency(row.total, row.currency)}</TableCell>
              <TableCell>{row.isActive ? "Activa" : "Inactiva"}</TableCell>
              <TableCell>
                <Dropdown>
                  <DropdownTrigger>
                    <Button size="sm" variant="flat">
                      <BsThreeDotsVertical />
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu aria-label="Acciones cotización">
                    <DropdownItem
                      key="view"
                      startContent={<BsEye />}
                      onPress={() => router.push(`/quotations/${row.id}`)}
                    >
                      Ver / Editar
                    </DropdownItem>
                    <DropdownItem
                      key="edit"
                      startContent={<BsPencilSquare />}
                      onPress={() => router.push(`/quotations/${row.id}`)}
                    >
                      Editar
                    </DropdownItem>
                    <DropdownItem
                      key="download"
                      startContent={<BsDownload />}
                      onPress={() => openDownloadModal(row)}
                    >
                      {downloadingId === row.id ? "Descargando PDF..." : "Descargar PDF"}
                    </DropdownItem>
                    <DropdownItem
                      key="prefactura"
                      startContent={<BsFileEarmarkCheck />}
                      onPress={() => openPrefacturaModal(row)}
                    >
                      {prefacturaId === row.id
                        ? "Convirtiendo..."
                        : row.prefacturaApproved
                          ? "Volver prefactura"
                          : "Aprobar prefactura"}
                    </DropdownItem>
                    <DropdownItem
                      key="delete"
                      className="text-danger"
                      startContent={<BsTrash />}
                      onPress={() => setPendingDelete(row)}
                    >
                      Eliminar
                    </DropdownItem>
                  </DropdownMenu>
                </Dropdown>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between">
        <p className="text-sm text-default-500">Total: {rows?.total ?? 0}</p>
        <div className="flex gap-2">
          <Button isDisabled={page <= 1 || loading} variant="flat" onPress={() => setPage((p) => Math.max(1, p - 1))}>
            Anterior
          </Button>
          <Button isDisabled={!rows?.hasNextPage || loading} variant="flat" onPress={() => setPage((p) => p + 1)}>
            Siguiente
          </Button>
        </div>
      </div>

      <ConfirmActionModal
        cancelLabel="Cancelar"
        confirmLabel="Eliminar"
        description={
          pendingDelete
            ? `¿Eliminar la cotización ${pendingDelete.quoteCode}?`
            : undefined
        }
        isLoading={deleting}
        isOpen={Boolean(pendingDelete)}
        title="Confirmar eliminación"
        onConfirm={async () => {
          if (!pendingDelete || deleting) return;
          try {
            setDeleting(true);
            await apiJson(`/api/quotations/${pendingDelete.id}`, { method: "DELETE" });
            toast.success("Cotización eliminada");
            setPendingDelete(null);
            fetchRows();
          } catch (error) {
            toast.error(getErrorMessage(error));
          } finally {
            setDeleting(false);
          }
        }}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      />

      <Modal
        isDismissable={!downloadingId}
        isKeyboardDismissDisabled={Boolean(downloadingId)}
        isOpen={Boolean(downloadRow)}
        onOpenChange={(open) => {
          if (!open && !downloadingId) setDownloadRow(null);
        }}
      >
        <ModalContent>
          <ModalHeader>Descargar cotización PDF</ModalHeader>
          <ModalBody>
            <p className="text-sm text-default-600">
              Elige el formato del PDF: interno o externo.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="light"
              isDisabled={Boolean(downloadingId)}
              onPress={() => setDownloadRow(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="flat"
              isDisabled={Boolean(downloadingId) || !downloadRow}
              onPress={() => {
                if (!downloadRow) return;
                downloadPdf(downloadRow, "interno");
              }}
            >
              PDF interno
            </Button>
            <Button
              color="primary"
              isDisabled={Boolean(downloadingId) || !downloadRow}
              onPress={() => {
                if (!downloadRow) return;
                downloadPdf(downloadRow, "externo");
              }}
            >
              PDF externo
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal
        isDismissable={!prefacturaId}
        isKeyboardDismissDisabled={Boolean(prefacturaId)}
        isOpen={Boolean(prefacturaRow)}
        onOpenChange={(open) => {
          if (!open) closePrefacturaModal();
        }}
      >
        <ModalContent>
          <ModalHeader>
            {prefacturaRow?.prefacturaApproved
              ? "Volver prefactura"
              : "Aprobar prefactura"}
          </ModalHeader>
          <ModalBody className="space-y-3">
            <Input
              label="Nombre del pedido"
              placeholder="Ej: Pedido COT10001"
              value={prefacturaOrderName}
              onValueChange={setPrefacturaOrderName}
            />
            <Select
              label="Tipo de pedido"
              selectedKeys={[prefacturaOrderType]}
              onSelectionChange={(keys) => {
                const first = String(Array.from(keys)[0] ?? "VN");
                setPrefacturaOrderType(first === "VI" ? "VI" : "VN");
              }}
            >
              <SelectItem key="VN">Nacional</SelectItem>
              <SelectItem key="VI">Internacional</SelectItem>
            </Select>
          </ModalBody>
          <ModalFooter>
            <Button isDisabled={Boolean(prefacturaId)} variant="flat" onPress={closePrefacturaModal}>
              Cancelar
            </Button>
            <Button color="primary" isLoading={Boolean(prefacturaId)} onPress={convertToPrefactura}>
              Confirmar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
