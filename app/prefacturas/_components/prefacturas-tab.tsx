"use client";

import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
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
import { Select, SelectItem } from "@heroui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";
import NextLink from "next/link";
import {
  BsEye,
  BsPencilSquare,
  BsPlusCircle,
  BsThreeDotsVertical,
  BsTrash,
} from "react-icons/bs";

import { FilterSearch } from "@/app/catalog/_components/ui/filter-search";
import { FilterSelect } from "@/app/catalog/_components/ui/filter-select";
import { TableSkeleton } from "@/app/catalog/_components/ui/table-skeleton";
import { usePaginatedApi } from "@/app/orders/_hooks/use-paginated-api";
import { apiJson, getErrorMessage } from "@/app/orders/_lib/api";
import { ConfirmActionModal } from "@/components/confirm-action-modal";

type OrderType = "VN" | "VI";

type PrefacturaRow = {
  id: string;
  prefacturaCode: string;
  quotationId: string;
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
  approvedAt: string | null;
  createdAt: string | null;
};

const statusOptions = [
  { value: "all", label: "Todos" },
  { value: "PENDIENTE_CONTABILIDAD", label: "Pendiente contabilidad" },
  { value: "APROBACION_INICIAL", label: "Aprobación inicial" },
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
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [type, setType] = useState("all");

  const endpoint = useMemo(() => {
    const sp = new URLSearchParams();

    const query = q.trim();
    if (query) sp.set("q", query);
    if (status !== "all") sp.set("status", status);
    if (type !== "all") sp.set("type", type);
    if (initialOrderStatus !== "all") sp.set("orderStatus", initialOrderStatus);

    const qs = sp.toString();

    return `/api/prefacturas${qs ? `?${qs}` : ""}`;
  }, [q, status, type, initialOrderStatus]);

  const { data, loading, page, setPage, refresh } =
    usePaginatedApi<PrefacturaRow>(endpoint, 10);

  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createQuotationCode, setCreateQuotationCode] = useState("");
  const [createOrderName, setCreateOrderName] = useState("");
  const [createOrderType, setCreateOrderType] = useState<OrderType>("VN");

  const [editing, setEditing] = useState<PrefacturaRow | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editOrderName, setEditOrderName] = useState("");
  const [editOrderType, setEditOrderType] = useState<OrderType>("VN");
  const [editStatus, setEditStatus] = useState<string>("APROBADA");

  const [pendingDelete, setPendingDelete] = useState<PrefacturaRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const emptyContent = useMemo(() => {
    if (loading) return "";
    if (q.trim() || status !== "all" || type !== "all") return "Sin resultados";

    return "Sin prefacturas";
  }, [loading, q, status, type]);

  const openEdit = (row: PrefacturaRow) => {
    setEditing(row);
    setEditOrderName(String(row.orderName ?? ""));
    setEditOrderType(row.orderType === "VI" ? "VI" : "VN");
    setEditStatus(String(row.status ?? "APROBADA").toUpperCase());
  };

  const closeCreate = () => {
    if (createLoading) return;
    setCreateOpen(false);
    setCreateQuotationCode("");
    setCreateOrderName("");
    setCreateOrderType("VN");
  };

  const closeEdit = () => {
    if (editLoading) return;
    setEditing(null);
    setEditOrderName("");
    setEditOrderType("VN");
    setEditStatus("APROBADA");
  };

  const createPrefactura = async () => {
    if (!createQuotationCode.trim()) {
      toast.error("Ingresa el código de cotización");
      return;
    }

    if (createLoading) return;

    try {
      setCreateLoading(true);
      await apiJson("/api/prefacturas", {
        method: "POST",
        body: JSON.stringify({
          quotationCode: createQuotationCode.trim(),
          orderName: createOrderName.trim(),
          orderType: createOrderType,
        }),
      });

      toast.success("Prefactura creada");
      closeCreate();
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setCreateLoading(false);
    }
  };

  const updatePrefactura = async () => {
    if (!editing) return;
    if (editLoading) return;

    try {
      setEditLoading(true);
      await apiJson(`/api/prefacturas/${editing.id}`, {
        method: "PUT",
        body: JSON.stringify({
          orderName: editOrderName.trim(),
          orderType: editOrderType,
          status: editStatus,
        }),
      });

      toast.success("Prefactura actualizada");
      closeEdit();
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setEditLoading(false);
    }
  };

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
            label="Estado"
            options={statusOptions}
            value={status}
            onChange={setStatus}
            isDisabled={lockStatusFilter}
          />
          <FilterSelect
            className="sm:w-48"
            label="Tipo"
            options={typeOptions}
            value={type}
            onChange={setType}
          />
        </div>

        <div className="flex gap-2">
          {canCreate ? (
            <Button color="primary" onPress={() => setCreateOpen(true)}>
              <BsPlusCircle /> Nueva prefactura
            </Button>
          ) : null}
          <Button variant="flat" onPress={refresh}>Refrescar</Button>
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
                <TableCell className="font-medium">{row.prefacturaCode}</TableCell>
                <TableCell>{row.quoteCode ?? "-"}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span>{row.orderCode ?? "-"}</span>
                    <span className="text-xs text-default-500">{row.orderName ?? "-"}</span>
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
                          href={`/orders/${row.orderId}/detail`}
                          startContent={<BsEye />}
                        >
                          Ver pedido
                        </DropdownItem>
                      ) : null}
                      {canEdit ? (
                        <DropdownItem
                          key="edit"
                          startContent={<BsPencilSquare />}
                          onPress={() => openEdit(row)}
                        >
                          Editar
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

      <Modal
        isDismissable={!createLoading}
        isKeyboardDismissDisabled={Boolean(createLoading)}
        isOpen={createOpen}
        onOpenChange={(open) => {
          if (!open) closeCreate();
        }}
      >
        <ModalContent>
          <ModalHeader>Nueva prefactura</ModalHeader>
          <ModalBody className="space-y-3">
            <Input
              label="Código de cotización"
              placeholder="Ej: COT10001"
              value={createQuotationCode}
              onValueChange={setCreateQuotationCode}
            />
            <Input
              label="Nombre del pedido"
              placeholder="Ej: Pedido COT10001"
              value={createOrderName}
              onValueChange={setCreateOrderName}
            />
            <Select
              label="Tipo de pedido"
              selectedKeys={[createOrderType]}
              onSelectionChange={(keys) => {
                const first = String(Array.from(keys)[0] ?? "VN");
                setCreateOrderType(first === "VI" ? "VI" : "VN");
              }}
            >
              <SelectItem key="VN">Nacional</SelectItem>
              <SelectItem key="VI">Internacional</SelectItem>
            </Select>
          </ModalBody>
          <ModalFooter>
            <Button isDisabled={Boolean(createLoading)} variant="flat" onPress={closeCreate}>
              Cancelar
            </Button>
            <Button color="primary" isLoading={Boolean(createLoading)} onPress={createPrefactura}>
              Crear
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal
        isDismissable={!editLoading}
        isKeyboardDismissDisabled={Boolean(editLoading)}
        isOpen={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) closeEdit();
        }}
      >
        <ModalContent>
          <ModalHeader>Editar prefactura</ModalHeader>
          <ModalBody className="space-y-3">
            <Input
              label="Nombre del pedido"
              value={editOrderName}
              onValueChange={setEditOrderName}
            />
            <Select
              label="Tipo de pedido"
              selectedKeys={[editOrderType]}
              onSelectionChange={(keys) => {
                const first = String(Array.from(keys)[0] ?? "VN");
                setEditOrderType(first === "VI" ? "VI" : "VN");
              }}
            >
              <SelectItem key="VN">Nacional</SelectItem>
              <SelectItem key="VI">Internacional</SelectItem>
            </Select>
            <Select
              label="Estado"
              selectedKeys={[editStatus]}
              onSelectionChange={(keys) => {
                const first = String(Array.from(keys)[0] ?? "APROBADA");
                setEditStatus(first.toUpperCase());
              }}
            >
              <SelectItem key="PENDIENTE_CONTABILIDAD">Pendiente contabilidad</SelectItem>
              <SelectItem key="APROBACION_INICIAL">Aprobación inicial</SelectItem>
              <SelectItem key="PROGRAMACION">Programación</SelectItem>
              <SelectItem key="PENDIENTE">Pendiente</SelectItem>
              <SelectItem key="APROBADA">Aprobada</SelectItem>
              <SelectItem key="CANCELADA">Cancelada</SelectItem>
              <SelectItem key="ANULADA">Anulada</SelectItem>
            </Select>
          </ModalBody>
          <ModalFooter>
            <Button isDisabled={Boolean(editLoading)} variant="flat" onPress={closeEdit}>
              Cancelar
            </Button>
            <Button color="primary" isLoading={Boolean(editLoading)} onPress={updatePrefactura}>
              Guardar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

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
    </div>
  );
}
