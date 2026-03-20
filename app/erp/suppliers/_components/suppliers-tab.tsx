"use client";

import type { Paginated } from "@/app/erp/catalog/_lib/types";

import { useMemo, useState } from "react";
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
import { BsPencilSquare, BsThreeDotsVertical, BsTrash, BsEyeFill, BsShieldCheck } from "react-icons/bs";

import { FilterSelect } from "@/app/erp/catalog/_components/ui/filter-select";
import { Pager } from "@/app/erp/catalog/_components/ui/pager";
import { TableSkeleton } from "@/app/erp/catalog/_components/ui/table-skeleton";
import { usePaginatedApi } from "@/app/erp/catalog/_hooks/use-paginated-api";
import { apiJson, getErrorMessage } from "@/app/erp/catalog/_lib/api";
import { ConfirmActionModal } from "@/components/confirm-action-modal";
import { ThirdPartyDocumentsModal } from "@/components/third-party-documents-modal";

import { SupplierModal } from "./supplier-modal";
import { SupplierDetailsModal } from "./supplier-details-modal";
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
  const { data, loading, page, setPage, refresh } =
    usePaginatedApi<Supplier>("/api/suppliers", 10);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [viewing, setViewing] = useState<Supplier | null>(null);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [viewingDocuments, setViewingDocuments] = useState<Supplier | null>(null);
  const [legalStatusModalOpen, setLegalStatusModalOpen] = useState(false);
  const [viewingLegalStatus, setViewingLegalStatus] = useState<Supplier | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Supplier | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
          className="sm:w-72"
          placeholder="Search by code, name, email or contact…"
          value={search}
          onValueChange={setSearch}
          isClearable
          onClear={() => setSearch("")}
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

        <div className="flex gap-2">
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
                <TableCell className="text-default-500">{s.identificationType}</TableCell>
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
        <Pager data={data as Paginated<Supplier>} page={page} onChange={setPage} />
      ) : null}

      <SupplierModal
        supplier={editing}
        isOpen={modalOpen}
        onOpenChange={setModalOpen}
        onSaved={refresh}
      />

      <SupplierDetailsModal
        supplier={viewing}
        isOpen={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open);
          if (!open) setViewing(null);
        }}
        onRequestCreateClient={
          legalOnlyMode ? undefined : () => viewing && createAsClient(viewing)
        }
        onRequestCreateEmployee={
          legalOnlyMode ? undefined : () => viewing && createAsEmployee(viewing)
        }
        onRequestCreateConfectionist={
          legalOnlyMode ? undefined : () => viewing && createAsConfectionist(viewing)
        }
        onRequestCreatePacker={
          legalOnlyMode ? undefined : () => viewing && createAsPacker(viewing)
        }
      />

      <SupplierLegalStatusModal
        supplier={viewingLegalStatus}
        isOpen={legalStatusModalOpen}
        onOpenChange={setLegalStatusModalOpen}
      />

      <ThirdPartyDocumentsModal
        title={`Documents of ${viewingDocuments?.name ?? ""}`}
        subtitle={
          viewingDocuments
            ? `${viewingDocuments.identificationType} - ${viewingDocuments.identification}`
            : undefined
        }
        emptyMessage="This supplier has no uploaded documents."
        documents={
          viewingDocuments
            ? [
                { label: "Identity document", url: viewingDocuments.identityDocumentUrl },
                { label: "RUT", url: viewingDocuments.rutDocumentUrl },
                { label: "Chamber of commerce", url: viewingDocuments.commerceChamberDocumentUrl },
                { label: "Passport", url: viewingDocuments.passportDocumentUrl },
                { label: "Tax certificate", url: viewingDocuments.taxCertificateDocumentUrl },
                { label: "Company document", url: viewingDocuments.companyIdDocumentUrl },
                { label: "Bank certificate", url: viewingDocuments.bankCertificateUrl },
              ]
            : []
        }
        isOpen={documentsOpen}
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
