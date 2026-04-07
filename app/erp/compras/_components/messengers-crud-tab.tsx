"use client";

import type { Paginated } from "@/app/erp/catalog/_lib/types";

import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Input } from "@heroui/input";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";
import { BsPencilSquare, BsPlusCircle, BsTrash } from "react-icons/bs";

import { Pager } from "@/app/erp/catalog/_components/ui/pager";
import { usePaginatedApi } from "@/app/erp/catalog/_hooks/use-paginated-api";
import { apiJson, getErrorMessage } from "@/app/erp/catalog/_lib/api";
import { ConfirmActionModal } from "@/components/confirm-action-modal";
import { FileUpload } from "@/components/file-upload";

type MessengerType = "MENSAJERO" | "CONDUCTOR";

const VEHICLE_TYPE_OPTIONS = [
  "MOTO",
  "AUTOMOVIL",
  "CAMIONETA",
  "FURGON",
  "CAMION",
  "BICICLETA",
  "OTRO",
] as const;

type VehicleTypeOption = (typeof VEHICLE_TYPE_OPTIONS)[number];

function normalizeVehicleType(value: string | null | undefined): VehicleTypeOption | "" {
  const normalized = String(value ?? "").trim().toUpperCase();

  if (VEHICLE_TYPE_OPTIONS.includes(normalized as VehicleTypeOption)) {
    return normalized as VehicleTypeOption;
  }

  return "";
}

