"use client";

import type { Category, Product } from "../../_lib/types";

import { useEffect, useMemo, useState } from "react";
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
import { Tab, Tabs } from "@heroui/tabs";
import {
  BsEye,
  BsPencilSquare,
  BsThreeDotsVertical,
  BsTrash,
} from "react-icons/bs";

import { apiJson, getErrorMessage } from "../../_lib/api";
import { usePaginatedApi } from "../../_hooks/use-paginated-api";
import { Pager } from "../ui/pager";
import { TableSkeleton } from "../ui/table-skeleton";
import { FilterSearch } from "../ui/filter-search";
import { FilterSelect } from "../ui/filter-select";

import { ProductModal } from "./product-modal";
import { ProductDetailsModal } from "./product-details-modal";

import { ConfirmActionModal } from "@/components/confirm-action-modal";

type StatusFilter = "all" | "active" | "inactive";
type CatalogType = "NACIONAL" | "INTERNACIONAL";

export function ProductsTab({
  canCreate,
  canEdit,
  canDelete,
  activeCatalog,
  categories,
}: {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  activeCatalog?: CatalogType;
  categories?: Category[];
}) {
  const [internalActiveCatalog, setInternalActiveCatalog] = useState<CatalogType>("NACIONAL");
  const [internalCategories, setInternalCategories] = useState<Category[]>([]);

  const currentCatalog = activeCatalog ?? internalActiveCatalog;
  const currentCategories = categories ?? internalCategories;

  const {
    data: productsData,
    loading: productsLoading,
    page: productsPage,
    setPage: setProductsPage,
    refresh: refreshProducts,
  } = usePaginatedApi<Product>(`/api/products?catalogType=${currentCatalog}`, 10);

  const categoryNameById = useMemo(
    () => new Map(currentCategories.map((c) => [c.id, c.name])),
    [currentCategories],
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!categories) {
      apiJson<{ items: Category[] }>(`/api/categories?page=1&pageSize=400`)
        .then((r) => setInternalCategories(r.items))
        .catch(() => setInternalCategories([]));
    }
  }, [categories]);

  useEffect(() => {
    setProductsPage(1);
  }, [currentCatalog, setProductsPage]);

  const filtered = useMemo(() => {
    const items = productsData?.items ?? [];
    const q = search.trim().toLowerCase();

    return items.filter((p) => {
      if (status === "active" && !p.isActive) return false;
      if (status === "inactive" && p.isActive) return false;
      if (!q) return true;

      const catName = p.categoryId
        ? (categoryNameById.get(p.categoryId) ?? "")
        : "";

      return (
        p.name.toLowerCase().includes(q) ||
        String(p.productCode ?? "").toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q) ||
        catName.toLowerCase().includes(q)
      );
    });
  }, [categoryNameById, productsData, search, status]);

  const emptyContent = useMemo(() => {
    if (productsLoading) return "";
    if (search.trim() !== "" || status !== "all") return "Sin resultados";

    return "Sin productos";
  }, [productsLoading, search, status]);

  const remove = async () => {
    const p = pendingDelete;

    if (!p) return;
    if (deletingId) return;

    setDeletingId(p.id);
    try {
      await apiJson(`/api/products`, {
        method: "DELETE",
        body: JSON.stringify({ id: p.id }),
      });
      toast.success("Producto eliminado");
      setConfirmOpen(false);
      setPendingDelete(null);
      refreshProducts();
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
          {/* Solo mostrar Tabs si no vienen proporcionadas desde el padre */}
          {!activeCatalog ? (
            <Tabs
              aria-label="Tipo de catálogo"
              selectedKey={internalActiveCatalog}
              onSelectionChange={(key) =>
                setInternalActiveCatalog(
                  String(key) === "INTERNACIONAL" ? "INTERNACIONAL" : "NACIONAL",
                )
              }
              variant="underlined"
            >
              <Tab key="NACIONAL" title="Catálogo nacional" />
              <Tab key="INTERNACIONAL" title="Catálogo internacional" />
            </Tabs>
          ) : null}
          <FilterSearch
            className="sm:w-72"
            placeholder="Buscar producto…"
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
              Crear producto
            </Button>
          ) : null}
          <Button variant="flat" onPress={refreshProducts}>
            Refrescar
          </Button>
        </div>
      </div>

      {productsLoading ? (
        <TableSkeleton
          ariaLabel="Productos"
          headers={["Código", "Nombre", "Categoría", "Activo", "Acciones"]}
        />
      ) : (
        <Table aria-label="Productos">
          <TableHeader>
            <TableColumn>Código</TableColumn>
            <TableColumn>Nombre</TableColumn>
            <TableColumn>Categoría</TableColumn>
            <TableColumn>{currentCatalog === "INTERNACIONAL" ? "Precio USD" : "Precio Base (1-499)"}</TableColumn>
            <TableColumn>Activo</TableColumn>
            <TableColumn>Acciones</TableColumn>
          </TableHeader>
          <TableBody emptyContent={emptyContent} items={filtered}>
            {(p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium text-default-700">
                  {p.productCode ?? "-"}
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{p.name}</div>
                    {p.description ? (
                      <div className="text-xs text-default-500 line-clamp-1">
                        {p.description}
                      </div>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  {p.categoryId
                    ? (categoryNameById.get(p.categoryId) ?? "-")
                    : "-"}
                </TableCell>
                <TableCell>
                  <span className="text-sm font-mono">
                    {currentCatalog === "INTERNACIONAL"
                      ? p.priceUSD ?? "-"
                      : p.priceCopR1 ?? "-"}
                  </span>
                </TableCell>
                <TableCell>{p.isActive ? "Sí" : "No"}</TableCell>
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
                    <DropdownMenu aria-label="Acciones">
                      <DropdownItem
                        key="detail"
                        startContent={<BsEye />}
                        onPress={() => {
                          setSelectedProduct(p);
                          setDetailsOpen(true);
                        }}
                      >
                        Ver detalles
                      </DropdownItem>

                      {canEdit ? (
                        <DropdownItem
                          key="edit"
                          startContent={<BsPencilSquare />}
                          onPress={() => {
                            setEditing(p);
                            setModalOpen(true);
                          }}
                        >
                          Editar
                        </DropdownItem>
                      ) : null}

                      {canDelete ? (
                        <DropdownItem
                          key="delete"
                          className="text-danger"
                          startContent={<BsTrash />}
                          onPress={() => {
                            setPendingDelete(p);
                            setConfirmOpen(true);
                          }}
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

      {productsData ? (
        <Pager
          data={productsData}
          page={productsPage}
          onChange={setProductsPage}
        />
      ) : null}

      <ProductModal
        categories={currentCategories}
        defaultCatalogType={activeCatalog}
        isOpen={modalOpen}
        product={editing}
        onOpenChange={setModalOpen}
        onSaved={refreshProducts}
      />

      <ProductDetailsModal
        categoryName={
          selectedProduct?.categoryId
            ? (categoryNameById.get(selectedProduct.categoryId) ?? "-")
            : "-"
        }
        catalogType={currentCatalog}
        isOpen={detailsOpen}
        product={selectedProduct}
        onOpenChange={(open) => {
          if (!open) setSelectedProduct(null);
          setDetailsOpen(open);
        }}
      />

      <ConfirmActionModal
        cancelLabel="Cancelar"
        confirmLabel="Eliminar"
        description={
          pendingDelete
            ? `¿Eliminar el producto ${pendingDelete.name}?`
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
