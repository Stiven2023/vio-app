"use client";

import type { Paginated } from "@/app/erp/catalog/_lib/types";

import { useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
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
  BsPencilSquare,
  BsThreeDotsVertical,
  BsTrash,
  BsEyeFill,
  BsShieldCheck,
} from "react-icons/bs";

import { SupplierModal } from "./supplier-modal";
import { SupplierDetailsModal } from "./supplier-details-modal";

import { FilterSelect } from "@/app/erp/catalog/_components/ui/filter-select";
import { Pager } from "@/app/erp/catalog/_components/ui/pager";
import { TableSkeleton } from "@/app/erp/catalog/_components/ui/table-skeleton";
import { usePaginatedApi } from "@/app/erp/catalog/_hooks/use-paginated-api";
import { apiJson, getErrorMessage } from "@/app/erp/catalog/_lib/api";
import { ConfirmActionModal } from "@/components/confirm-action-modal";
import { ThirdPartyDocumentsModal } from "@/components/third-party-documents-modal";
import { SupplierLegalStatusModal } from "@/app/erp/admin/_components/suppliers/supplier-legal-status-modal";

export type Supplier = {
  id: string;
  supplierCode: string;
  name: string;
  identificationType: string;
  identification: string;
  dv: string | null;
  branch: string;
  taxRegime: string;
  contactName: string;
  email: string;
  address: string;
  postalCode: string | null;
  country: string;
  department: string;
  city: string;
  intlDialCode: string;
  mobile: string | null;
  fullMobile: string | null;
  localDialCode: string | null;
  landline: string | null;
  extension: string | null;
  fullLandline: string | null;
  isActive: boolean | null;
  hasCredit: boolean | null;
  promissoryNoteNumber: string | null;
  promissoryNoteDate: string | null;
  legalStatus?: "VIGENTE" | "EN_REVISION" | "BLOQUEADO" | null;
  identityDocumentUrl: string | null;
  rutDocumentUrl: string | null;
  commerceChamberDocumentUrl: string | null;
  passportDocumentUrl: string | null;
  taxCertificateDocumentUrl: string | null;
  companyIdDocumentUrl: string | null;
  bankCertificateUrl: string | null;
  createdAt: string;
};

type StatusFilter = "all" | "active" | "inactive";

