"use client";

import type { MoldingTemplateRow } from "../_lib/types";

import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
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
import { FiPlus, FiSearch } from "react-icons/fi";

import { apiJson, getErrorMessage } from "../_lib/api";

import { usePaginatedApi } from "@/app/erp/catalog/_hooks/use-paginated-api";
import { Pager } from "@/app/erp/catalog/_components/ui/pager";
import { TableSkeleton } from "@/app/erp/catalog/_components/ui/table-skeleton";

type Props = {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

type FormState = {
  moldingCode: string;
  garmentType: string;
  garmentSubtype: string;
  fabric: string;
  color: string;
  gender: string;
  process: string;
  estimatedLeadDays: string;
  designDetail: string;
  observations: string;
};

const emptyForm: FormState = {
  moldingCode: "",
  garmentType: "",
  garmentSubtype: "",
  fabric: "",
  color: "",
  gender: "",
  process: "",
  estimatedLeadDays: "",
  designDetail: "",
  observations: "",
};

export function MoldingTemplatesTab({ canCreate, canEdit, canDelete }: Props) {
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const endpoint = useMemo(
    () => `/api/molding/templates?search=${encodeURIComponent(search)}`,
    [search],
  );

  const { data, loading, page, setPage, refresh } =
    usePaginatedApi<MoldingTemplateRow>(endpoint, 20);

  function openCreate() {
    setForm(emptyForm);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
  }

  function setField(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (!form.moldingCode.trim()) {
      toast.error("Molding code is required");

      return;
    }

    setSaving(true);
    try {
      await apiJson("/api/molding/templates", {
        method: "POST",
        body: JSON.stringify({
          moldingCode: form.moldingCode,
          garmentType: form.garmentType || undefined,
          garmentSubtype: form.garmentSubtype || undefined,
          fabric: form.fabric || undefined,
          color: form.color || undefined,
          gender: form.gender || undefined,
          process: form.process || undefined,
          estimatedLeadDays: form.estimatedLeadDays
            ? Number(form.estimatedLeadDays)
            : undefined,
          designDetail: form.designDetail || undefined,
          observations: form.observations || undefined,
        }),
      });
      toast.success("Molding template created");
      closeModal();
      refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiJson(`/api/molding/templates/${id}`, { method: "DELETE" });
      toast.success("Molding template deactivated");
      setDeleteId(null);
      refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  const headers = [
    "Code",
    "Version",
    "Garment type",
    "Fabric",
    "Color",
    "Process",
    "Lead days",
    "Status",
    "Actions",
  ];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          className="max-w-xs"
          placeholder="Search by code..."
          startContent={<FiSearch className="text-default-400" />}
          value={search}
          onValueChange={setSearch}
        />
        {canCreate && (
          <Button
            color="primary"
            startContent={<FiPlus />}
            onPress={openCreate}
          >
            New template
          </Button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <TableSkeleton
          ariaLabel="Loading molding templates"
          headers={headers}
        />
      ) : (
        <>
          <Table removeWrapper aria-label="Molding templates">
            <TableHeader>
              {headers.map((h) => (
                <TableColumn key={h}>{h}</TableColumn>
              ))}
            </TableHeader>
            <TableBody emptyContent="No molding templates found">
              {(data?.items ?? []).map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-sm">
                    {row.moldingCode}
                  </TableCell>
                  <TableCell>v{row.version}</TableCell>
                  <TableCell>{row.garmentType ?? "—"}</TableCell>
                  <TableCell>{row.fabric ?? "—"}</TableCell>
                  <TableCell>{row.color ?? "—"}</TableCell>
                  <TableCell>{row.process ?? "—"}</TableCell>
                  <TableCell>{row.estimatedLeadDays ?? "—"}</TableCell>
                  <TableCell>
                    <Chip
                      color={row.isActive ? "success" : "default"}
                      size="sm"
                      variant="flat"
                    >
                      {row.isActive ? "Active" : "Inactive"}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {canDelete && row.isActive && (
                        <Button
                          color="danger"
                          size="sm"
                          variant="light"
                          onPress={() => setDeleteId(row.id)}
                        >
                          Deactivate
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {data && data.total > data.pageSize && (
            <Pager data={data} page={page} onChange={setPage} />
          )}
        </>
      )}

      {/* Create Modal */}
      <Modal isOpen={modalOpen} size="2xl" onClose={closeModal}>
        <ModalContent>
          <ModalHeader>New molding template</ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                isRequired
                label="Molding code"
                placeholder="e.g. MOL-001"
                value={form.moldingCode}
                onValueChange={(v) => setField("moldingCode", v)}
              />
              <Input
                label="Garment type"
                placeholder="e.g. T-SHIRT"
                value={form.garmentType}
                onValueChange={(v) => setField("garmentType", v)}
              />
              <Input
                label="Garment subtype"
                placeholder="e.g. POLO"
                value={form.garmentSubtype}
                onValueChange={(v) => setField("garmentSubtype", v)}
              />
              <Input
                label="Fabric"
                placeholder="e.g. LYCRA 90/10"
                value={form.fabric}
                onValueChange={(v) => setField("fabric", v)}
              />
              <Input
                label="Color"
                placeholder="e.g. WHITE"
                value={form.color}
                onValueChange={(v) => setField("color", v)}
              />
              <Input
                label="Gender"
                placeholder="e.g. UNISEX"
                value={form.gender}
                onValueChange={(v) => setField("gender", v)}
              />
              <Input
                label="Process"
                placeholder="e.g. CORTE-CONFECCION"
                value={form.process}
                onValueChange={(v) => setField("process", v)}
              />
              <Input
                label="Estimated lead days"
                placeholder="e.g. 7"
                type="number"
                value={form.estimatedLeadDays}
                onValueChange={(v) => setField("estimatedLeadDays", v)}
              />
              <Input
                className="col-span-full"
                label="Design detail"
                placeholder="Design notes..."
                value={form.designDetail}
                onValueChange={(v) => setField("designDetail", v)}
              />
              <Input
                className="col-span-full"
                label="Observations"
                placeholder="Additional notes..."
                value={form.observations}
                onValueChange={(v) => setField("observations", v)}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={closeModal}>
              Cancel
            </Button>
            <Button color="primary" isLoading={saving} onPress={handleSave}>
              Create template
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete confirmation */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)}>
        <ModalContent>
          <ModalHeader>Deactivate template</ModalHeader>
          <ModalBody>
            <p>Are you sure you want to deactivate this molding template?</p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              color="danger"
              onPress={() => deleteId && handleDelete(deleteId)}
            >
              Deactivate
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
