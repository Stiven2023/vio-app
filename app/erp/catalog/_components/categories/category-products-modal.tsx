"use client";

import type { Category, Product } from "../../_lib/types";

import { useMemo } from "react";
import { Button } from "@heroui/button";
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

import { usePaginatedApi } from "../../_hooks/use-paginated-api";
import { Pager } from "../ui/pager";
import { TableSkeleton } from "../ui/table-skeleton";

export function CategoryProductsModal({
  category,
  isOpen,
  onOpenChange,
}: {
  category: Category | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const endpoint = useMemo(() => {
    if (!isOpen || !category?.id) {
      return "";
    }

    return `/api/products?categoryId=${encodeURIComponent(category.id)}&status=all`;
  }, [category?.id, isOpen]);

  const { data, loading, page, setPage } = usePaginatedApi<Product>(endpoint, 10);
  const items = data?.items ?? [];

  return (
    <Modal isOpen={isOpen} scrollBehavior="inside" size="4xl" onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>
          {category ? `Productos de ${category.name}` : "Productos de categoría"}
        </ModalHeader>
        <ModalBody>
          {loading ? (
            <TableSkeleton
              ariaLabel="Productos por categoría"
              headers={["Código", "Nombre", "Estado"]}
            />
          ) : (
            <Table aria-label="Productos asociados a categoría">
              <TableHeader>
                <TableColumn>Código</TableColumn>
                <TableColumn>Nombre</TableColumn>
                <TableColumn>Estado</TableColumn>
              </TableHeader>
              <TableBody emptyContent="Sin productos asociados" items={items}>
                {(product) => (
                  <TableRow key={product.id}>
                    <TableCell>{product.productCode ?? "-"}</TableCell>
                    <TableCell>{product.name}</TableCell>
                    <TableCell>{product.isActive ? "Activo" : "Inactivo"}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
          {data ? <Pager data={data} page={page} onChange={setPage} /> : null}
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