export function SuppliersTab({
  canCreate,
  canEdit,
  canDelete,
  canChangeLegalStatus = true,
  legalOnlyMode = false,
}: {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canChangeLegalStatus?: boolean;
  legalOnlyMode?: boolean;
}) {
  const { data, loading, page, setPage, refresh } = usePaginatedApi<Supplier>(
    "/api/suppliers",
    10,
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [viewing, setViewing] = useState<Supplier | null>(null);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [viewingDocuments, setViewingDocuments] = useState<Supplier | null>(
    null,
  );
  const [legalStatusModalOpen, setLegalStatusModalOpen] = useState(false);
  const [viewingLegalStatus, setViewingLegalStatus] = useState<Supplier | null>(
    null,
  );

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Supplier | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    const items = data?.items ?? [];
    const q = search.trim().toLowerCase();

    return items.filter((s) => {
      if (status === "active" && !s.isActive) return false;
      if (status === "inactive" && s.isActive) return false;
      if (!q) return true;

      const email = s.email ?? "";
      const contactName = s.contactName ?? "";

      return (
        s.name.toLowerCase().includes(q) ||
        s.supplierCode.toLowerCase().includes(q) ||
        email.toLowerCase().includes(q) ||
        contactName.toLowerCase().includes(q)
      );
    });
  }, [data, search, status]);

  const emptyContent = useMemo(() => {
    if (loading) return "";
    if (search.trim() !== "" || status !== "all") return "No results";

    return "No suppliers";
  }, [loading, search, status]);

  const exportCsv = () => {
    const anchor = document.createElement("a");
    anchor.href = "/api/suppliers/export";
    anchor.download = "suppliers-export.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const downloadTemplate = () => {
    const anchor = document.createElement("a");
    anchor.href = "/api/suppliers/import/template";
    anchor.download = "suppliers-import-template.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const importCsv = async (file: File) => {
    if (importing) return;
    const isCsv =
      file.type === "text/csv" ||
      file.name.toLowerCase().endsWith(".csv") ||
      file.type === "application/vnd.ms-excel";
    if (!isCsv) {
      toast.error("Selecciona un archivo CSV válido");
      return;
    }
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/suppliers/import", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          payload?.message || (typeof payload === "string" ? payload : "No se pudo importar el CSV"),
        );
      }
      const createdCount = Number(payload?.createdCount ?? 0);
      const updatedCount = Number(payload?.updatedCount ?? 0);
      const failedCount = Number(payload?.failedCount ?? 0);
      const firstError = Array.isArray(payload?.errors)
        ? String(payload.errors[0]?.message ?? "")
        : "";
      if (createdCount === 0 && updatedCount === 0 && failedCount > 0) {
        toast.error(`No se importó ningún registro. ${firstError || "Revisa el archivo CSV."}`);
        return;
      }
      if (failedCount > 0) {
        toast.success(`Importación parcial: ${createdCount} creados, ${updatedCount} editados, ${failedCount} con error`);
      } else {
        toast.success(`Importación exitosa: ${createdCount} creados, ${updatedCount} editados`);
      }
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const remove = async () => {
    const s = pendingDelete;

    if (!s) return;
    if (deletingId) return;

    setDeletingId(s.id);
    try {
      await apiJson(`/api/suppliers`, {
        method: "DELETE",
        body: JSON.stringify({ id: s.id }),
      });
      toast.success("Supplier deleted");
      setConfirmOpen(false);
      setPendingDelete(null);
      refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  const createAsClient = async (supplier: Supplier) => {
    if (!supplier.email) {
      toast.error("To create as client, the supplier must have an email.");

      return;
    }

    try {
      await apiJson("/api/clients", {
        method: "POST",
        body: JSON.stringify({
          clientType: "NACIONAL",
          name: supplier.name,
          identificationType: supplier.identificationType,
          identification: supplier.identification,
          dv: supplier.dv ?? "",
          branch: supplier.branch,
          taxRegime: supplier.taxRegime,
          contactName: supplier.contactName,
          email: supplier.email,
          address: supplier.address,
          postalCode: supplier.postalCode ?? "",
          country: supplier.country,
          department: supplier.department,
          city: supplier.city,
          intlDialCode: supplier.intlDialCode,
          mobile: supplier.mobile ?? "",
          localDialCode: supplier.localDialCode ?? "",
          landline: supplier.landline ?? "",
          extension: supplier.extension ?? "",
          status: "ACTIVO",
          isActive: Boolean(supplier.isActive ?? true),
          hasCredit: Boolean(supplier.hasCredit ?? false),
          promissoryNoteNumber: supplier.promissoryNoteNumber ?? "",
          promissoryNoteDate: supplier.promissoryNoteDate ?? "",
        }),
      });

      toast.success("Client created from supplier");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const createAsEmployee = async (supplier: Supplier) => {
    if (!supplier.email) {
      toast.error("To create as employee, the supplier must have an email.");

      return;
    }

    try {
      await apiJson("/api/employees", {
        method: "POST",
        body: JSON.stringify({
          name: supplier.name,
          identificationType: supplier.identificationType,
          identification: supplier.identification,
          dv: supplier.dv ?? "",
          email: supplier.email,
          intlDialCode: supplier.intlDialCode,
          mobile: supplier.mobile ?? "",
          landline: supplier.landline ?? "",
          extension: supplier.extension ?? "",
          address: supplier.address,
          city: supplier.city,
          department: supplier.department,
          isActive: Boolean(supplier.isActive ?? true),
        }),
      });

      toast.success("Employee created from supplier");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const createAsConfectionist = async (supplier: Supplier) => {
    try {
      await apiJson("/api/confectionists", {
        method: "POST",
        body: JSON.stringify({
          name: supplier.name,
          identificationType: supplier.identificationType,
          identification: supplier.identification,
          dv: supplier.dv ?? "",
          type: "NACIONAL",
          taxRegime: supplier.taxRegime,
          contactName: supplier.contactName,
          email: supplier.email ?? "",
          intlDialCode: supplier.intlDialCode,
          mobile: supplier.mobile ?? "",
          fullMobile: supplier.fullMobile ?? "",
          landline: supplier.landline ?? "",
          extension: supplier.extension ?? "",
          address: supplier.address,
          postalCode: supplier.postalCode ?? "",
          country: supplier.country,
          department: supplier.department,
          city: supplier.city,
          isActive: Boolean(supplier.isActive ?? true),
        }),
      });

      toast.success("Confectionist created from supplier");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const createAsPacker = async (supplier: Supplier) => {
    try {
      await apiJson("/api/packers", {
        method: "POST",
        body: JSON.stringify({
          name: supplier.name,
          identificationType: supplier.identificationType,
          identification: supplier.identification,
          dv: supplier.dv ?? "",
          packerType: "EXTERNO",
          specialty: "",
          dailyCapacity: null,
          contactName: supplier.contactName,
          email: supplier.email ?? "",
          intlDialCode: supplier.intlDialCode,
          mobile: supplier.mobile ?? "",
          fullMobile: supplier.fullMobile ?? "",
          landline: supplier.landline ?? "",
          address: supplier.address,
          postalCode: supplier.postalCode ?? "",
          city: supplier.city,
          department: supplier.department,
          isActive: Boolean(supplier.isActive ?? true),
        }),
      });

      toast.success("Packer created from supplier");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Input
            isClearable
            className="sm:w-72"
            placeholder="Search by code, name, email or contact…"
            value={search}
            onClear={() => setSearch("")}
            onValueChange={setSearch}
          />
          <FilterSelect
            className="sm:w-56"
            label="Status"
            options={[
              { value: "all", label: "All" },
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
            value={status}
            onChange={(v) => setStatus(v as StatusFilter)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            accept=".csv"
            className="hidden"
            type="file"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv(f); }}
          />
          <Button variant="flat" onPress={exportCsv}>
            Exportar CSV
          </Button>
          <Button variant="flat" onPress={downloadTemplate}>
            Descargar plantilla CSV
          </Button>
          <Button color="secondary" isDisabled={importing} onPress={() => fileInputRef.current?.click()}>
            {importing ? "Importando..." : "Importar CSV"}
          </Button>
          {canCreate ? (
            <Button
              color="primary"
              onPress={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              Create supplier
            </Button>
          ) : null}
          <Button variant="flat" onPress={refresh}>
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <TableSkeleton
          ariaLabel="Suppliers"
          headers={[
            "Code",
            "Name",
            "ID Type",
            "Email",
            "Contact",
            "Mobile",
            "City",
            "Active",
            "Legal status",
            "Actions",
          ]}
        />
      ) : (
        <Table aria-label="Suppliers">
          <TableHeader>
            <TableColumn>Code</TableColumn>
            <TableColumn>Name</TableColumn>
            <TableColumn>ID Type</TableColumn>
            <TableColumn>Email</TableColumn>
            <TableColumn>Contact</TableColumn>
            <TableColumn>Mobile</TableColumn>
            <TableColumn>City</TableColumn>
            <TableColumn>Active</TableColumn>
            <TableColumn>Legal status</TableColumn>
            <TableColumn>Actions</TableColumn>
          </TableHeader>
          <TableBody emptyContent={emptyContent} items={filtered}>
            {(s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.supplierCode}</TableCell>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="text-default-500">
                  {s.identificationType}
                </TableCell>
                <TableCell className="text-default-500">
                  {s.email ?? "-"}
                </TableCell>
                <TableCell className="text-default-500">
                  {s.contactName ?? "-"}
                </TableCell>
                <TableCell className="text-default-500">
                  {s.mobile ?? "-"}
                </TableCell>
                <TableCell className="text-default-500">
                  {s.city ?? "-"}
                </TableCell>
                <TableCell>{s.isActive ? "Yes" : "No"}</TableCell>
                <TableCell>
                  {s.legalStatus ? (
                    <Chip
                      color={
                        s.legalStatus === "VIGENTE"
                          ? "success"
                          : s.legalStatus === "EN_REVISION"
                            ? "warning"
                            : "danger"
                      }
                      size="sm"
                      variant="flat"
                    >
                      {s.legalStatus === "VIGENTE"
                        ? "Active"
                        : s.legalStatus === "EN_REVISION"
                          ? "Under Review"
                          : "Blocked"}
                    </Chip>
                  ) : (
                    <Chip color="default" size="sm" variant="flat">
                      Undefined
                    </Chip>
                  )}
                </TableCell>
                <TableCell>
                  <Dropdown>
                    <DropdownTrigger>
                      <Button
                        isDisabled={Boolean(deletingId)}
                        size="sm"
                        variant="flat"
                      >
                        <BsThreeDotsVertical />
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu aria-label="Actions">
                      <DropdownItem
                        key="view"
                        startContent={<BsEyeFill />}
                        onPress={() => {
                          setViewing(s);
                          setDetailsOpen(true);
                        }}
                      >
                        View full info
                      </DropdownItem>
                      {canChangeLegalStatus ? (
                        <DropdownItem
                          key={`legal-status-${s.id}`}
                          startContent={<BsShieldCheck />}
                          onPress={() => {
                            setViewingLegalStatus(s);
                            setLegalStatusModalOpen(true);
                          }}
                        >
                          View legal status
                        </DropdownItem>
                      ) : null}
                      <DropdownItem
                        key="view-docs"
                        startContent={<BsEyeFill />}
                        onPress={() => {
                          setViewingDocuments(s);
                          setDocumentsOpen(true);
                        }}
                      >
                        View documents
                      </DropdownItem>
                      {canEdit ? (
                        <DropdownItem
                          key="edit"
                          startContent={<BsPencilSquare />}
                          onPress={() => {
                            setEditing(s);
                            setModalOpen(true);
                          }}
                        >
                          Edit
                        </DropdownItem>
                      ) : null}

                      {canDelete ? (
                        <DropdownItem
                          key="delete"
                          className="text-danger"
                          startContent={<BsTrash />}
                          onPress={() => {
                            setPendingDelete(s);
                            setConfirmOpen(true);
                          }}
                        >
                          Delete
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

      {data ? (
        <Pager
          data={data as Paginated<Supplier>}
          page={page}
          onChange={setPage}
        />
      ) : null}

      <SupplierModal
        isOpen={modalOpen}
        supplier={editing}
        onOpenChange={setModalOpen}
        onSaved={refresh}
      />

      <SupplierDetailsModal
        isOpen={detailsOpen}
        supplier={viewing}
        onOpenChange={(open) => {
          setDetailsOpen(open);
          if (!open) setViewing(null);
        }}
        onRequestCreateClient={
          legalOnlyMode ? undefined : () => viewing && createAsClient(viewing)
        }
        onRequestCreateConfectionist={
          legalOnlyMode
            ? undefined
            : () => viewing && createAsConfectionist(viewing)
        }
        onRequestCreateEmployee={
          legalOnlyMode ? undefined : () => viewing && createAsEmployee(viewing)
        }
        onRequestCreatePacker={
          legalOnlyMode ? undefined : () => viewing && createAsPacker(viewing)
        }
      />

      <SupplierLegalStatusModal
        isOpen={legalStatusModalOpen}
        supplier={viewingLegalStatus}
        onOpenChange={setLegalStatusModalOpen}
      />

      <ThirdPartyDocumentsModal
        documents={
          viewingDocuments
            ? [
                {
                  label: "Identity document",
                  url: viewingDocuments.identityDocumentUrl,
                },
                { label: "RUT", url: viewingDocuments.rutDocumentUrl },
                {
                  label: "Chamber of commerce",
                  url: viewingDocuments.commerceChamberDocumentUrl,
                },
                {
                  label: "Passport",
                  url: viewingDocuments.passportDocumentUrl,
                },
                {
                  label: "Tax certificate",
                  url: viewingDocuments.taxCertificateDocumentUrl,
                },
                {
                  label: "Company document",
                  url: viewingDocuments.companyIdDocumentUrl,
                },
                {
                  label: "Bank certificate",
                  url: viewingDocuments.bankCertificateUrl,
                },
              ]
            : []
        }
        emptyMessage="This supplier has no uploaded documents."
        isOpen={documentsOpen}
        subtitle={
          viewingDocuments
            ? `${viewingDocuments.identificationType} - ${viewingDocuments.identification}`
            : undefined
        }
        title={`Documents of ${viewingDocuments?.name ?? ""}`}
        onOpenChange={(open) => {
          setDocumentsOpen(open);
          if (!open) setViewingDocuments(null);
        }}
      />

      <ConfirmActionModal
        cancelLabel="Cancel"
        confirmLabel="Delete"
        description={
          pendingDelete ? `Delete supplier ${pendingDelete.name}?` : undefined
        }
        isLoading={deletingId === pendingDelete?.id}
        isOpen={confirmOpen}
        title="Confirm deletion"
        onConfirm={remove}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
          setConfirmOpen(open);
        }}
      />
    </div>
  );
}
