"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Checkbox } from "@heroui/checkbox";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Skeleton } from "@heroui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";
import { BsTrash } from "react-icons/bs";

import { apiJson, getErrorMessage } from "@/app/erp/orders/_lib/api";
import { Pager } from "@/app/erp/catalog/_components/ui/pager";

type RoleArea = "OPERARIOS" | "CONFECCIONISTAS" | "MENSAJERIA" | "EMPAQUE";
type OperationType =
  | "PLOTTER"
  | "CALANDRA"
  | "CORTE_LASER"
  | "CORTE_MANUAL"
  | "INTEGRACION"
  | "DESPACHO";
type ProcessCode = "P" | "S" | "C";

type WorklogItem = {
  id: string;
  roleArea: RoleArea;
  operationType: OperationType | null;
  orderCode: string;
  designName: string;
  details: string | null;
  size: string | null;
  quantityOp: number;
  producedQuantity: number;
  startAt: string | null;
  endAt: string | null;
  isComplete: boolean;
  isPartial: boolean;
  observations: string | null;
  repoCheck: boolean;
  processCode: ProcessCode;
  linkedOrderItemStatus?: string | null;
  createdAt: string | null;
};

type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
};

const roleAreaOptions: Array<{ value: RoleArea; label: string }> = [
  { value: "OPERARIOS", label: "Operarios" },
  { value: "CONFECCIONISTAS", label: "Confeccionistas" },
  { value: "MENSAJERIA", label: "Mensajería" },
  { value: "EMPAQUE", label: "Empaque" },
];

const operationOptions: Array<{ value: OperationType; label: string }> = [
  { value: "PLOTTER", label: "Plotter" },
  { value: "CALANDRA", label: "Calandra" },
  { value: "CORTE_LASER", label: "Corte láser" },
  { value: "CORTE_MANUAL", label: "Corte manual" },
  { value: "INTEGRACION", label: "Integración" },
  { value: "DESPACHO", label: "Despacho" },
];

const processOptions: Array<{ value: ProcessCode; label: string }> = [
  { value: "P", label: "P" },
  { value: "S", label: "S" },
  { value: "C", label: "C" },
];

type DraftRow = {
  roleArea: RoleArea;
  operationType: OperationType;
  orderCode: string;
  designName: string;
  details: string;
  size: string;
  quantityOp: string;
  producedQuantity: string;
  startAt: string;
  endAt: string;
  isComplete: boolean;
  isPartial: boolean;
  observations: string;
  repoCheck: boolean;
  processCode: ProcessCode;
};

const initialDraft: DraftRow = {
  roleArea: "OPERARIOS",
  operationType: "PLOTTER",
  orderCode: "",
  designName: "",
  details: "",
  size: "",
  quantityOp: "0",
  producedQuantity: "0",
  startAt: "",
  endAt: "",
  isComplete: false,
  isPartial: false,
  observations: "",
  repoCheck: false,
  processCode: "P",
};

function asDateTimeInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function asDateTimeIso(value: string) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function normalizeRoleAreaByRole(role: string): RoleArea {
  if (role === "CONFECCIONISTA") return "CONFECCIONISTAS";
  if (role === "MENSAJERO") return "MENSAJERIA";
  if (role === "EMPAQUE") return "EMPAQUE";
  return "OPERARIOS";
}

