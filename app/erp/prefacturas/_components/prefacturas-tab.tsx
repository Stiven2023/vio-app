"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
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
import { Input } from "@heroui/input";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import NextLink from "next/link";
import {
  BsEye,
  BsPiggyBank,
  BsPencilSquare,
  BsPlusCircle,
  BsThreeDotsVertical,
  BsTrash,
} from "react-icons/bs";

import { FilterSearch } from "@/app/erp/catalog/_components/ui/filter-search";
import { FilterSelect } from "@/app/erp/catalog/_components/ui/filter-select";
import { TableSkeleton } from "@/app/erp/catalog/_components/ui/table-skeleton";
import { usePaginatedApi } from "@/app/erp/orders/_hooks/use-paginated-api";
import { apiJson, getErrorMessage } from "@/app/erp/orders/_lib/api";
import { ConfirmActionModal } from "@/components/confirm-action-modal";
import { FileUpload } from "@/components/file-upload";

type OrderType = "VN" | "VI" | "VT" | "VW";

type PrefacturaRow = {
  id: string;
  prefacturaCode: string;
  quotationId: string | null;
  quoteCode: string | null;
  orderId: string | null;
  orderCode: string | null;
  orderName: string | null;
  orderType: OrderType | null;
  status: string;
  totalProducts: string | null;
  subtotal: string | null;
  total: string | null;
  clientName: string | null;
  documentType: "F" | "R" | null;
  approvedAt: string | null;
  createdAt: string | null;
};

type BankOption = {
  id: string;
  code: string;
  name: string;
  accountRef: string;
  isActive: boolean | null;
};

type PrefacturaAdvanceDetail = {
  id: string;
  prefacturaCode?: string | null;
  total?: string | null;
  currency?: string | null;
  advanceRequired?: string | null;
  advanceReceived?: string | null;
  advanceMethod?: "EFECTIVO" | "TRANSFERENCIA" | null;
  advanceBankId?: string | null;
  advanceReferenceNumber?: string | null;
  advanceCurrency?: string | null;
  advanceDate?: string | null;
  advancePaymentImageUrl?: string | null;
};

const documentTypeOptions = [
  { value: "all", label: "Todos" },
  { value: "F", label: "F" },
  { value: "R", label: "R" },
];

const statusOptions = [
  { value: "all", label: "Todos" },
  { value: "PENDIENTE_CONTABILIDAD", label: "Pendiente contabilidad" },
  { value: "APROBACION", label: "Aprobación" },
  { value: "PROGRAMACION", label: "Programación" },
  { value: "PENDIENTE", label: "Pendiente" },
  { value: "APROBADA", label: "Aprobada" },
  { value: "CANCELADA", label: "Cancelada" },
  { value: "ANULADA", label: "Anulada" },
];

const typeOptions = [
  { value: "all", label: "Todos" },
  { value: "VN", label: "Nacional" },
  { value: "VI", label: "Internacional" },
  { value: "VT", label: "VT" },
  { value: "VW", label: "VW" },
];

function formatMoney(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount)) return "-";

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function normalizeCurrency(value: string | null | undefined): "COP" | "USD" {
  return String(value ?? "COP")
    .trim()
    .toUpperCase() === "USD"
    ? "USD"
    : "COP";
}

function formatMoneyByCurrency(
  value: string | number | null | undefined,
  currency: "COP" | "USD",
) {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount)) return "-";

  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "es-CO", {
    style: "currency",
    currency,
    minimumFractionDigits: currency === "USD" ? 2 : 0,
    maximumFractionDigits: currency === "USD" ? 2 : 0,
  }).format(amount);
}

function normalizeAmountInput(value: string) {
  const raw = value.replace(/[^\d.,]/g, "");

  if (!raw) return "";

  const normalized = raw.replace(/,/g, ".");
  const parts = normalized.split(".");

  if (parts.length === 1) {
    return parts[0].replace(/^0+(?=\d)/, "");
  }

  const integer = (parts[0] || "0").replace(/^0+(?=\d)/, "");
  const decimal = parts.slice(1).join("").replace(/\D/g, "").slice(0, 2);

  return decimal ? `${integer}.${decimal}` : integer;
}

