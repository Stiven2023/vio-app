"use client";

import type { InventoryItem } from "../../_lib/types";

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
import { BsPencilSquare, BsThreeDotsVertical, BsTrash } from "react-icons/bs";

import { apiJson, getErrorMessage } from "../../_lib/api";

import { InventoryVariantModal } from "./inventory-variant-modal";

import { ConfirmActionModal } from "@/components/confirm-action-modal";

type VariantRow = {
  id: string;
  inventoryItemId: string;
  sku: string;
  color: string | null;
  size: string | null;
  description: string | null;
  isActive: boolean | null;
  currentStock: string | null;
};

type VariantsResponse = {
  items: VariantRow[];
};

export function InventoryItemDetailsModal({
  item,
  isOpen,
  onOpenChange,
}: {
  item: InventoryItem | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<VariantRow | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<VariantRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const canManageVariants = Boolean(item?.id);

  const variantTotalStock = useMemo(() => {
    const total = variants.reduce((acc, variant) => {
      const qty = Number.parseFloat(String(variant.currentStock ?? "0"));

      return acc + (Number.isFinite(qty) ? qty : 0);
    }, 0);

    return Number.isInteger(total) ? String(total) : total.toFixed(2);
  }, [variants]);

  const loadVariants = async () => {
    if (!item?.id || !canManageVariants) {
      setVariants([]);

      return;
    }

    setLoading(true);
    try {
      const res = await apiJson<VariantsResponse>(
        `/api/inventory-item-variants?inventoryItemId=${item.id}&page=1&pageSize=300`,
      );

      setVariants(res.items ?? []);
    } catch {
      setVariants([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    loadVariants();
  }, [isOpen, item?.id, canManageVariants]);

  const detailRows = useMemo(
    () => [
      { label: "Codigo", value: item?.itemCode ?? "-" },
      { label: "Nombre", value: item?.name ?? "-" },
      { label: "Unidad", value: item?.unit ?? "-" },
      {
        label: "Stock actual",
        value: canManageVariants
          ? variantTotalStock
          : (item?.currentStock ?? "0"),
      },
      { label: "Descripcion", value: item?.description ?? "-" },
      { label: "Modelo", value: "Variantes obligatorias" },
    ],
    [item, canManageVariants, variantTotalStock],
  );

  const removeVariant = async () => {
    const variant = pendingDelete;

    if (!variant || deletingId) return;

    setDeletingId(variant.id);
    try {
      await apiJson("/api/inventory-item-variants", {
        method: "DELETE",
        body: JSON.stringify({ id: variant.id }),
      });
      toast.success("Variante eliminada");
      setConfirmOpen(false);
      setPendingDelete(null);
      await loadVariants();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Modal disableAnimation isOpen={isOpen} size="4xl" onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>
          {item ? `Detalle item: ${item.name}` : "Detalle item"}
        </ModalHeader>
        <ModalBody>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {detailRows.map((row) => (
              <div
                key={row.label}
                className="rounded-md border border-default-200 p-2"
              >
                <p className="text-xs text-default-500">{row.label}</p>
                <p className="text-sm font-medium break-words">{row.value}</p>
              </div>
            ))}
          </div>

          {canManageVariants ? (
            <div className="space-y-3 rounded-lg border border-default-200 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Variantes</p>
                <Button
                  color="primary"
                  size="sm"
                  onPress={() => {
                    setEditingVariant(null);
                    setVariantModalOpen(true);
                  }}
                >
                  Crear variante
                </Button>
              </div>

              <Table aria-label="Variantes item">
                <TableHeader>
                  <TableColumn>SKU</TableColumn>
                  <TableColumn>Color</TableColumn>
                  <TableColumn>Talla</TableColumn>
                  <TableColumn>Stock</TableColumn>
                  <TableColumn>Estado</TableColumn>
                  <TableColumn>Acciones</TableColumn>
                </TableHeader>
                <TableBody
                  emptyContent={loading ? "Cargando..." : "Sin variantes"}
                  items={variants}
                >
                  {(variant) => (
                    <TableRow key={variant.id}>
                      <TableCell>{variant.sku}</TableCell>
                      <TableCell>{variant.color ?? "-"}</TableCell>
                      <TableCell>{variant.size ?? "-"}</TableCell>
                      <TableCell>{variant.currentStock ?? "0"}</TableCell>
                      <TableCell>
                        {variant.isActive ? "Activa" : "Inactiva"}
                      </TableCell>
                      <TableCell>
                        <Dropdown>
                          <DropdownTrigger>
                            <Button size="sm" variant="flat">
                              <BsThreeDotsVertical />
                            </Button>
                          </DropdownTrigger>
                          <DropdownMenu aria-label="Acciones variante">
                            <DropdownItem
                              key="edit"
                              startContent={<BsPencilSquare />}
                              onPress={() => {
                                setEditingVariant(variant);
                                setVariantModalOpen(true);
                              }}
                            >
                              Editar
                            </DropdownItem>
                            <DropdownItem
                              key="delete"
                              className="text-danger"
                              startContent={<BsTrash />}
                              onPress={() => {
                                setPendingDelete(variant);
                                setConfirmOpen(true);
                              }}
                            >
                              Eliminar
                            </DropdownItem>
                          </DropdownMenu>
                        </Dropdown>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </ModalFooter>
      </ModalContent>

      <InventoryVariantModal
        isOpen={variantModalOpen}
        itemId={item?.id ?? ""}
        variant={editingVariant}
        onOpenChange={setVariantModalOpen}
        onSaved={loadVariants}
      />

      <ConfirmActionModal
        cancelLabel="Cancelar"
        confirmLabel="Eliminar"
        description={
          pendingDelete ? `¿Eliminar variante ${pendingDelete.sku}?` : undefined
        }
        isLoading={deletingId === pendingDelete?.id}
        isOpen={confirmOpen}
        title="Confirmar eliminación"
        onConfirm={removeVariant}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
          setConfirmOpen(open);
        }}
      />
    </Modal>
  );
}
