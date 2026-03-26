"use client";

import type { Paginated } from "@/app/erp/orders/_lib/types";

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
import { Pagination } from "@heroui/pagination";
import { Switch } from "@heroui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";

import { usePaginatedApi } from "@/app/erp/orders/_hooks/use-paginated-api";
import { apiJson, getErrorMessage } from "@/app/erp/orders/_lib/api";

type CommissionRateRow = {
  id: string;
  advisorName: string;
  rate: string | null;
  isActive: boolean | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type CommissionRatesData = Paginated<CommissionRateRow>;

function formatPercent(value: string | number | null | undefined) {
  const numeric = Number(value ?? 0);

  if (!Number.isFinite(numeric)) return "0.00%";

  return `${(numeric * 100).toFixed(2)}%`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function normalizeRateInput(value: string) {
  return value.replace(",", ".").trim();
}

export function CommissionRatesTab({ canEdit }: { canEdit: boolean }) {
  const [query, setQuery] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<CommissionRateRow | null>(null);
  const [advisorName, setAdvisorName] = useState("");
  const [rate, setRate] = useState("0.05");
  const [isActive, setIsActive] = useState(true);

  const endpoint = useMemo(() => {
    const params = new URLSearchParams();

    if (query.trim()) params.set("q", query.trim());
    if (!activeOnly) params.set("activeOnly", "0");

    const qs = params.toString();

    return `/api/contabilidad/comisiones${qs ? `?${qs}` : ""}`;
  }, [activeOnly, query]);

  const { data, loading, page, setPage, refresh } = usePaginatedApi<CommissionRateRow>(
    endpoint,
    10,
  );
  const commissionData = data as CommissionRatesData | null;

  useEffect(() => {
    setPage(1);
  }, [activeOnly, query, setPage]);

  const totalPages = Math.max(
    1,
    Math.ceil((commissionData?.total ?? 0) / (commissionData?.pageSize ?? 10)),
  );

  const resetDraft = () => {
    setEditingRow(null);
    setAdvisorName("");
    setRate("0.05");
    setIsActive(true);
  };

  const openCreate = () => {
    resetDraft();
    setIsModalOpen(true);
  };

  const openEdit = (row: CommissionRateRow) => {
    setEditingRow(row);
    setAdvisorName(row.advisorName ?? "");
    setRate(String(row.rate ?? "0.05"));
    setIsActive(row.isActive !== false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setIsModalOpen(false);
    resetDraft();
  };

  const saveDraft = async () => {
    const cleanAdvisorName = advisorName.trim();
    const normalizedRate = normalizeRateInput(rate);
    const numericRate = Number(normalizedRate);

    if (!cleanAdvisorName) {
      toast.error("El asesor es obligatorio");

      return;
    }

    if (!Number.isFinite(numericRate) || numericRate < 0 || numericRate > 1) {
      toast.error("La tasa debe estar entre 0 y 1. Ejemplo: 0.05 = 5%.");

      return;
    }

    try {
      setSaving(true);

      if (editingRow) {
        await apiJson(`/api/contabilidad/comisiones/${editingRow.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            advisorName: cleanAdvisorName,
            rate: numericRate,
            isActive,
          }),
        });
      } else {
        await apiJson("/api/contabilidad/comisiones", {
          method: "POST",
          body: JSON.stringify({
            advisorName: cleanAdvisorName,
            rate: numericRate,
            isActive,
          }),
        });
      }

      toast.success(
        editingRow ? "Comisión actualizada" : "Comisión registrada",
      );
      closeModal();
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const setRowActiveState = async (row: CommissionRateRow, nextState: boolean) => {
    try {
      setDeletingId(row.id);

      if (nextState) {
        await apiJson(`/api/contabilidad/comisiones/${row.id}`, {
          method: "PATCH",
          body: JSON.stringify({ isActive: true }),
        });
      } else {
        await apiJson(`/api/contabilidad/comisiones/${row.id}`, {
          method: "DELETE",
        });
      }

      toast.success(nextState ? "Comisión reactivada" : "Comisión desactivada");
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Comisiones por asesor</h2>
            <p className="text-sm text-default-500">
              Estas tasas alimentan el macro contable. Usa formato decimal: 0.05
              equivale a 5%.
            </p>
          </div>
          <Button color="primary" isDisabled={!canEdit} onPress={openCreate}>
            Nueva tasa
          </Button>
        </CardBody>
      </Card>

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <Input
          className="md:max-w-sm"
          label="Buscar asesor"
          placeholder="Nombre del asesor"
          value={query}
          onValueChange={setQuery}
        />
        <Switch isSelected={activeOnly} onValueChange={setActiveOnly}>
          Mostrar solo activas
        </Switch>
      </div>

      <Table aria-label="Tasas de comisión por asesor">
        <TableHeader>
          <TableColumn>ASESOR</TableColumn>
          <TableColumn>TASA</TableColumn>
          <TableColumn>ESTADO</TableColumn>
          <TableColumn>ACTUALIZADA</TableColumn>
          <TableColumn>ACCIONES</TableColumn>
        </TableHeader>
        <TableBody
          emptyContent={loading ? "Cargando comisiones..." : "No hay comisiones registradas."}
          items={commissionData?.items ?? []}
        >
          {(row) => (
            <TableRow key={row.id}>
              <TableCell>{row.advisorName}</TableCell>
              <TableCell>{formatPercent(row.rate)}</TableCell>
              <TableCell>{row.isActive === false ? "Inactiva" : "Activa"}</TableCell>
              <TableCell>{formatDateTime(row.updatedAt ?? row.createdAt)}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="flat"
                    isDisabled={!canEdit}
                    onPress={() => openEdit(row)}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    color={row.isActive === false ? "success" : "danger"}
                    variant="flat"
                    isDisabled={!canEdit || deletingId === row.id}
                    isLoading={deletingId === row.id}
                    onPress={() =>
                      setRowActiveState(row, row.isActive === false)
                    }
                  >
                    {row.isActive === false ? "Reactivar" : "Desactivar"}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {commissionData && commissionData.total > commissionData.pageSize ? (
        <div className="flex justify-end">
          <Pagination color="primary" page={page} total={totalPages} onChange={setPage} />
        </div>
      ) : null}

      <Modal isOpen={isModalOpen} onOpenChange={(open) => (open ? setIsModalOpen(true) : closeModal())}>
        <ModalContent>
          <ModalHeader>
            {editingRow ? "Editar comisión" : "Nueva comisión"}
          </ModalHeader>
          <ModalBody className="space-y-4">
            <Input
              isDisabled={saving}
              label="Asesor"
              placeholder="Nombre completo"
              value={advisorName}
              onValueChange={setAdvisorName}
            />
            <Input
              isDisabled={saving}
              label="Tasa decimal"
              placeholder="0.05"
              value={rate}
              onValueChange={setRate}
            />
            <Switch
              isDisabled={saving}
              isSelected={isActive}
              onValueChange={setIsActive}
            >
              Registro activo
            </Switch>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" isDisabled={saving} onPress={closeModal}>
              Cancelar
            </Button>
            <Button color="primary" isDisabled={saving} onPress={saveDraft}>
              Guardar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}