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
import {
  BsArrowsMove,
  BsEye,
  BsPencilSquare,
  BsThreeDotsVertical,
  BsTrash,
} from "react-icons/bs";

import { usePaginatedApi } from "@/app/erp/catalog/_hooks/use-paginated-api";
import { apiJson, getErrorMessage } from "@/app/erp/catalog/_lib/api";
import { FilterSearch } from "@/app/erp/catalog/_components/ui/filter-search";
import { Pager } from "@/app/erp/catalog/_components/ui/pager";
import { TableSkeleton } from "@/app/erp/catalog/_components/ui/table-skeleton";
import { ConfirmActionModal } from "@/components/confirm-action-modal";

import { WarehouseModal, type WarehouseRow } from "./warehouse-modal";

export function WarehousesTab({ canManage }: { canManage: boolean }) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const endpoint = useMemo(() => {
    const q = search.trim();

    return q ? `/api/warehouses?q=${encodeURIComponent(q)}` : "/api/warehouses";
  }, [search]);

  const { data, loading, page, setPage, refresh } = usePaginatedApi<WarehouseRow>(
    endpoint,
    10,
  );

  useEffect(() => {
    setPage(1);
  }, [search, setPage]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<WarehouseRow | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<WarehouseRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const emptyContent = useMemo(() => {
    if (loading) return "";
    if (search.trim()) return "No results";

    return "No warehouses";
  }, [loading, search]);

  const remove = async () => {
    const warehouse = pendingDelete;

    if (!warehouse || deletingId) return;

    setDeletingId(warehouse.id);
    try {
      await apiJson("/api/warehouses", {
        method: "DELETE",
        body: JSON.stringify({ id: warehouse.id }),
      });

      toast.success("Warehouse deleted");
      setConfirmOpen(false);
      setPendingDelete(null);
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <FilterSearch
          className="sm:w-72"
          placeholder="Search warehouse..."
          value={search}
          onValueChange={setSearch}
        />

        <div className="flex gap-2">
          {canManage ? (
            <Button
              color="primary"
              onPress={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              Create warehouse
            </Button>
          ) : null}
          <Button variant="flat" onPress={refresh}>
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <TableSkeleton ariaLabel="Warehouses" headers={["Code", "Name", "City", "Type", "Status", "Actions"]} />
      ) : (
        <Table aria-label="Warehouses">
          <TableHeader>
            <TableColumn>Code</TableColumn>
            <TableColumn>Name</TableColumn>
            <TableColumn>City</TableColumn>
            <TableColumn>Type</TableColumn>
            <TableColumn>Status</TableColumn>
            <TableColumn>Actions</TableColumn>
          </TableHeader>
          <TableBody emptyContent={emptyContent} items={data?.items ?? []}>
            {(warehouse) => (
              <TableRow key={warehouse.id}>
                <TableCell>{warehouse.code}</TableCell>
                <TableCell>{warehouse.name}</TableCell>
                <TableCell>{warehouse.city ?? "-"}</TableCell>
                <TableCell>
                  {warehouse.isVirtual
                    ? "Virtual"
                    : warehouse.isExternal
                      ? "External"
                      : "Physical"}
                </TableCell>
                <TableCell>{warehouse.isActive ? "Active" : "Inactive"}</TableCell>
                <TableCell>
                  {canManage ? (
                    <Dropdown>
                      <DropdownTrigger>
                        <Button isDisabled={Boolean(deletingId)} size="sm" variant="flat">
                          <BsThreeDotsVertical />
                        </Button>
                      </DropdownTrigger>
                      <DropdownMenu aria-label="Warehouse actions">
                        <DropdownItem
                          key="view"
                          startContent={<BsEye />}
                          onPress={() => {
                            router.push(`/erp/compras/bodega/${warehouse.id}`);
                          }}
                        >
                          View details
                        </DropdownItem>
                        <DropdownItem
                          key="edit"
                          startContent={<BsPencilSquare />}
                          onPress={() => {
                            setEditing(warehouse);
                            setModalOpen(true);
                          }}
                        >
                          Edit
                        </DropdownItem>
                        <DropdownItem
                          key="delete"
                          className="text-danger"
                          startContent={<BsTrash />}
                          onPress={() => {
                            setPendingDelete(warehouse);
                            setConfirmOpen(true);
                          }}
                        >
                          Delete
                        </DropdownItem>
                      </DropdownMenu>
                    </Dropdown>
                  ) : (
                    <Button
                      size="sm"
                      startContent={<BsArrowsMove />}
                      variant="flat"
                      onPress={() => {
                        router.push(`/erp/compras/bodega/${warehouse.id}`);
                      }}
                    >
                      Go to details
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {data ? <Pager data={data} page={page} onChange={setPage} /> : null}

      <WarehouseModal
        warehouse={editing}
        isOpen={modalOpen}
        onOpenChange={setModalOpen}
        onSaved={refresh}
      />

      <ConfirmActionModal
        cancelLabel="Cancel"
        confirmLabel="Delete"
        description={pendingDelete ? `Delete warehouse ${pendingDelete.name}?` : undefined}
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
