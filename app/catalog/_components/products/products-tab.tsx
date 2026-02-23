"use client";

import type { Category, Product, ProductPrice } from "../../_lib/types";

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
import {
  BsCashCoin,
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
import { PriceModal } from "../prices/price-modal";

import { ProductModal } from "./product-modal";

import { ConfirmActionModal } from "@/components/confirm-action-modal";

type StatusFilter = "all" | "active" | "inactive";

export function ProductsTab({
  canCreate,
  canEdit,
  canDelete,
}: {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const {
    data: productsData,
    loading: productsLoading,
    page: productsPage,
    setPage: setProductsPage,
    refresh: refreshProducts,
  } = usePaginatedApi<Product>("/api/products", 10);

  const {
    data: pricesData,
    loading: pricesLoading,
    page: pricesPage,
    setPage: setPricesPage,
    refresh: refreshPrices,
  } = usePaginatedApi<ProductPrice>("/api/product-prices", 10);

  const [categories, setCategories] = useState<Category[]>([]);
  const categoryNameById = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [priceModalOpen, setPriceModalOpen] = useState(false);
  const [editingPrice, setEditingPrice] = useState<ProductPrice | null>(null);
  const [priceConfirmOpen, setPriceConfirmOpen] = useState(false);
  const [pendingPriceDelete, setPendingPriceDelete] =
    useState<ProductPrice | null>(null);
  const [deletingPriceId, setDeletingPriceId] = useState<string | null>(null);
  const [priceSearch, setPriceSearch] = useState("");
  const [priceStatus, setPriceStatus] = useState<StatusFilter>("all");
  const [priceProductId, setPriceProductId] = useState<string>("");

  useEffect(() => {
    apiJson<{ items: Category[] }>(`/api/categories?page=1&pageSize=400`)
      .then((r) => setCategories(r.items))
      .catch(() => setCategories([]));
  }, []);

  const [allProducts, setAllProducts] = useState<Product[]>([]);

  useEffect(() => {
    apiJson<{ items: Product[] }>(`/api/products?page=1&pageSize=600`)
      .then((r) => setAllProducts(r.items))
      .catch(() => setAllProducts([]));
  }, []);

  const productNameById = useMemo(
    () => new Map(allProducts.map((p) => [p.id, p.name])),
    [allProducts],
  );

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

  const filteredPrices = useMemo(() => {
    const items = pricesData?.items ?? [];
    const q = priceSearch.trim().toLowerCase();

    return items.filter((pp) => {
      if (priceStatus === "active" && !pp.isActive) return false;
      if (priceStatus === "inactive" && pp.isActive) return false;
      if (priceProductId && pp.productId !== priceProductId) return false;
      if (!q) return true;

      const prodName = pp.productId
        ? (productNameById.get(pp.productId) ?? "")
        : "";

      return (
        pp.referenceCode.toLowerCase().includes(q) ||
        prodName.toLowerCase().includes(q)
      );
    });
  }, [priceProductId, priceSearch, priceStatus, pricesData, productNameById]);

  const emptyPricesContent = useMemo(() => {
    if (pricesLoading) return "";
    if (priceSearch.trim() !== "" || priceStatus !== "all" || priceProductId)
      return "Sin resultados";

    return "Sin precios";
  }, [priceProductId, priceSearch, priceStatus, pricesLoading]);

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

  const removePrice = async () => {
    const pp = pendingPriceDelete;

    if (!pp) return;
    if (deletingPriceId) return;

    setDeletingPriceId(pp.id);
    try {
      await apiJson(`/api/product-prices`, {
        method: "DELETE",
        body: JSON.stringify({ id: pp.id }),
      });
      toast.success("Precio eliminado");
      setPriceConfirmOpen(false);
      setPendingPriceDelete(null);
      refreshPrices();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeletingPriceId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
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

                      {canEdit ? (
                        <DropdownItem
                          key="prices"
                          startContent={<BsCashCoin />}
                          onPress={() => {
                            setEditingPrice(null);
                            setPriceProductId(p.id);
                            setPriceModalOpen(true);
                          }}
                        >
                          Precios
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

      <div className="pt-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <FilterSearch
              className="sm:w-72"
              placeholder="Buscar precio (código o producto)…"
              value={priceSearch}
              onValueChange={setPriceSearch}
            />
            <FilterSelect
              className="sm:w-56"
              label="Estado"
              options={[
                { value: "all", label: "Todos" },
                { value: "active", label: "Activos" },
                { value: "inactive", label: "Desactivados" },
              ]}
              value={priceStatus}
              onChange={(v) => setPriceStatus(v as StatusFilter)}
            />
            <FilterSelect
              className="sm:w-64"
              label="Producto"
              options={[
                { value: "", label: "Todos" },
                ...allProducts.map((p) => ({ value: p.id, label: p.name })),
              ]}
              value={priceProductId}
              onChange={(v) => setPriceProductId(String(v ?? ""))}
            />
          </div>

          <div className="flex gap-2">
            {canCreate ? (
              <Button
                color="primary"
                onPress={() => {
                  setEditingPrice(null);
                  setPriceModalOpen(true);
                }}
              >
                Crear precio
              </Button>
            ) : null}
            <Button variant="flat" onPress={refreshPrices}>
              Refrescar
            </Button>
          </div>
        </div>

        <div className="mt-3">
          {pricesLoading ? (
            <TableSkeleton
              ariaLabel="Precios"
              headers={[
                "Código",
                "Producto",
                "R1",
                "R2",
                "R3",
                "Viomar",
                "Colanta",
                "Mayorista",
                "USD",
                "Activo",
                "Acciones",
              ]}
            />
          ) : (
            <Table aria-label="Precios">
              <TableHeader>
                <TableColumn>Código</TableColumn>
                <TableColumn>Producto</TableColumn>
                <TableColumn>R1</TableColumn>
                <TableColumn>R2</TableColumn>
                <TableColumn>R3</TableColumn>
                <TableColumn>Viomar</TableColumn>
                <TableColumn>Colanta</TableColumn>
                <TableColumn>Mayorista</TableColumn>
                <TableColumn>USD</TableColumn>
                <TableColumn>Activo</TableColumn>
                <TableColumn>Acciones</TableColumn>
              </TableHeader>
              <TableBody
                emptyContent={emptyPricesContent}
                items={filteredPrices}
              >
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
                      {pp.priceCopR1 ?? "-"}
                    </TableCell>
                    <TableCell className="text-default-600">
                      {pp.priceCopR2 ?? "-"}
                    </TableCell>
                    <TableCell className="text-default-600">
                      {pp.priceCopR3 ?? "-"}
                    </TableCell>
                    <TableCell className="text-default-600">
                      {pp.priceViomar ?? "-"}
                    </TableCell>
                    <TableCell className="text-default-600">
                      {pp.priceColanta ?? "-"}
                    </TableCell>
                    <TableCell className="text-default-600">
                      {pp.priceMayorista ?? "-"}
                    </TableCell>
                    <TableCell className="text-default-600">
                      {pp.priceUSD ?? "-"}
                    </TableCell>
                    <TableCell>{pp.isActive ? "Sí" : "No"}</TableCell>
                    <TableCell>
                      <Dropdown>
                        <DropdownTrigger>
                          <Button
                            isDisabled={Boolean(deletingPriceId)}
                            size="sm"
                            variant="flat"
                          >
                            <BsThreeDotsVertical />
                          </Button>
                        </DropdownTrigger>
                        <DropdownMenu aria-label="Acciones">
                          {canEdit ? (
                            <DropdownItem
                              key="edit"
                              startContent={<BsPencilSquare />}
                              onPress={() => {
                                setEditingPrice(pp);
                                setPriceModalOpen(true);
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
                                setPendingPriceDelete(pp);
                                setPriceConfirmOpen(true);
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

          {pricesData ? (
            <Pager
              data={pricesData}
              page={pricesPage}
              onChange={setPricesPage}
            />
          ) : null}
        </div>
      </div>

      <ProductModal
        categories={categories}
        isOpen={modalOpen}
        product={editing}
        onOpenChange={setModalOpen}
        onSaved={() => {
          refreshProducts();
          apiJson<{ items: Product[] }>(`/api/products?page=1&pageSize=600`)
            .then((r) => setAllProducts(r.items))
            .catch(() => setAllProducts([]));
        }}
      />

      <PriceModal
        defaultProductId={priceProductId}
        isOpen={priceModalOpen}
        price={editingPrice}
        products={allProducts}
        onOpenChange={(open) => {
          if (!open) setEditingPrice(null);
          setPriceModalOpen(open);
        }}
        onSaved={() => {
          refreshPrices();
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

      <ConfirmActionModal
        cancelLabel="Cancelar"
        confirmLabel="Eliminar"
        description={
          pendingPriceDelete
            ? `¿Eliminar el precio ${pendingPriceDelete.referenceCode}?`
            : undefined
        }
        isLoading={deletingPriceId === pendingPriceDelete?.id}
        isOpen={priceConfirmOpen}
        title="Confirmar eliminación"
        onConfirm={removePrice}
        onOpenChange={(open) => {
          if (!open) setPendingPriceDelete(null);
          setPriceConfirmOpen(open);
        }}
      />
    </div>
  );
}
