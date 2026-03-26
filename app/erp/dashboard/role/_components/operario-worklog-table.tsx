"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Checkbox } from "@heroui/checkbox";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Skeleton } from "@heroui/skeleton";
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
import { BsTrash } from "react-icons/bs";

import { apiJson, getErrorMessage } from "@/app/erp/orders/_lib/api";
import { Pager } from "@/app/erp/catalog/_components/ui/pager";
import { useSessionStore } from "@/store/session";

type RoleArea = "OPERARIOS" | "CONFECCIONISTAS" | "MENSAJERIA" | "EMPAQUE";
type OperationType =
  | "MONTAJE"
  | "PLOTTER"
  | "SUBLIMACION"
  | "CALANDRA"
  | "CORTE_LASER"
  | "CORTE_MANUAL"
  | "CONFECCION"
  | "EMPAQUE"
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
  { value: "MONTAJE", label: "Montaje" },
  { value: "PLOTTER", label: "Plotter" },
  { value: "SUBLIMACION", label: "Sublimación" },
  { value: "CALANDRA", label: "Calandra" },
  { value: "CORTE_LASER", label: "Corte láser" },
  { value: "CORTE_MANUAL", label: "Corte manual" },
  { value: "CONFECCION", label: "Confección" },
  { value: "EMPAQUE", label: "Empaque" },
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
  authorizeManualCut: boolean;
  observations: string;
  repoCheck: boolean;
  processCode: ProcessCode;
};

