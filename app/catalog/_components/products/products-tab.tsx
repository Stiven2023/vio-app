"use client";

import type { Category, Product } from "../../_lib/types";

import { useEffect, useMemo, useRef, useState } from "react";
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

function formatCurrency(value: string | null | undefined, currency: "COP" | "USD") {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || value === null || value === undefined || value === "") {
    return "-";
  }

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

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
  const [searchCode, setSearchCode] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const currentCatalog = activeCatalog ?? internalActiveCatalog;
  const currentCategories = categories ?? internalCategories;
  const endpoint = useMemo(() => {
    const params = new URLSearchParams({
      catalogType: currentCatalog,
      status,
      searchBy: "code",
    });

    const q = searchCode.trim();

    if (q) {
      params.set("q", q);
    }

    if (categoryFilter !== "all") {
      params.set("categoryId", categoryFilter);
    }

    return `/api/products?${params.toString()}`;
  }, [categoryFilter, currentCatalog, searchCode, status]);

  const {
    data: productsData,
    loading: productsLoading,
    page: productsPage,
    setPage: setProductsPage,
    refresh: refreshProducts,
  } = usePaginatedApi<Product>(endpoint, 10);

  const categoryNameById = useMemo(
    () => new Map(currentCategories.map((c) => [c.id, c.name])),
    [currentCategories],
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!categories) {
      apiJson<{ items: Category[] }>(`/api/categories?page=1&pageSize=400`)
        .then((r) => setInternalCategories(r.items))
        .catch(() => setInternalCategories([]));
    }
  }, [categories]);

  useEffect(() => {
    setProductsPage(1);
  }, [currentCatalog, status, categoryFilter, searchCode, setProductsPage]);

  const emptyContent = useMemo(() => {
    if (productsLoading) return "";
    if (searchCode.trim() !== "" || status !== "all" || categoryFilter !== "all") {
      return "Sin resultados";
    }

    return "Sin productos";
  }, [productsLoading, searchCode, status, categoryFilter]);

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

  const downloadTemplate = () => {
    const anchor = document.createElement("a");
    anchor.href = "/api/products/import/template";
    anchor.download = "products-import-template.csv";
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

      const response = await fetch("/api/products/import", {
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
        toast.error(
          `No se creó ningún producto. ${firstError || "Revisa el archivo CSV y vuelve a intentar."}`,
        );
        return;
      }

      if (failedCount > 0) {
        toast.success(
          `Importación parcial: ${createdCount} creados, ${updatedCount} editados, ${failedCount} con error`,
        );
      } else {
        toast.success(
          `Importación masiva exitosa: ${createdCount} creados, ${updatedCount} editados`,
        );
      }

      refreshProducts();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <FilterSearch
            className="sm:w-72"
            placeholder="Buscar por código…"
            value={searchCode}
            onValueChange={setSearchCode}
          />
          <FilterSelect
            className="sm:w-64"
            label="Categoría"
            options={[
              { value: "all", label: "Todas" },
              ...currentCategories.map((category) => ({
                value: category.id,
                label: category.name,
              })),
            ]}
            value={categoryFilter}
            onChange={setCategoryFilter}
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

        <div className="flex flex-wrap gap-2 sm:justify-end">
          <input
            ref={fileInputRef}
            accept=".csv,text/csv"
            className="hidden"
            type="file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              importCsv(file);
            }}
          />
          <Button variant="flat" onPress={downloadTemplate}>
            Descargar plantilla CSV
          </Button>
          <Button
            color="secondary"
            isLoading={importing}
            onPress={() => fileInputRef.current?.click()}
          >
            Importar CSV
          </Button>
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
          <TableBody emptyContent={emptyContent} items={productsData?.items ?? []}>
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
                      ? formatCurrency(p.priceUSD, "USD")
                      : formatCurrency(p.priceCopR1, "COP")}
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
