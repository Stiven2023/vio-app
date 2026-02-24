"use client";

import type { Addition, Category, Paginated } from "../../_lib/types";

import { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/table";
import { Button } from "@heroui/button";
import { Spinner } from "@heroui/spinner";
import { Chip } from "@heroui/chip";
import {
  BsPlusLg,
  BsPencilFill,
  BsTrashFill,
  BsEyeFill,
} from "react-icons/bs";

import { apiJson, getErrorMessage } from "../../_lib/api";
import { AdditionModal } from "./addition-modal";

export function AdditionsTab({
  activeCatalog,
  categories,
}: {
  activeCatalog: "NACIONAL" | "INTERNACIONAL";
  categories: Category[];
}) {
  const [items, setItems] = useState<Addition[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [selectedAddition, setSelectedAddition] = useState<Addition | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const loadingRef = useRef(false);

  function loadAdditions() {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);

    apiJson<Paginated<Addition>>(
      `/api/additions?catalogType=${activeCatalog}&page=${page}&pageSize=${pageSize}`,
    )
      .then((response) => {
        setItems(response.items ?? []);
        setTotal(response.total ?? 0);
      })
      .catch((error) => {
        toast.error(getErrorMessage(error));
      })
      .finally(() => {
        loadingRef.current = false;
        setLoading(false);
      });
  }

  useEffect(() => {
    setPage(1);
  }, [activeCatalog]);

  useEffect(() => {
    loadAdditions();
  }, [page, activeCatalog]);

  async function handleDelete(additionId: string) {
    if (!confirm("¿Eliminar esta adición?")) return;

    try {
      const res = await fetch("/api/additions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: additionId }),
      });

      if (!res.ok) {
        const msg = await res.text();
        toast.error(msg || "Error al eliminar");
        return;
      }

      toast.success("Adición eliminada");
      loadAdditions();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  function handleEdit(addition: Addition) {
    setSelectedAddition(addition);
    setIsModalOpen(true);
  }

  function handleNew() {
    setSelectedAddition(null);
    setIsModalOpen(true);
  }

  return (
    <div className="space-y-4">
      <AdditionModal
        addition={selectedAddition}
        categories={categories}
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        onSaved={loadAdditions}
      />

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Adiciones</h3>
        <Button
          isIconOnly
          color="primary"
          onPress={handleNew}
          startContent={<BsPlusLg />}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-divider py-8 text-center">
          <p className="text-sm text-default-500">
            No hay adiciones en este catálogo
          </p>
        </div>
      ) : (
        <Table
          aria-label="Adiciones"
          className="w-full"
          bottomContent={
            total > pageSize ? (
              <div className="flex w-full justify-center gap-2">
                <Button
                  isDisabled={page === 1}
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                  size="sm"
                  variant="flat"
                >
                  Anterior
                </Button>
                <span className="flex items-center text-sm">
                  Página {page} de {Math.ceil(total / pageSize)}
                </span>
                <Button
                  isDisabled={page >= Math.ceil(total / pageSize)}
                  onPress={() => setPage((p) => p + 1)}
                  size="sm"
                  variant="flat"
                >
                  Siguiente
                </Button>
              </div>
            ) : null
          }
        >
          <TableHeader>
            <TableColumn>Código</TableColumn>
            <TableColumn>Nombre</TableColumn>
            <TableColumn>Tipo</TableColumn>
            <TableColumn>{activeCatalog === "INTERNACIONAL" ? "Precio USD" : "Precio Base"}</TableColumn>
            <TableColumn>Categoría</TableColumn>
            <TableColumn>Estado</TableColumn>
            <TableColumn className="w-32">Acciones</TableColumn>
          </TableHeader>
          <TableBody>
            {items.map((addition) => (
              <TableRow key={addition.id}>
                <TableCell className="font-mono text-sm">
                  {addition.additionCode}
                </TableCell>
                <TableCell>{addition.name}</TableCell>
                <TableCell>
                  <Chip
                    size="sm"
                    variant="flat"
                    color={addition.productKind === "ESPECIAL" ? "warning" : "default"}
                  >
                    {addition.productKind}
                  </Chip>
                </TableCell>
                <TableCell>
                  <span className="text-sm font-mono">
                    {activeCatalog === "INTERNACIONAL"
                      ? addition.priceUSD ?? "-"
                      : addition.priceCopBase ?? "-"}
                  </span>
                </TableCell>
                <TableCell>{addition.categoryId}</TableCell>
                <TableCell>
                  <Chip
                    size="sm"
                    color={addition.isActive ? "success" : "danger"}
                    variant="flat"
                  >
                    {addition.isActive ? "Activo" : "Inactivo"}
                  </Chip>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      onPress={() => handleEdit(addition)}
                      startContent={<BsPencilFill className="h-4 w-4" />}
                    />
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      color="danger"
                      onPress={() => handleDelete(addition.id)}
                      startContent={<BsTrashFill className="h-4 w-4" />}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
