"use client";

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import {
  Button,
  Card,
  CardBody,
  Chip,
  Divider,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Textarea,
} from "@heroui/react";
import {
  MdBlock,
  MdCheckCircle,
  MdError,
  MdRefresh,
  MdSearch,
} from "react-icons/md";

type ClientLegalRow = {
  id: string;
  clientId: string;
  isLegallyEnabled: boolean;
  legalNotes: string | null;
  enabledAt: string | null;
  disabledAt: string | null;
  updatedAt: string | null;
  clientName: string;
  clientCode: string | null;
};

type PaginatedResponse = {
  items: ClientLegalRow[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
};

export function JuridicaClient() {
  const [items, setItems] = useState<ClientLegalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editTarget, setEditTarget] = useState<ClientLegalRow | null>(null);
  const [editEnabled, setEditEnabled] = useState<boolean>(true);
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async (q = "") => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ pageSize: "100" });

      if (q) params.set("search", q);
      const res = await fetch(
        `/api/mes/client-legal-status?${params.toString()}`,
      );

      if (!res.ok) throw new Error("Error al cargar datos");
      const data: PaginatedResponse = await res.json();

      setItems(data.items ?? []);
    } catch {
      toast.error("No se pudo cargar el listado de clientes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openEdit = (item: ClientLegalRow) => {
    setEditTarget(item);
    setEditEnabled(item.isLegallyEnabled);
    setEditNotes(item.legalNotes ?? "");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!editTarget) return;
    if (!editEnabled && !editNotes.trim()) {
      toast.error(
        "Las notas jurídicas son obligatorias al deshabilitar un cliente",
      );

      return;
    }

    setSaving(true);
    try {
      const res = await fetch(
        `/api/mes/client-legal-status/${editTarget.clientId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            isLegallyEnabled: editEnabled,
            legalNotes: editNotes.trim() || null,
          }),
        },
      );

      if (!res.ok) {
        const msg = await res.text().catch(() => "Error desconocido");

        throw new Error(msg);
      }

      toast.success(
        editEnabled
          ? `Cliente ${editTarget.clientName} habilitado jurídicamente`
          : `Cliente ${editTarget.clientName} deshabilitado jurídicamente`,
      );

      setModalOpen(false);
      setEditTarget(null);
      await load(search);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (value: string | null) => {
    if (!value) return "-";

    return new Date(value).toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="max-w-xs"
          placeholder="Buscar cliente..."
          radius="sm"
          size="sm"
          startContent={<MdSearch className="text-default-400" />}
          value={search}
          variant="bordered"
          onKeyDown={(e) => {
            if (e.key === "Enter") void load(search);
          }}
          onValueChange={(v) => setSearch(v)}
        />
        <Button
          radius="sm"
          size="sm"
          startContent={<MdSearch />}
          variant="flat"
          onPress={() => void load(search)}
        >
          Buscar
        </Button>
        <Button
          radius="sm"
          size="sm"
          startContent={<MdRefresh />}
          variant="flat"
          onPress={() => {
            setSearch("");
            void load("");
          }}
        >
          Limpiar
        </Button>
      </div>

      <Divider />

      {loading ? (
        <Card
          className="border border-dashed border-divider"
          radius="md"
          shadow="none"
        >
          <CardBody className="py-12 text-center text-default-400">
            <p className="text-sm">Cargando clientes...</p>
          </CardBody>
        </Card>
      ) : items.length === 0 ? (
        <Card
          className="border border-dashed border-divider"
          radius="md"
          shadow="none"
        >
          <CardBody className="py-12 text-center text-default-400">
            <MdError className="mx-auto mb-2 opacity-40" size={36} />
            <p className="text-sm">
              No se encontraron clientes con estado jurídico registrado
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="rounded-medium border border-default-200 overflow-x-auto">
          <Table removeWrapper aria-label="Estado jurídico de clientes">
            <TableHeader>
              <TableColumn>Cliente</TableColumn>
              <TableColumn>Código</TableColumn>
              <TableColumn>Estado jurídico</TableColumn>
              <TableColumn>Notas</TableColumn>
              <TableColumn>Habilitado</TableColumn>
              <TableColumn>Deshabilitado</TableColumn>
              <TableColumn>Acciones</TableColumn>
            </TableHeader>
            <TableBody items={items}>
              {(item) => (
                <TableRow key={item.id ?? item.clientId}>
                  <TableCell>
                    <p className="text-sm font-medium">{item.clientName}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs text-default-400">
                      {item.clientCode ?? "-"}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Chip
                      color={item.isLegallyEnabled ? "success" : "danger"}
                      size="sm"
                      startContent={
                        item.isLegallyEnabled ? (
                          <MdCheckCircle size={12} />
                        ) : (
                          <MdBlock size={12} />
                        )
                      }
                      variant="flat"
                    >
                      {item.isLegallyEnabled ? "Habilitado" : "Deshabilitado"}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <p
                      className="text-xs max-w-[200px] truncate"
                      title={item.legalNotes ?? "-"}
                    >
                      {item.legalNotes ?? "-"}
                    </p>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs">{formatDate(item.enabledAt)}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs">{formatDate(item.disabledAt)}</p>
                  </TableCell>
                  <TableCell>
                    <Button
                      color={item.isLegallyEnabled ? "danger" : "success"}
                      size="sm"
                      variant="flat"
                      onPress={() => openEdit(item)}
                    >
                      {item.isLegallyEnabled ? "Deshabilitar" : "Habilitar"}
                    </Button>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit Modal */}
      <Modal
        disableAnimation
        isOpen={modalOpen}
        size="md"
        onOpenChange={(open) => !open && setModalOpen(false)}
      >
        <ModalContent>
          <>
            <ModalHeader>
              {editEnabled ? "Deshabilitar cliente" : "Habilitar cliente"}
            </ModalHeader>
            <ModalBody className="gap-4 py-4">
              {editTarget && (
                <p className="text-sm font-medium">{editTarget.clientName}</p>
              )}
              <Divider />
              <div className="flex gap-3">
                <Button
                  color={editEnabled ? "default" : "success"}
                  size="sm"
                  variant={!editEnabled ? "solid" : "flat"}
                  onPress={() => setEditEnabled(true)}
                >
                  Habilitar
                </Button>
                <Button
                  color={!editEnabled ? "default" : "danger"}
                  size="sm"
                  variant={editEnabled ? "solid" : "flat"}
                  onPress={() => setEditEnabled(false)}
                >
                  Deshabilitar
                </Button>
              </div>
              <Textarea
                isRequired={!editEnabled}
                label="Notas jurídicas"
                placeholder={
                  !editEnabled
                    ? "Obligatorio: describe la razón de la deshabilitación..."
                    : "Notas opcionales..."
                }
                value={editNotes}
                onValueChange={setEditNotes}
              />
              {!editEnabled && (
                <Card
                  className="border border-danger-200 bg-danger-50"
                  radius="sm"
                  shadow="none"
                >
                  <CardBody className="py-2 px-3">
                    <p className="text-xs text-danger-700">
                      Al deshabilitar, el operario de Despacho no podrá procesar
                      pedidos de este cliente.
                    </p>
                  </CardBody>
                </Card>
              )}
            </ModalBody>
            <ModalFooter>
              <Button
                size="sm"
                variant="flat"
                onPress={() => {
                  setModalOpen(false);
                  setEditTarget(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                color={editEnabled ? "success" : "danger"}
                isDisabled={saving}
                size="sm"
                onPress={() => void handleSave()}
              >
                {saving ? "Guardando..." : editEnabled ? "Guardar (Habilitar)" : "Guardar (Deshabilitar)"}
              </Button>
            </ModalFooter>
          </>
        </ModalContent>
      </Modal>
    </div>
  );
}
