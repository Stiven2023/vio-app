"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { BsBuilding, BsGeoAlt, BsHash, BsInfoCircle } from "react-icons/bs";

import { apiJson, getErrorMessage } from "@/app/erp/catalog/_lib/api";

export type WarehouseRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  purpose: string | null;
  isVirtual: boolean;
  isExternal: boolean;
  address: string | null;
  city: string | null;
  department: string | null;
  isActive: boolean;
  createdAt: string | null;
};

const WAREHOUSE_PURPOSES = [
  { value: "GENERAL", label: "General" },
  { value: "MATERIA_PRIMA", label: "Materia Prima" },
  { value: "PRODUCCION", label: "Producción" },
  { value: "PRODUCTO_TERMINADO", label: "Producto Terminado" },
  { value: "TRANSITO", label: "En Tránsito" },
];

export function WarehouseModal({
  warehouse,
  isOpen,
  onOpenChange,
  onSaved,
}: {
  warehouse: WarehouseRow | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [purpose, setPurpose] = useState("GENERAL");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Medellín");
  const [department, setDepartment] = useState("ANTIOQUIA");
  const [isVirtual, setIsVirtual] = useState(false);
  const [isExternal, setIsExternal] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setCode(warehouse?.code ?? "");
    setName(warehouse?.name ?? "");
    setDescription(warehouse?.description ?? "");
    setPurpose(warehouse?.purpose ?? "GENERAL");
    setAddress(warehouse?.address ?? "");
    setCity(warehouse?.city ?? "Medellín");
    setDepartment(warehouse?.department ?? "ANTIOQUIA");
    setIsVirtual(Boolean(warehouse?.isVirtual));
    setIsExternal(Boolean(warehouse?.isExternal));
    setIsActive(warehouse?.isActive ?? true);
    setSubmitting(false);
  }, [warehouse, isOpen]);

  const submit = async () => {
    if (submitting) return;

    const payload = {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      description: description.trim() || undefined,
      purpose,
      address: address.trim() || undefined,
      city: city.trim() || undefined,
      department: department.trim() || undefined,
      isVirtual,
      isExternal,
      isActive,
    };

    if (!payload.code) {
      toast.error("Code is required");

      return;
    }

    if (!payload.name) {
      toast.error("Name is required");

      return;
    }

    try {
      setSubmitting(true);
      await apiJson("/api/warehouses", {
        method: warehouse ? "PUT" : "POST",
        body: JSON.stringify(
          warehouse ? { id: warehouse.id, ...payload } : payload,
        ),
      });

      toast.success(warehouse ? "Bodega actualizada" : "Bodega creada");
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal disableAnimation isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>
          {warehouse ? "Editar bodega" : "Crear bodega"}
        </ModalHeader>
        <ModalBody>
          <Input
            label="Código"
            startContent={<BsHash className="text-default-400" />}
            value={code}
            onValueChange={setCode}
          />
          <Input
            label="Nombre"
            startContent={<BsBuilding className="text-default-400" />}
            value={name}
            onValueChange={setName}
          />
          <Input
            label="Descripción"
            startContent={<BsInfoCircle className="text-default-400" />}
            value={description}
            onValueChange={setDescription}
          />
          <Select
            label="Propósito / Tipo de bodega"
            selectedKeys={[purpose]}
            onSelectionChange={(keys) =>
              setPurpose(Array.from(keys)[0] as string)
            }
          >
            {WAREHOUSE_PURPOSES.map((p) => (
              <SelectItem key={p.value}>{p.label}</SelectItem>
            ))}
          </Select>
          <Input
            label="Dirección"
            startContent={<BsGeoAlt className="text-default-400" />}
            value={address}
            onValueChange={setAddress}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Ciudad" value={city} onValueChange={setCity} />
            <Input
              label="Departamento"
              value={department}
              onValueChange={setDepartment}
            />
          </div>

          <Switch isSelected={isVirtual} onValueChange={setIsVirtual}>
            Bodega virtual
          </Switch>
          <Switch isSelected={isExternal} onValueChange={setIsExternal}>
            Bodega externa
          </Switch>
          <Switch isSelected={isActive} onValueChange={setIsActive}>
            Activa
          </Switch>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button color="primary" isDisabled={submitting} onPress={submit}>
            {warehouse ? "Guardar" : "Crear"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