function normalizeVehiclePlate(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

type MessengerRow = {
  id: string;
  messengerCode: string;
  name: string;
  identificationType: "CC" | "NIT" | "CE" | "PAS" | "EMPRESA_EXTERIOR";
  identification: string;
  address: string;
  messengerType: string | null;
  vehicleType: string | null;
  vehiclePlate: string | null;
  drivingLicenseUrl: string | null;
  drivingLicenseExpiresAt: string | null;
  soatDocumentUrl: string | null;
  soatDocumentExpiresAt: string | null;
  tecnomecanicaDocumentUrl: string | null;
  tecnomecanicaDocumentExpiresAt: string | null;
  vehicleLicenseDocumentUrl: string | null;
  vehicleLicenseDocumentExpiresAt: string | null;
  email: string | null;
  mobile: string | null;
  isActive: boolean | null;
};

type FormState = {
  name: string;
  identificationType: "CC" | "NIT" | "CE" | "PAS" | "EMPRESA_EXTERIOR";
  identification: string;
  address: string;
  messengerType: MessengerType;
  vehicleType: VehicleTypeOption | "";
  vehiclePlate: string;
  drivingLicenseUrl: string;
  drivingLicenseExpiresAt: string;
  soatDocumentUrl: string;
  soatDocumentExpiresAt: string;
  tecnomecanicaDocumentUrl: string;
  tecnomecanicaDocumentExpiresAt: string;
  vehicleLicenseDocumentUrl: string;
  vehicleLicenseDocumentExpiresAt: string;
  email: string;
  mobile: string;
  isActive: boolean;
};

const INITIAL_FORM: FormState = {
  name: "",
  identificationType: "CC",
  identification: "",
  address: "",
  messengerType: "MENSAJERO",
  vehicleType: "",
  vehiclePlate: "",
  drivingLicenseUrl: "",
  drivingLicenseExpiresAt: "",
  soatDocumentUrl: "",
  soatDocumentExpiresAt: "",
  tecnomecanicaDocumentUrl: "",
  tecnomecanicaDocumentExpiresAt: "",
  vehicleLicenseDocumentUrl: "",
  vehicleLicenseDocumentExpiresAt: "",
  email: "",
  mobile: "",
  isActive: true,
};

export function MessengersCrudTab({
  defaultType,
  canCreate,
  canEdit,
  canDelete,
}: {
  defaultType: MessengerType;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [q, setQ] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<MessengerRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<MessengerRow | null>(null);
  const [form, setForm] = useState<FormState>({
    ...INITIAL_FORM,
    messengerType: defaultType,
  });

  const endpoint = useMemo(() => {
    const query = new URLSearchParams();

    query.set("type", defaultType);
    query.set("pageSize", "20");

    if (q.trim()) {
      query.set("q", q.trim());
    }

    return `/api/messengers?${query.toString()}`;
  }, [defaultType, q]);

  const { data, loading, page, setPage, refresh } =
    usePaginatedApi<MessengerRow>(endpoint, 20);

  const rows = data?.items ?? [];

  const title = defaultType === "CONDUCTOR" ? "Conductores" : "Mensajeros";

  const openCreate = () => {
    if (!canCreate) return;

    setEditing(null);
    setForm({ ...INITIAL_FORM, messengerType: defaultType });
    setModalOpen(true);
  };

  const openEdit = (row: MessengerRow) => {
    if (!canEdit) return;

    setEditing(row);
    setForm({
      name: row.name,
      identificationType: row.identificationType,
      identification: row.identification,
      address: row.address,
      messengerType:
        String(row.messengerType ?? "").toUpperCase() === "CONDUCTOR"
          ? "CONDUCTOR"
          : "MENSAJERO",
      vehicleType: normalizeVehicleType(row.vehicleType),
      vehiclePlate: row.vehiclePlate ?? "",
      drivingLicenseUrl: row.drivingLicenseUrl ?? "",
      drivingLicenseExpiresAt: row.drivingLicenseExpiresAt ?? "",
      soatDocumentUrl: row.soatDocumentUrl ?? "",
      soatDocumentExpiresAt: row.soatDocumentExpiresAt ?? "",
      tecnomecanicaDocumentUrl: row.tecnomecanicaDocumentUrl ?? "",
      tecnomecanicaDocumentExpiresAt: row.tecnomecanicaDocumentExpiresAt ?? "",
      vehicleLicenseDocumentUrl: row.vehicleLicenseDocumentUrl ?? "",
      vehicleLicenseDocumentExpiresAt:
        row.vehicleLicenseDocumentExpiresAt ?? "",
      email: row.email ?? "",
      mobile: row.mobile ?? "",
      isActive: Boolean(row.isActive),
    });
    setModalOpen(true);
  };

  const submit = async () => {
    if (saving) return;

    if (
      !form.name.trim() ||
      !form.identification.trim() ||
      !form.address.trim()
    ) {
      toast.error("Nombre, identificación y dirección son obligatorios.");

      return;
    }

    const normalizedPlate = normalizeVehiclePlate(form.vehiclePlate);

    if (
      normalizedPlate &&
      !/^(?:[A-Z]{3}\d{3}|[A-Z]{3}\d{2}[A-Z])$/.test(normalizedPlate)
    ) {
      toast.error("La placa debe tener formato ABC123 o ABC12D.");

      return;
    }

    if (normalizedPlate && !form.vehicleType) {
      toast.error("Selecciona tipo de vehículo para la placa registrada.");

      return;
    }

    try {
      setSaving(true);
      const payload = {
        ...form,
        vehicleType: form.vehicleType || null,
        vehiclePlate: normalizedPlate || null,
        drivingLicenseUrl: form.drivingLicenseUrl.trim() || null,
        drivingLicenseExpiresAt: form.drivingLicenseExpiresAt.trim() || null,
        soatDocumentUrl: form.soatDocumentUrl.trim() || null,
        soatDocumentExpiresAt: form.soatDocumentExpiresAt.trim() || null,
        tecnomecanicaDocumentUrl: form.tecnomecanicaDocumentUrl.trim() || null,
        tecnomecanicaDocumentExpiresAt:
          form.tecnomecanicaDocumentExpiresAt.trim() || null,
        vehicleLicenseDocumentUrl: form.vehicleLicenseDocumentUrl.trim() || null,
        vehicleLicenseDocumentExpiresAt:
          form.vehicleLicenseDocumentExpiresAt.trim() || null,
        email: form.email.trim() || null,
        mobile: form.mobile.trim() || null,
      };

      if (editing) {
        await apiJson("/api/messengers", {
          method: "PUT",
          body: JSON.stringify({ id: editing.id, ...payload }),
        });
        toast.success(`${title.slice(0, -1)} actualizado.`);
      } else {
        await apiJson("/api/messengers", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success(`${title.slice(0, -1)} creado.`);
      }

      setModalOpen(false);
      setEditing(null);
      setForm({ ...INITIAL_FORM, messengerType: defaultType });
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!pendingDelete) return;

    try {
      await apiJson("/api/messengers", {
        method: "DELETE",
        body: JSON.stringify({ id: pendingDelete.id }),
      });
      toast.success(`${title.slice(0, -1)} eliminado.`);
      setConfirmOpen(false);
      setPendingDelete(null);
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Input
          className="sm:w-96"
          label="Buscar"
          placeholder="Código, nombre, identificación, email o placa"
          value={q}
          onValueChange={setQ}
        />
        <div className="flex gap-2">
          <Button variant="flat" onPress={refresh}>
            Actualizar
          </Button>
          <Button
            color="primary"
            isDisabled={!canCreate}
            startContent={<BsPlusCircle />}
            onPress={openCreate}
          >
            Nuevo {title.slice(0, -1)}
          </Button>
        </div>
      </div>

      <Table aria-label={`Tabla de ${title.toLowerCase()}`}>
        <TableHeader>
          <TableColumn>Código</TableColumn>
          <TableColumn>Nombre</TableColumn>
          <TableColumn>Tipo</TableColumn>
          <TableColumn>Identificación</TableColumn>
          <TableColumn>Vehículo / Placa</TableColumn>
          <TableColumn>Contacto</TableColumn>
          <TableColumn>Estado</TableColumn>
          <TableColumn>Acciones</TableColumn>
        </TableHeader>
        <TableBody
          emptyContent={loading ? "" : `Sin ${title.toLowerCase()}`}
          items={rows}
        >
          {(row) => (
            <TableRow key={row.id}>
              <TableCell>{row.messengerCode}</TableCell>
              <TableCell>{row.name}</TableCell>
              <TableCell>{String(row.messengerType ?? "-")}</TableCell>
              <TableCell>
                {row.identificationType} {row.identification}
              </TableCell>
              <TableCell>
                {row.vehicleType ?? "-"} / {row.vehiclePlate ?? "-"}
              </TableCell>
              <TableCell>
                {row.mobile ?? "-"}
                {row.email ? ` · ${row.email}` : ""}
              </TableCell>
              <TableCell>
                {row.isActive ? (
                  <Chip color="success" size="sm" variant="flat">
                    Activo
                  </Chip>
                ) : (
                  <Chip color="default" size="sm" variant="flat">
                    Inactivo
                  </Chip>
                )}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button
                    isIconOnly
                    isDisabled={!canEdit}
                    size="sm"
                    variant="flat"
                    onPress={() => openEdit(row)}
                  >
                    <BsPencilSquare />
                  </Button>
                  <Button
                    isIconOnly
                    color="danger"
                    isDisabled={!canDelete}
                    size="sm"
                    variant="flat"
                    onPress={() => {
                      setPendingDelete(row);
                      setConfirmOpen(true);
                    }}
                  >
                    <BsTrash />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {data ? (
        <Pager
          data={data as Paginated<MessengerRow>}
          page={page}
          onChange={setPage}
        />
      ) : null}

      <Modal
        disableAnimation
        isOpen={modalOpen}
        scrollBehavior="inside"
        size="3xl"
        onOpenChange={setModalOpen}
      >
        <ModalContent>
          <ModalHeader>
            {editing
              ? `Editar ${title.slice(0, -1)}`
              : `Nuevo ${title.slice(0, -1)}`}
          </ModalHeader>
          <ModalBody className="space-y-4 pb-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-default-500">
                Datos básicos
              </p>
            </div>
            <Input
              label="Nombre"
              value={form.name}
              onValueChange={(value) =>
                setForm((prev) => ({ ...prev, name: value }))
              }
            />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Select
                label="Tipo de identificación"
                selectedKeys={[form.identificationType]}
                onSelectionChange={(keys) =>
                  setForm((prev) => ({
                    ...prev,
                    identificationType: String(
                      Array.from(keys)[0] ?? "CC",
                    ) as FormState["identificationType"],
                  }))
                }
              >
                <SelectItem key="CC">CC</SelectItem>
                <SelectItem key="NIT">NIT</SelectItem>
                <SelectItem key="CE">CE</SelectItem>
                <SelectItem key="PAS">PAS</SelectItem>
                <SelectItem key="EMPRESA_EXTERIOR">EMPRESA_EXTERIOR</SelectItem>
              </Select>
              <Input
                label="Identificación"
                value={form.identification}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, identification: value }))
                }
              />
            </div>
            <Input
              label="Dirección"
              value={form.address}
              onValueChange={(value) =>
                setForm((prev) => ({ ...prev, address: value }))
              }
            />
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-default-500">
                Datos de transporte
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Select
                label="Tipo de vehículo"
                placeholder="Selecciona tipo"
                selectedKeys={form.vehicleType ? [form.vehicleType] : []}
                onSelectionChange={(keys) =>
                  setForm((prev) => ({
                    ...prev,
                    vehicleType: normalizeVehicleType(String(Array.from(keys)[0] ?? "")),
                  }))
                }
              >
                {VEHICLE_TYPE_OPTIONS.map((vehicleType) => (
                  <SelectItem key={vehicleType}>{vehicleType}</SelectItem>
                ))}
              </Select>
              <Input
                label="Placa"
                description="Formato: ABC123 o ABC12D"
                maxLength={6}
                value={form.vehiclePlate}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    vehiclePlate: normalizeVehiclePlate(value),
                  }))
                }
              />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input
                label="Email"
                type="email"
                value={form.email}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, email: value }))
                }
              />
              <Input
                label="Móvil"
                value={form.mobile}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, mobile: value }))
                }
              />
            </div>
            <div className="rounded-medium border border-default-200 p-3">
              <p className="mb-3 text-sm font-semibold text-default-700">
                Documentos del transportista y vehículo
              </p>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="space-y-2 rounded-medium border border-default-200 p-3">
                  <FileUpload
                    acceptedFileTypes=".pdf,.jpg,.jpeg,.png"
                    label="Licencia de conducción (persona)"
                    maxSizeMB={10}
                    uploadFolder="messengers"
                    value={form.drivingLicenseUrl}
                    onChange={(url) =>
                      setForm((prev) => ({ ...prev, drivingLicenseUrl: url }))
                    }
                    onClear={() =>
                      setForm((prev) => ({ ...prev, drivingLicenseUrl: "" }))
                    }
                  />
                  <Input
                    label="Fecha de vencimiento"
                    type="date"
                    value={form.drivingLicenseExpiresAt}
                    onValueChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        drivingLicenseExpiresAt: value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2 rounded-medium border border-default-200 p-3">
                  <FileUpload
                    acceptedFileTypes=".pdf,.jpg,.jpeg,.png"
                    label="Licencia del vehículo"
                    maxSizeMB={10}
                    uploadFolder="messengers"
                    value={form.vehicleLicenseDocumentUrl}
                    onChange={(url) =>
                      setForm((prev) => ({
                        ...prev,
                        vehicleLicenseDocumentUrl: url,
                      }))
                    }
                    onClear={() =>
                      setForm((prev) => ({
                        ...prev,
                        vehicleLicenseDocumentUrl: "",
                      }))
                    }
                  />
                  <Input
                    label="Fecha de vencimiento"
                    type="date"
                    value={form.vehicleLicenseDocumentExpiresAt}
                    onValueChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        vehicleLicenseDocumentExpiresAt: value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2 rounded-medium border border-default-200 p-3">
                  <FileUpload
                    acceptedFileTypes=".pdf,.jpg,.jpeg,.png"
                    label="Certificado SOAT"
                    maxSizeMB={10}
                    uploadFolder="messengers"
                    value={form.soatDocumentUrl}
                    onChange={(url) =>
                      setForm((prev) => ({ ...prev, soatDocumentUrl: url }))
                    }
                    onClear={() =>
                      setForm((prev) => ({ ...prev, soatDocumentUrl: "" }))
                    }
                  />
                  <Input
                    label="Fecha de vencimiento"
                    type="date"
                    value={form.soatDocumentExpiresAt}
                    onValueChange={(value) =>
                      setForm((prev) => ({ ...prev, soatDocumentExpiresAt: value }))
                    }
                  />
                </div>
                <div className="space-y-2 rounded-medium border border-default-200 p-3">
                  <FileUpload
                    acceptedFileTypes=".pdf,.jpg,.jpeg,.png"
                    label="Certificado tecnomecánica"
                    maxSizeMB={10}
                    uploadFolder="messengers"
                    value={form.tecnomecanicaDocumentUrl}
                    onChange={(url) =>
                      setForm((prev) => ({
                        ...prev,
                        tecnomecanicaDocumentUrl: url,
                      }))
                    }
                    onClear={() =>
                      setForm((prev) => ({
                        ...prev,
                        tecnomecanicaDocumentUrl: "",
                      }))
                    }
                  />
                  <Input
                    label="Fecha de vencimiento"
                    type="date"
                    value={form.tecnomecanicaDocumentExpiresAt}
                    onValueChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        tecnomecanicaDocumentExpiresAt: value,
                      }))
                    }
                  />
                </div>
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-default-500">
                Estado
              </p>
            </div>
            <Select
              label="Estado"
              selectedKeys={[form.isActive ? "active" : "inactive"]}
              onSelectionChange={(keys) =>
                setForm((prev) => ({
                  ...prev,
                  isActive:
                    String(Array.from(keys)[0] ?? "active") === "active",
                }))
              }
            >
              <SelectItem key="active">Activo</SelectItem>
              <SelectItem key="inactive">Inactivo</SelectItem>
            </Select>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button color="primary" isLoading={saving} onPress={submit}>
              Guardar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <ConfirmActionModal
        confirmLabel="Eliminar"
        description={`¿Seguro que quieres eliminar ${pendingDelete?.name ?? "este registro"}?`}
        isLoading={false}
        isOpen={confirmOpen}
        title="Eliminar registro"
        onConfirm={remove}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) {
            setPendingDelete(null);
          }
        }}
      />
    </div>
  );
}