function resolveAdvanceStatus(amount: number, total: number) {
  if (!Number.isFinite(total) || total <= 0) return "PENDIENTE";

  const percentage = Math.max(0, (amount / total) * 100);

  if (percentage >= 50) return "RECIBIDO";
  if (percentage > 29) return "PARCIAL";

  return "PENDIENTE";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("es-CO");
}

export function PrefacturasTab({
  canCreate,
  canEdit,
  canDelete,
  initialStatus = "all",
  lockStatusFilter = false,
  initialOrderStatus = "all",
}: {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  initialStatus?: string;
  lockStatusFilter?: boolean;
  initialOrderStatus?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [type, setType] = useState("all");
  const [documentType, setDocumentType] = useState("all");

  const endpoint = useMemo(() => {
    const sp = new URLSearchParams();

    const query = q.trim();

    if (query) sp.set("q", query);
    if (status !== "all") sp.set("status", status);
    if (type !== "all") sp.set("type", type);
    if (documentType !== "all") sp.set("documentType", documentType);
    if (initialOrderStatus !== "all") sp.set("orderStatus", initialOrderStatus);

    const qs = sp.toString();

    return `/api/prefacturas${qs ? `?${qs}` : ""}`;
  }, [documentType, q, status, type, initialOrderStatus]);

  const { data, loading, page, setPage, refresh } =
    usePaginatedApi<PrefacturaRow>(endpoint, 10);

  const [pendingDelete, setPendingDelete] = useState<PrefacturaRow | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const [banks, setBanks] = useState<BankOption[]>([]);

  const [advanceModalOpen, setAdvanceModalOpen] = useState(false);
  const [advanceLoading, setAdvanceLoading] = useState(false);
  const [advanceSubmitting, setAdvanceSubmitting] = useState(false);
  const [advanceTarget, setAdvanceTarget] = useState<PrefacturaRow | null>(
    null,
  );
  const [advanceDetail, setAdvanceDetail] =
    useState<PrefacturaAdvanceDetail | null>(null);
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [advanceMethod, setAdvanceMethod] = useState<
    "EFECTIVO" | "TRANSFERENCIA"
  >("EFECTIVO");
  const [advanceBankId, setAdvanceBankId] = useState("");
  const [advanceReferenceNumber, setAdvanceReferenceNumber] = useState("");
  const [advanceCurrency, setAdvanceCurrency] = useState<"COP" | "USD">("COP");
  const [advanceDate, setAdvanceDate] = useState("");
  const [advanceProofImageUrl, setAdvanceProofImageUrl] = useState("");

  useEffect(() => {
    apiJson<{ items: BankOption[] }>("/api/banks?page=1&pageSize=200")
      .then((res) =>
        setBanks((res.items ?? []).filter((bank) => bank.isActive !== false)),
      )
      .catch(() => setBanks([]));
  }, []);

  const emptyContent = useMemo(() => {
    if (loading) return "";
    if (
      q.trim() ||
      status !== "all" ||
      type !== "all" ||
      documentType !== "all"
    )
      return "Sin resultados";

    return "Sin prefacturas";
  }, [documentType, loading, q, status, type]);

  const removePrefactura = async () => {
    if (!pendingDelete || deleting) return;

    try {
      setDeleting(true);
      await apiJson(`/api/prefacturas/${pendingDelete.id}`, {
        method: "DELETE",
      });

      toast.success("Prefactura eliminada");
      setPendingDelete(null);
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  };

  const openAdvanceModal = async (row: PrefacturaRow) => {
    setAdvanceTarget(row);
    setAdvanceModalOpen(true);
    setAdvanceLoading(true);

    try {
      const detail = await apiJson<PrefacturaAdvanceDetail>(
        `/api/prefacturas/${row.id}`,
      );

      const paymentCurrency = normalizeCurrency(
        detail.advanceCurrency ?? detail.currency,
      );

      setAdvanceDetail(detail);
      setAdvanceAmount(String(detail.advanceReceived ?? ""));
      setAdvanceMethod(
        detail.advanceMethod === "TRANSFERENCIA" ? "TRANSFERENCIA" : "EFECTIVO",
      );
      setAdvanceBankId(detail.advanceBankId ?? "");
      setAdvanceReferenceNumber(detail.advanceReferenceNumber ?? "");
      setAdvanceCurrency(paymentCurrency);
      setAdvanceDate(
        detail.advanceDate ? String(detail.advanceDate).slice(0, 10) : "",
      );
      setAdvanceProofImageUrl(detail.advancePaymentImageUrl ?? "");
    } catch (error) {
      toast.error(getErrorMessage(error));
      setAdvanceModalOpen(false);
      setAdvanceTarget(null);
    } finally {
      setAdvanceLoading(false);
    }
  };

  const saveAdvancePayment = async () => {
    if (!advanceTarget || advanceSubmitting) return;

    const amount = Number(advanceAmount || 0);

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Ingresa un monto abonado válido");

      return;
    }

    if (advanceMethod === "TRANSFERENCIA" && !advanceBankId.trim()) {
      toast.error("Selecciona el banco para la transferencia");

      return;
    }

    if (advanceMethod === "TRANSFERENCIA" && !advanceReferenceNumber.trim()) {
      toast.error("Ingresa el número de referencia de la transferencia");

      return;
    }

    if (advanceMethod === "TRANSFERENCIA" && !advanceProofImageUrl.trim()) {
      toast.error("Adjunta el comprobante para registrar la transferencia");

      return;
    }

    const total = Number(advanceDetail?.total ?? advanceTarget.total ?? 0);
    const status = resolveAdvanceStatus(amount, total);

    try {
      setAdvanceSubmitting(true);

      await apiJson(`/api/prefacturas/${advanceTarget.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          advanceReceived: amount,
          advanceMethod,
          advanceBankId:
            advanceMethod === "TRANSFERENCIA" ? advanceBankId : null,
          advanceReferenceNumber:
            advanceMethod === "TRANSFERENCIA"
              ? advanceReferenceNumber.trim() || null
              : null,
          advanceCurrency,
          advanceDate: advanceDate || null,
          advancePaymentImageUrl: advanceProofImageUrl || null,
          advanceStatus: status,
        }),
      });

      if (advanceMethod === "EFECTIVO") {
        toast.success("Efectivo registrado — el pago fue confirmado en caja");
      } else {
        toast.success(
          "Transferencia registrada como NO CONSIGNADO — pendiente de verificación en contabilidad",
        );
      }
      setAdvanceModalOpen(false);
      setAdvanceTarget(null);
      setAdvanceDetail(null);
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setAdvanceSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <FilterSearch
            className="sm:w-72"
            placeholder="Código prefactura, cotización o pedido…"
            value={q}
            onValueChange={setQ}
          />
          <FilterSelect
            className="sm:w-48"
            isDisabled={lockStatusFilter}
            label="Estado"
            options={statusOptions}
            value={status}
            onChange={setStatus}
          />
          <FilterSelect
            className="sm:w-48"
            label="Tipo"
            options={typeOptions}
            value={type}
            onChange={setType}
          />
          <FilterSelect
            className="sm:w-40"
            label="Documento"
            options={documentTypeOptions}
            value={documentType}
            onChange={setDocumentType}
          />
        </div>

        <div className="flex gap-2">
          {canCreate ? (
            <Button
              color="primary"
              onPress={() => router.push("/erp/prefacturas/new")}
            >
              <BsPlusCircle /> Nueva prefactura
            </Button>
          ) : null}
          <Button variant="flat" onPress={refresh}>
            Refrescar
          </Button>
        </div>
      </div>

      {loading ? (
        <TableSkeleton
          ariaLabel="Prefacturas"
          headers={[
            "Código",
            "Cotización",
            "Pedido",
            "Tipo",
            "Cliente",
            "Estado",
            "Total",
            "Creada",
            "Acciones",
          ]}
        />
      ) : (
        <Table aria-label="Prefacturas">
          <TableHeader>
            <TableColumn>Código</TableColumn>
            <TableColumn>Cotización</TableColumn>
            <TableColumn>Pedido</TableColumn>
            <TableColumn>Tipo</TableColumn>
            <TableColumn>Cliente</TableColumn>
            <TableColumn>Estado</TableColumn>
            <TableColumn>Total</TableColumn>
            <TableColumn>Creada</TableColumn>
            <TableColumn>Acciones</TableColumn>
          </TableHeader>
          <TableBody emptyContent={emptyContent} items={data?.items ?? []}>
            {(row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">
                  {row.prefacturaCode}
                </TableCell>
                <TableCell>{row.quoteCode ?? "-"}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span>{row.orderCode ?? "-"}</span>
                    <span className="text-xs text-default-500">
                      {row.orderName ?? "-"}
                    </span>
                  </div>
                </TableCell>
                <TableCell>{row.orderType ?? "-"}</TableCell>
                <TableCell>{row.clientName ?? "-"}</TableCell>
                <TableCell>{row.status}</TableCell>
                <TableCell>{formatMoney(row.total)}</TableCell>
                <TableCell>{formatDate(row.createdAt)}</TableCell>
                <TableCell>
                  <Dropdown>
                    <DropdownTrigger>
                      <Button size="sm" variant="flat">
                        <BsThreeDotsVertical />
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu aria-label="Acciones prefactura">
                      {row.orderId ? (
                        <DropdownItem
                          key="view"
                          as={NextLink}
                          href={`/erp/orders/${row.orderId}/detail`}
                          startContent={<BsEye />}
                        >
                          Ver pedido
                        </DropdownItem>
                      ) : null}
                      {canEdit ? (
                        <DropdownItem
                          key="edit"
                          startContent={<BsPencilSquare />}
                          onPress={() =>
                            router.push(`/erp/prefacturas/${row.id}/edit`)
                          }
                        >
                          Editar
                        </DropdownItem>
                      ) : null}
                      {canEdit ? (
                        <DropdownItem
                          key="advance"
                          startContent={<BsPiggyBank />}
                          onPress={() => openAdvanceModal(row)}
                        >
                          Realizar anticipo
                        </DropdownItem>
                      ) : null}
                      {canDelete ? (
                        <DropdownItem
                          key="delete"
                          className="text-danger"
                          color="danger"
                          startContent={<BsTrash />}
                          onPress={() => setPendingDelete(row)}
                        >
                          Eliminar
                        </DropdownItem>
                      ) : null}
                    </DropdownMenu>
                  </Dropdown>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-default-500">Total: {data?.total ?? 0}</p>
        <div className="flex gap-2">
          <Button
            isDisabled={page <= 1 || loading}
            variant="flat"
            onPress={() => setPage((p) => Math.max(1, p - 1))}
          >
            Anterior
          </Button>
          <Button
            isDisabled={!data?.hasNextPage || loading}
            variant="flat"
            onPress={() => setPage((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      </div>

      <ConfirmActionModal
        cancelLabel="Cancelar"
        confirmLabel="Eliminar"
        description={
          pendingDelete
            ? `¿Eliminar la prefactura ${pendingDelete.prefacturaCode}?`
            : undefined
        }
        isLoading={deleting}
        isOpen={Boolean(pendingDelete)}
        title="Confirmar eliminación"
        onConfirm={removePrefactura}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      />

      <Modal
        isOpen={advanceModalOpen}
        size="xl"
        onOpenChange={(open) => {
          setAdvanceModalOpen(open);
          if (!open) {
            setAdvanceTarget(null);
            setAdvanceDetail(null);
          }
        }}
      >
        <ModalContent>
          <ModalHeader>Registrar anticipo</ModalHeader>
          <ModalBody>
            {advanceLoading ? (
              <p className="text-sm text-default-500">Cargando prefactura...</p>
            ) : (
              <div className="space-y-3">
                <div className="rounded-medium border border-default-200 bg-default-50 p-3 text-sm">
                  <div>
                    <span className="text-default-500">Prefactura:</span>{" "}
                    <strong>
                      {advanceDetail?.prefacturaCode ??
                        advanceTarget?.prefacturaCode ??
                        "-"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-default-500">Meta 50%:</span>{" "}
                    <strong>
                      {formatMoneyByCurrency(
                        Number(
                          advanceDetail?.total ?? advanceTarget?.total ?? 0,
                        ) * 0.5,
                        normalizeCurrency(advanceDetail?.currency),
                      )}
                    </strong>
                  </div>
                </div>

                <Input
                  label="Monto abonado"
                  placeholder="0"
                  value={advanceAmount}
                  variant="bordered"
                  onValueChange={(value) =>
                    setAdvanceAmount(normalizeAmountInput(value))
                  }
                />

                <Select
                  label="Método de pago"
                  selectedKeys={[advanceMethod]}
                  variant="bordered"
                  onSelectionChange={(keys) => {
                    const first = String(Array.from(keys)[0] ?? "EFECTIVO");

                    setAdvanceMethod(
                      first === "TRANSFERENCIA" ? "TRANSFERENCIA" : "EFECTIVO",
                    );
                  }}
                >
                  <SelectItem key="EFECTIVO">Efectivo</SelectItem>
                  <SelectItem key="TRANSFERENCIA">Transferencia</SelectItem>
                </Select>

                <Select
                  label="Moneda"
                  selectedKeys={[advanceCurrency]}
                  variant="bordered"
                  onSelectionChange={(keys) => {
                    const first = String(Array.from(keys)[0] ?? "COP");

                    setAdvanceCurrency(first === "USD" ? "USD" : "COP");
                  }}
                >
                  <SelectItem key="COP">COP</SelectItem>
                  <SelectItem key="USD">USD</SelectItem>
                </Select>

                {advanceMethod === "TRANSFERENCIA" ? (
                  <>
                    <Select
                      label="Banco"
                      selectedKeys={advanceBankId ? [advanceBankId] : []}
                      variant="bordered"
                      onSelectionChange={(keys) => {
                        setAdvanceBankId(String(Array.from(keys)[0] ?? ""));
                      }}
                    >
                      {banks.map((bank) => (
                        <SelectItem key={bank.id}>
                          {[bank.code, bank.name].filter(Boolean).join(" - ")}
                        </SelectItem>
                      ))}
                    </Select>

                    <Input
                      label="Número de referencia"
                      placeholder="Ej: 8457712201"
                      value={advanceReferenceNumber}
                      variant="bordered"
                      onValueChange={setAdvanceReferenceNumber}
                    />
                  </>
                ) : null}

                <Input
                  label="Fecha de pago"
                  type="date"
                  value={advanceDate}
                  variant="bordered"
                  onValueChange={setAdvanceDate}
                />

                <FileUpload
                  acceptedFileTypes="image/*"
                  errorMessage={
                    advanceMethod === "TRANSFERENCIA" &&
                    !advanceProofImageUrl.trim()
                      ? "El comprobante es obligatorio para transferencias"
                      : undefined
                  }
                  isRequired={advanceMethod === "TRANSFERENCIA"}
                  label="Comprobante del anticipo"
                  uploadFolder="prefacturas/anticipos"
                  value={advanceProofImageUrl}
                  onChange={setAdvanceProofImageUrl}
                  onClear={() => setAdvanceProofImageUrl("")}
                />
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setAdvanceModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              color="primary"
              isDisabled={advanceLoading || advanceSubmitting}
              isLoading={advanceSubmitting}
              onPress={saveAdvancePayment}
            >
              Guardar anticipo
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
