"use client";

import type { Product, ProductPrice } from "../../_lib/types";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";

import { apiJson, getErrorMessage } from "../../_lib/api";
import { usePaginatedApi } from "../../_hooks/use-paginated-api";
import { Pager } from "../ui/pager";
import { TableSkeleton } from "../ui/table-skeleton";
import { FilterSearch } from "../ui/filter-search";
import { FilterSelect } from "../ui/filter-select";

import { PriceModal } from "./price-modal";

import { ConfirmActionModal } from "@/components/confirm-action-modal";

type StatusFilter = "all" | "active" | "inactive";

export function PricesTab({
  canCreate,
  canEdit,
  canDelete,
}: {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const { data, loading, page, setPage, refresh } =
    usePaginatedApi<ProductPrice>("/api/product-prices", 10);

  const [products, setProducts] = useState<Product[]>([]);
  const productNameById = useMemo(
    () => new Map(products.map((p) => [p.id, p.name])),
    [products],
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProductPrice | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ProductPrice | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    apiJson<{ items: Product[] }>(`/api/products?page=1&pageSize=600`)
      .then((r) => setProducts(r.items))
      .catch(() => setProducts([]));
  }, []);

  const filtered = useMemo(() => {
    const items = data?.items ?? [];
    const q = search.trim().toLowerCase();

    return items.filter((pp) => {
      if (status === "active" && !pp.isActive) return false;
      if (status === "inactive" && pp.isActive) return false;
      if (!q) return true;

      const prodName = pp.productId
        ? (productNameById.get(pp.productId) ?? "")
        : "";

      return (
        pp.referenceCode.toLowerCase().includes(q) ||
        prodName.toLowerCase().includes(q)
      );
    });
  }, [data, productNameById, search, status]);

  const emptyContent = useMemo(() => {
    if (loading) return "";
    if (search.trim() !== "" || status !== "all") return "Sin resultados";

    return "Sin precios";
  }, [loading, search, status]);

  const remove = async () => {
    const pp = pendingDelete;

    if (!pp) return;
    if (deletingId) return;

    setDeletingId(pp.id);
    try {
      await apiJson(`/api/product-prices`, {
        method: "DELETE",
        body: JSON.stringify({ id: pp.id }),
      });
      toast.success("Precio eliminado");
      setConfirmOpen(false);
      setPendingDelete(null);
      refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <FilterSearch
            className="sm:w-72"
            placeholder="Buscar por código o producto…"
            value={search}
            onValueChange={setSearch}
          />
          <FilterSelect
            className="sm:w-56"
            label="Estado"
            options={[
              { value: "all", label: "Todos" },
              { value: "active", label: "Activos" },
              { value: "inactive", label: "Desactivados" },
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
              Crear precio
            </Button>
          ) : null}
          <Button variant="flat" onPress={refresh}>
            Refrescar
          </Button>
        </div>
      </div>

      {loading ? (
        <TableSkeleton
          ariaLabel="Precios"
          headers={["Código", "Producto", "COP", "USD", "Activo", "Acciones"]}
        />
      ) : (
        <Table aria-label="Precios">
          <TableHeader>
            <TableColumn>Código</TableColumn>
            <TableColumn>Producto</TableColumn>
            <TableColumn>COP</TableColumn>
            <TableColumn>USD</TableColumn>
            <TableColumn>Activo</TableColumn>
            <TableColumn>Acciones</TableColumn>
          </TableHeader>
          <TableBody emptyContent={emptyContent} items={filtered}>
            {(pp) => (
              <TableRow key={pp.id}>
                <TableCell className="font-medium">
                  {pp.referenceCode}
                </TableCell>
                <TableCell>
                  {pp.productId
                    ? (productNameById.get(pp.productId) ?? "-")
                    : "-"}
                </TableCell>
                <TableCell className="text-default-600">
                  {pp.priceCOP ?? "-"}
                </TableCell>
                <TableCell className="text-default-600">
                  {pp.priceUSD ?? "-"}
                </TableCell>
                <TableCell>{pp.isActive ? "Sí" : "No"}</TableCell>
                <TableCell className="flex gap-2">
                  {canEdit ? (
                    <Button
                      isDisabled={Boolean(deletingId)}
                      size="sm"
                      variant="flat"
                      onPress={() => {
                        setEditing(pp);
                        setModalOpen(true);
                      }}
                    >
                      Editar
                    </Button>
                  ) : null}
                  {canDelete ? (
                    <Button
                      color="danger"
                      isDisabled={Boolean(deletingId)}
                      size="sm"
                      variant="flat"
                      onPress={() => {
                        setPendingDelete(pp);
                        setConfirmOpen(true);
                      }}
                    >
                      Eliminar
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {data ? <Pager data={data} page={page} onChange={setPage} /> : null}

      <PriceModal
        isOpen={modalOpen}
        price={editing}
        products={products}
        onOpenChange={setModalOpen}
        onSaved={refresh}
      />

      <ConfirmActionModal
        cancelLabel="Cancelar"
        confirmLabel="Eliminar"
        description={
          pendingDelete
            ? `¿Eliminar el precio ${pendingDelete.referenceCode}?`
            : undefined
        }
        isLoading={deletingId === pendingDelete?.id}
        isOpen={confirmOpen}
        title="Confirmar eliminación"
        onConfirm={remove}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
          setConfirmOpen(open);
        }}
      />
    </div>
  );
}