const initialDraft: DraftRow = {
  roleArea: "OPERARIOS",
  operationType: "MONTAJE",
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
  authorizeManualCut: false,
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

  if (/^\d{2}:\d{2}$/.test(raw)) {
    const now = new Date();
    const [hours, minutes] = raw.split(":").map(Number);

    if (
      Number.isNaN(hours) ||
      Number.isNaN(minutes) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59
    ) {
      return null;
    }

    now.setHours(hours, minutes, 0, 0);

    return now.toISOString();
  }

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

function normalizeOperationByRole(role: string): OperationType {
  if (role === "OPERARIO_MONTAJE") return "MONTAJE";
  if (role === "OPERARIO_FLOTER") return "PLOTTER";
  if (role === "OPERARIO_SUBLIMACION") return "SUBLIMACION";
  if (role === "OPERARIO_CORTE_LASER") return "CORTE_LASER";
  if (role === "OPERARIO_CORTE_MANUAL") return "CORTE_MANUAL";
  if (role === "CONFECCIONISTA") return "CONFECCION";
  if (role === "EMPAQUE") return "EMPAQUE";
  if (role === "OPERARIO_INTEGRACION_CALIDAD") return "INTEGRACION";
  if (role === "OPERARIO_DESPACHO") return "DESPACHO";

  return "MONTAJE";
}

type WorklogPrefill = {
  orderCode: string;
  designName: string;
  size?: string;
  quantityOp?: number;
  tallas?: Array<{
    talla: string;
    cantidad: number;
  }>;
};

export function OperarioWorklogTable({
  role,
  prefill,
  onSaved,
}: {
  role: string;
  prefill?: WorklogPrefill | null;
  onSaved?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showPartialModal, setShowPartialModal] = useState(false);
  const [repoReason, setRepoReason] = useState("");
  const [repoNotes, setRepoNotes] = useState("");
  const [data, setData] = useState<Paginated<WorklogItem> | null>(null);
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<DraftRow>(() => ({
    ...initialDraft,
    roleArea: normalizeRoleAreaByRole(role),
  }));

  const roleAreaFilter = useMemo(() => normalizeRoleAreaByRole(role), [role]);
  const operationFilter = useMemo(() => normalizeOperationByRole(role), [role]);
  const isAssemblyMode = useMemo(
    () => operationFilter === "MONTAJE",
    [operationFilter],
  );
  const isOperationFixed = useMemo(() => role.startsWith("OPERARIO_"), [role]);
  const isPrefilledMode = Boolean(prefill);
  const sessionUser = useSessionStore((state) => state.user);
  const reporterId = String(sessionUser?.id ?? "SIN_USUARIO");
  const tallaOptions = useMemo(
    () =>
      (prefill?.tallas ?? []).filter(
        (item) =>
          String(item.talla ?? "").trim().length > 0 &&
          Number.isFinite(Number(item.cantidad)),
      ),
    [prefill],
  );

  useEffect(() => {
    setDraft((prev) => ({
      ...prev,
      roleArea: roleAreaFilter,
      operationType: operationFilter,
    }));
  }, [roleAreaFilter, operationFilter]);

  useEffect(() => {
    if (!prefill) return;

    const firstTalla = tallaOptions[0];
    const initialSize = isAssemblyMode
      ? ""
      : String(prefill.size ?? "").trim() ||
        String(firstTalla?.talla ?? "").trim();
    const qtyFromTallas = tallaOptions.reduce(
      (sum, item) => sum + Math.max(0, Math.floor(Number(item.cantidad) || 0)),
      0,
    );
    const initialQty = isAssemblyMode
      ? qtyFromTallas
      : firstTalla && String(firstTalla.talla).trim() === initialSize
        ? Math.max(0, Math.floor(Number(firstTalla.cantidad) || 0))
        : null;

    setDraft((prev) => ({
      ...prev,
      roleArea: roleAreaFilter,
      operationType: operationFilter,
      orderCode: prefill.orderCode ?? "",
      designName: prefill.designName ?? "",
      size: initialSize,
      quantityOp:
        typeof initialQty === "number"
          ? String(initialQty)
          : typeof prefill.quantityOp === "number" &&
              Number.isFinite(prefill.quantityOp)
            ? String(Math.max(0, Math.floor(prefill.quantityOp)))
            : prev.quantityOp,
    }));
  }, [
    prefill,
    roleAreaFilter,
    operationFilter,
    tallaOptions,
    isAssemblyMode,
  ]);

  useEffect(() => {
    if (isAssemblyMode) return;
    if (tallaOptions.length === 0) return;

    const selected = tallaOptions.find(
      (item) => String(item.talla).trim() === String(draft.size).trim(),
    );

    if (!selected) return;

    const qty = String(Math.max(0, Math.floor(Number(selected.cantidad) || 0)));

    if (qty === draft.quantityOp) return;

    setDraft((prev) => ({ ...prev, quantityOp: qty }));
  }, [draft.size, draft.quantityOp, tallaOptions, isAssemblyMode]);

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
        setData({
          items: [],
          page: 1,
          pageSize: 10,
          total: 0,
          hasNextPage: false,
        });
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

    if (draft.isPartial && !repoReason.trim()) {
      toast.error("Debes indicar el motivo de la reposición interna");
      setShowPartialModal(true);

      return;
    }

    const partialRepoObservations = draft.isPartial
      ? [
          "[REPOSICION_INTERNA]",
          `Motivo: ${repoReason.trim() || "N/A"}`,
          `Reporta: ${reporterId}`,
          `Observaciones repo: ${repoNotes.trim() || "N/A"}`,
          draft.observations.trim()
            ? `Observaciones operativas: ${draft.observations.trim()}`
            : null,
        ]
          .filter(Boolean)
          .join(" | ")
      : draft.observations || null;

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
          size: isAssemblyMode ? null : draft.size || null,
          quantityOp: Number(draft.quantityOp || 0),
          producedQuantity: Number(draft.producedQuantity || 0),
          startAt: isAssemblyMode ? null : asDateTimeIso(draft.startAt),
          endAt: isAssemblyMode ? null : asDateTimeIso(draft.endAt),
          isComplete: draft.isComplete,
          isPartial: draft.isPartial,
          authorizeManualCut: isAssemblyMode ? draft.authorizeManualCut : false,
          observations: partialRepoObservations,
          repoCheck: draft.isPartial ? true : draft.repoCheck,
          processCode: draft.processCode,
        }),
      });

      toast.success("Registro operativo creado");
      setDraft({
        ...initialDraft,
        roleArea: roleAreaFilter,
        operationType: operationFilter,
      });
      setRepoReason("");
      setRepoNotes("");
      onSaved?.();
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
        {isAssemblyMode
          ? "En Montaje registra producción por cantidad total. La hora de inicio se toma al tomar pedido y la hora de fin al marcar completo. Si autorizas corte manual, marca la casilla correspondiente antes de guardar completo."
          : "Registra producción por rol y operación: pedido, diseño, talla y cantidades; si marcas parcial + repo o creas reposición desde una fila parcial, se vincula con Programación por pedido/diseño/talla."}
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <Input
          isReadOnly={isPrefilledMode}
          label="Pedido"
          size="sm"
          value={draft.orderCode}
          onValueChange={(value) =>
            setDraft((s) => ({ ...s, orderCode: value }))
          }
        />
        <Input
          isReadOnly={isPrefilledMode}
          label="Diseño"
          size="sm"
          value={draft.designName}
          onValueChange={(value) =>
            setDraft((s) => ({ ...s, designName: value }))
          }
        />
        <Input
          label="Detalles"
          size="sm"
          value={draft.details}
          onValueChange={(value) => setDraft((s) => ({ ...s, details: value }))}
        />
        {!isAssemblyMode
          ? tallaOptions.length > 0
            ? (
                <Select
                  disallowEmptySelection
                  label="Talla"
                  selectedKeys={[
                    draft.size || String(tallaOptions[0]?.talla ?? ""),
                  ]}
                  size="sm"
                  onSelectionChange={(keys) => {
                    const first = String(Array.from(keys)[0] ?? "").trim();

                    setDraft((s) => ({ ...s, size: first }));
                  }}
                >
                  {tallaOptions.map((option) => (
                    <SelectItem key={option.talla}>
                      {`${option.talla} (${Math.max(0, Math.floor(Number(option.cantidad) || 0))} uds)`}
                    </SelectItem>
                  ))}
                </Select>
              )
            : (
                <Input
                  label="Talla"
                  size="sm"
                  value={draft.size}
                  onValueChange={(value) =>
                    setDraft((s) => ({ ...s, size: value }))
                  }
                />
              )
          : null}
        <Input
          isReadOnly={isPrefilledMode}
          label="Cantidad OP"
          size="sm"
          type="number"
          value={draft.quantityOp}
          onValueChange={(value) =>
            setDraft((s) => ({ ...s, quantityOp: value }))
          }
        />
        <Input
          label="Cantidad producida"
          size="sm"
          type="number"
          value={draft.producedQuantity}
          onValueChange={(value) =>
            setDraft((s) => ({ ...s, producedQuantity: value }))
          }
        />
        {!isAssemblyMode ? (
          <Input
            label="Hora inicio"
            size="sm"
            type="datetime-local"
            value={draft.startAt}
            onValueChange={(value) =>
              setDraft((s) => ({ ...s, startAt: value }))
            }
          />
        ) : null}
        {!isAssemblyMode ? (
          <Input
            label="Hora fin"
            size="sm"
            type="datetime-local"
            value={draft.endAt}
            onValueChange={(value) => setDraft((s) => ({ ...s, endAt: value }))}
          />
        ) : null}
        <Input
          label="Observaciones"
          size="sm"
          value={draft.observations}
          onValueChange={(value) =>
            setDraft((s) => ({ ...s, observations: value }))
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
        <Select
          disallowEmptySelection
          label="Proceso"
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
          disallowEmptySelection
          isDisabled={isOperationFixed}
          label="Operación"
          selectedKeys={[draft.operationType]}
          size="sm"
          onSelectionChange={(keys) => {
            const first = Array.from(keys)[0] as OperationType | undefined;

            setDraft((s) => ({
              ...s,
              operationType: first ?? operationFilter,
            }));
          }}
        >
          {operationOptions.map((option) => (
            <SelectItem key={option.value}>{option.label}</SelectItem>
          ))}
        </Select>

        <div className="flex items-center gap-3">
          <Checkbox
            isSelected={draft.isComplete}
            onValueChange={(value) =>
              setDraft((s) => ({
                ...s,
                isComplete: value,
                isPartial: value ? false : s.isPartial,
              }))
            }
          >
            Completo
          </Checkbox>
        </div>

        <div className="flex items-center gap-3">
          <Checkbox
            isSelected={draft.isPartial}
            onValueChange={(value) => {
              if (value) {
                setDraft((s) => ({
                  ...s,
                  isPartial: true,
                  isComplete: false,
                  repoCheck: true,
                }));
                setShowPartialModal(true);

                return;
              }

              setDraft((s) => ({ ...s, isPartial: false, repoCheck: false }));
              setRepoReason("");
              setRepoNotes("");
            }}
          >
            Parcial
          </Checkbox>
        </div>

        {isAssemblyMode ? (
          <div className="flex items-center gap-3">
            <Checkbox
              isSelected={draft.authorizeManualCut}
              onValueChange={(value) =>
                setDraft((s) => ({ ...s, authorizeManualCut: value }))
              }
            >
              Autorizar pase directo a corte manual
            </Checkbox>
          </div>
        ) : null}
      </div>

      <div className="flex justify-end">
        <Button color="primary" isDisabled={saving} onPress={createRecord}>
          {saving ? "Guardando..." : "Guardar registro"}
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2 rounded-medium border border-default-200 p-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton
              key={`worklog-loading-${index}`}
              className="h-7 w-full rounded-small"
            />
          ))}
        </div>
      ) : null}

      <div className="rounded-medium border border-default-200 overflow-x-auto">
        <Table removeWrapper aria-label="Dashboard operativo">
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
            <TableColumn>PROCESO</TableColumn>
            <TableColumn>OPERACIÓN</TableColumn>
            <TableColumn>ESTADO PROG.</TableColumn>
            <TableColumn>ACCIONES</TableColumn>
          </TableHeader>
          <TableBody
            emptyContent={loading ? "Cargando..." : "Sin registros"}
            items={data?.items ?? []}
          >
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

      <Modal
        disableAnimation
        isOpen={showPartialModal}
        onOpenChange={setShowPartialModal}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Reposición interna por parcial</ModalHeader>
              <ModalBody>
                <p className="text-sm text-default-500">
                  Al marcar parcial se generará reposición interna y se enviará
                  a Programación (actualización).
                </p>
                <Input
                  isRequired
                  label="Motivo"
                  value={repoReason}
                  onValueChange={setRepoReason}
                />
                <div className="rounded-medium border border-default-200 bg-default-50 px-3 py-2">
                  <p className="text-xs text-default-500">Quién reporta</p>
                  <p className="text-sm font-semibold">{reporterId}</p>
                </div>
                <Input
                  label="Observaciones reposición"
                  value={repoNotes}
                  onValueChange={setRepoNotes}
                />
              </ModalBody>
              <ModalFooter>
                <Button
                  variant="flat"
                  onPress={() => {
                    setDraft((s) => ({
                      ...s,
                      isPartial: false,
                      repoCheck: false,
                    }));
                    setRepoReason("");
                    setRepoNotes("");
                    onClose();
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  color="primary"
                  onPress={() => {
                    if (!repoReason.trim()) {
                      toast.error("Debes indicar el motivo");

                      return;
                    }

                    setDraft((s) => ({
                      ...s,
                      isPartial: true,
                      isComplete: false,
                      repoCheck: true,
                    }));
                    onClose();
                  }}
                >
                  Confirmar parcial + reposición
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
