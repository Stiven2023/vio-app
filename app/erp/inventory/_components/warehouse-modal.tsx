"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
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
  isVirtual: boolean;
  isExternal: boolean;
  address: string | null;
  city: string | null;
  department: string | null;
  isActive: boolean;
  createdAt: string | null;
};

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
      address: address.trim() || undefined,
      city: city.trim() || undefined,
      department: department.trim() || undefined,
      isVirtual,
      isExternal,
      isActive,
    };

    if (!payload.code) {
      toast.error("Code required");
      return;
    }

    if (!payload.name) {
      toast.error("Name required");
      return;
    }

    try {
      setSubmitting(true);
      await apiJson("/api/warehouses", {
        method: warehouse ? "PUT" : "POST",
        body: JSON.stringify(warehouse ? { id: warehouse.id, ...payload } : payload),
      });

      toast.success(warehouse ? "Warehouse updated" : "Warehouse created");
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>{warehouse ? "Edit warehouse" : "Create warehouse"}</ModalHeader>
        <ModalBody>
          <Input
            label="Code"
            startContent={<BsHash className="text-default-400" />}
            value={code}
            onValueChange={setCode}
          />
          <Input
            label="Name"
            startContent={<BsBuilding className="text-default-400" />}
            value={name}
            onValueChange={setName}
          />
          <Input
            label="Description"
            startContent={<BsInfoCircle className="text-default-400" />}
            value={description}
            onValueChange={setDescription}
          />
          <Input
            label="Address"
            startContent={<BsGeoAlt className="text-default-400" />}
            value={address}
            onValueChange={setAddress}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="City" value={city} onValueChange={setCity} />
            <Input label="Department" value={department} onValueChange={setDepartment} />
          </div>

          <Switch isSelected={isVirtual} onValueChange={setIsVirtual}>
            Virtual warehouse
          </Switch>
          <Switch isSelected={isExternal} onValueChange={setIsExternal}>
            External warehouse
          </Switch>
          <Switch isSelected={isActive} onValueChange={setIsActive}>
            Active
          </Switch>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button color="primary" isLoading={submitting} onPress={submit}>
            {warehouse ? "Save" : "Create"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