export function OperarioWorklogTable({ role }: { role: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [data, setData] = useState<Paginated<WorklogItem> | null>(null);
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<DraftRow>(() => ({
    ...initialDraft,
    roleArea: normalizeRoleAreaByRole(role),
  }));

  const roleAreaFilter = useMemo(() => normalizeRoleAreaByRole(role), [role]);

  useEffect(() => {
    setDraft((prev) => ({
      ...prev,
      roleArea: roleAreaFilter,
    }));
  }, [roleAreaFilter]);

  useEffect(() => {
    let active = true;
    setLoading(true);

    apiJson<Paginated<WorklogItem>>(
      `/api/dashboard/operative-logs?page=${page}&pageSize=10&roleArea=${roleAreaFilter}`,
    )
      .then((res) => {
        if (!active) return;
        setData(res);
      })
      .catch((error) => {
        if (!active) return;
        setData({ items: [], page: 1, pageSize: 10, total: 0, hasNextPage: false });
        toast.error(getErrorMessage(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [page, roleAreaFilter]);

  const reload = () => {
    setPage((current) => current);
    setLoading(true);
    apiJson<Paginated<WorklogItem>>(
      `/api/dashboard/operative-logs?page=${page}&pageSize=10&roleArea=${roleAreaFilter}`,
    )
      .then((res) => setData(res))
      .catch((error) => toast.error(getErrorMessage(error)))
      .finally(() => setLoading(false));
  };

  const createRecord = async () => {
    if (saving) return;

    if (!draft.orderCode.trim()) {
      toast.error("El pedido es obligatorio");
      return;
    }

    if (!draft.designName.trim()) {
      toast.error("El diseño es obligatorio");
      return;
    }

    try {
      setSaving(true);
      await apiJson("/api/dashboard/operative-logs", {
        method: "POST",
        body: JSON.stringify({
          roleArea: draft.roleArea,
          operationType: draft.operationType,
          orderCode: draft.orderCode,
          designName: draft.designName,
          details: draft.details || null,
          size: draft.size || null,
          quantityOp: Number(draft.quantityOp || 0),
          producedQuantity: Number(draft.producedQuantity || 0),
          startAt: asDateTimeIso(draft.startAt),
          endAt: asDateTimeIso(draft.endAt),
          isComplete: draft.isComplete,
          isPartial: draft.isPartial,
          observations: draft.observations || null,
          repoCheck: draft.repoCheck,
          processCode: draft.processCode,
        }),
      });

      toast.success("Registro operativo creado");
      setDraft({
        ...initialDraft,
        roleArea: roleAreaFilter,
      });
      reload();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const removeRecord = async (id: string) => {
    if (deletingId) return;

    try {
      setDeletingId(id);
      await apiJson(`/api/dashboard/operative-logs/${id}`, {
        method: "DELETE",
      });
      toast.success("Registro eliminado");
      reload();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeletingId(null);
    }
  };

  const createRepositionFromRow = async (id: string) => {
    if (saving) return;

    try {
      setSaving(true);
      await apiJson(`/api/dashboard/operative-logs/${id}`, {
        method: "POST",
      });
      toast.success("Reposición creada y vinculada con Programación");
      reload();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-sm text-default-500">
        Registra producción por rol y operación: pedido, diseño, talla y cantidades; si marcas parcial + repo o creas reposición desde una fila parcial, se vincula con Programación por pedido/diseño/talla.
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <Input
          label="Pedido"
          size="sm"
          value={draft.orderCode}
          onValueChange={(value) => setDraft((s) => ({ ...s, orderCode: value }))}
        />
        <Input
          label="Diseño"
          size="sm"
          value={draft.designName}
          onValueChange={(value) => setDraft((s) => ({ ...s, designName: value }))}
        />
        <Input
          label="Detalles"
          size="sm"
          value={draft.details}
          onValueChange={(value) => setDraft((s) => ({ ...s, details: value }))}
        />
        <Input
          label="Talla"
          size="sm"
          value={draft.size}
          onValueChange={(value) => setDraft((s) => ({ ...s, size: value }))}
        />
        <Input
          label="Cantidad OP"
          size="sm"
          type="number"
          value={draft.quantityOp}
          onValueChange={(value) => setDraft((s) => ({ ...s, quantityOp: value }))}
        />
        <Input
          label="Cantidad producida"
          size="sm"
          type="number"
          value={draft.producedQuantity}
          onValueChange={(value) => setDraft((s) => ({ ...s, producedQuantity: value }))}
        />
        <Input
          label="Hora inicio"
          size="sm"
          type="datetime-local"
          value={draft.startAt}
          onValueChange={(value) => setDraft((s) => ({ ...s, startAt: value }))}
        />
        <Input
          label="Hora fin"
          size="sm"
          type="datetime-local"
          value={draft.endAt}
          onValueChange={(value) => setDraft((s) => ({ ...s, endAt: value }))}
        />
        <Input
          label="Observaciones"
          size="sm"
          value={draft.observations}
          onValueChange={(value) => setDraft((s) => ({ ...s, observations: value }))}
        />
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
        <Select
          label="Proceso"
          disallowEmptySelection
          selectedKeys={[draft.processCode]}
          size="sm"
          onSelectionChange={(keys) => {
            const first = Array.from(keys)[0] as ProcessCode | undefined;
            setDraft((s) => ({ ...s, processCode: first ?? "P" }));
          }}
        >
          {processOptions.map((option) => (
            <SelectItem key={option.value}>{option.label}</SelectItem>
          ))}
        </Select>

        <Select
          label="Operación"
          disallowEmptySelection
          selectedKeys={[draft.operationType]}
          size="sm"
          onSelectionChange={(keys) => {
            const first = Array.from(keys)[0] as OperationType | undefined;
            setDraft((s) => ({ ...s, operationType: first ?? "PLOTTER" }));
          }}
        >
          {operationOptions.map((option) => (
            <SelectItem key={option.value}>{option.label}</SelectItem>
          ))}
        </Select>

        <div className="flex items-center gap-3">
          <Checkbox
            isSelected={draft.isComplete}
            onValueChange={(value) => setDraft((s) => ({ ...s, isComplete: value }))}
          >
            Completo
          </Checkbox>
        </div>

        <div className="flex items-center gap-3">
          <Checkbox
            isSelected={draft.isPartial}
            onValueChange={(value) => setDraft((s) => ({ ...s, isPartial: value }))}
          >
            Parcial
          </Checkbox>
        </div>

        <div className="flex items-center gap-3">
          <Checkbox
            isSelected={draft.repoCheck}
            onValueChange={(value) => setDraft((s) => ({ ...s, repoCheck: value }))}
          >
            Repo
          </Checkbox>
        </div>
      </div>

      <div className="flex justify-end">
        <Button color="primary" isLoading={saving} onPress={createRecord}>
          Guardar registro
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2 rounded-medium border border-default-200 p-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={`worklog-loading-${index}`} className="h-7 w-full rounded-small" />
          ))}
        </div>
      ) : null}

      <div className="rounded-medium border border-default-200 overflow-x-auto">
        <Table aria-label="Dashboard operativo" removeWrapper>
          <TableHeader>
            <TableColumn>PEDIDO</TableColumn>
            <TableColumn>DISEÑO</TableColumn>
            <TableColumn>DETALLES</TableColumn>
            <TableColumn>TALLA</TableColumn>
            <TableColumn>CANTIDAD OP</TableColumn>
            <TableColumn>CANTIDAD PRODUCIDA</TableColumn>
            <TableColumn>HORA INICIO</TableColumn>
            <TableColumn>HORA FIN</TableColumn>
            <TableColumn>COMPLETO</TableColumn>
            <TableColumn>PARCIAL</TableColumn>
            <TableColumn>OBSERVACIONES</TableColumn>
            <TableColumn>REPO</TableColumn>
            <TableColumn>PROCESO</TableColumn>
            <TableColumn>OPERACIÓN</TableColumn>
            <TableColumn>ESTADO PROG.</TableColumn>
            <TableColumn>ACCIONES</TableColumn>
          </TableHeader>
          <TableBody emptyContent={loading ? "Cargando..." : "Sin registros"} items={data?.items ?? []}>
            {(item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.orderCode}</TableCell>
                    <TableCell>{item.designName}</TableCell>
                    <TableCell>{item.details ?? "-"}</TableCell>
                    <TableCell>{item.size ?? "-"}</TableCell>
                    <TableCell>{item.quantityOp}</TableCell>
                    <TableCell>{item.producedQuantity}</TableCell>
                    <TableCell>{asDateTimeInput(item.startAt) || "-"}</TableCell>
                    <TableCell>{asDateTimeInput(item.endAt) || "-"}</TableCell>
                    <TableCell>{item.isComplete ? "✓" : "-"}</TableCell>
                    <TableCell>{item.isPartial ? "✓" : "-"}</TableCell>
                    <TableCell>{item.observations ?? "-"}</TableCell>
                    <TableCell>{item.repoCheck ? "✓" : "-"}</TableCell>
                    <TableCell>{item.processCode}</TableCell>
                    <TableCell>{item.operationType ?? "-"}</TableCell>
                    <TableCell>
                      <span className="inline-flex rounded-full bg-default-100 px-2 py-0.5 text-xs font-medium">
                        {item.linkedOrderItemStatus ?? "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {item.isPartial ? (
                          <Button
                            color="primary"
                            isDisabled={saving || deletingId === item.id}
                            size="sm"
                            variant="flat"
                            onPress={() => createRepositionFromRow(item.id)}
                          >
                            Reposición
                          </Button>
                        ) : null}
                        <Button
                          color="danger"
                          isDisabled={deletingId === item.id || saving}
                          isLoading={deletingId === item.id}
                          size="sm"
                          variant="flat"
                          onPress={() => removeRecord(item.id)}
                        >
                          <BsTrash />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
          </TableBody>
        </Table>
      </div>

      {data ? <Pager data={data} page={data.page} onChange={setPage} /> : null}
    </div>
  );
}
