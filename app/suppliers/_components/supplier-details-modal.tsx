"use client";

import type { Supplier } from "./suppliers-tab";

import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { Button } from "@heroui/button";

function showValue(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return String(value);
}

export function SupplierDetailsModal({
  supplier,
  isOpen,
  onOpenChange,
  onRequestCreateClient,
  onRequestCreateEmployee,
  onRequestCreateConfectionist,
  onRequestCreatePacker,
}: {
  supplier: Supplier | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onRequestCreateClient?: () => void;
  onRequestCreateEmployee?: () => void;
  onRequestCreateConfectionist?: () => void;
  onRequestCreatePacker?: () => void;
}) {
  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="3xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader>Información completa del proveedor</ModalHeader>
        <ModalBody className="space-y-4">
          {!supplier ? (
            <p className="text-default-500">Sin información disponible.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div><span className="font-semibold">Código:</span> {showValue(supplier.supplierCode)}</div>
                <div><span className="font-semibold">Nombre:</span> {showValue(supplier.name)}</div>
                <div><span className="font-semibold">Tipo ID:</span> {showValue(supplier.identificationType)}</div>
                <div><span className="font-semibold">Identificación:</span> {showValue(supplier.identification)}</div>
                <div><span className="font-semibold">DV:</span> {showValue(supplier.dv)}</div>
                <div><span className="font-semibold">Sucursal:</span> {showValue(supplier.branch)}</div>
                <div><span className="font-semibold">Régimen fiscal:</span> {showValue(supplier.taxRegime)}</div>
                <div><span className="font-semibold">Activo:</span> {showValue(supplier.isActive)}</div>
              </div>

              <div className="border-t pt-3 grid grid-cols-2 gap-3">
                <div><span className="font-semibold">Contacto:</span> {showValue(supplier.contactName)}</div>
                <div><span className="font-semibold">Email:</span> {showValue(supplier.email)}</div>
                <div><span className="font-semibold">Código int.:</span> {showValue(supplier.intlDialCode)}</div>
                <div><span className="font-semibold">Móvil:</span> {showValue(supplier.mobile)}</div>
                <div><span className="font-semibold">Móvil completo:</span> {showValue(supplier.fullMobile)}</div>
                <div><span className="font-semibold">Código local:</span> {showValue(supplier.localDialCode)}</div>
                <div><span className="font-semibold">Fijo:</span> {showValue(supplier.landline)}</div>
                <div><span className="font-semibold">Extensión:</span> {showValue(supplier.extension)}</div>
                <div><span className="font-semibold">Fijo completo:</span> {showValue(supplier.fullLandline)}</div>
              </div>

              <div className="border-t pt-3 grid grid-cols-2 gap-3">
                <div><span className="font-semibold">Dirección:</span> {showValue(supplier.address)}</div>
                <div><span className="font-semibold">Código postal:</span> {showValue(supplier.postalCode)}</div>
                <div><span className="font-semibold">País:</span> {showValue(supplier.country)}</div>
                <div><span className="font-semibold">Departamento:</span> {showValue(supplier.department)}</div>
                <div><span className="font-semibold">Ciudad:</span> {showValue(supplier.city)}</div>
              </div>

              <div className="border-t pt-3 grid grid-cols-2 gap-3">
                <div><span className="font-semibold">Tiene crédito:</span> {showValue(supplier.hasCredit)}</div>
                <div><span className="font-semibold">Número pagaré:</span> {showValue(supplier.promissoryNoteNumber)}</div>
                <div><span className="font-semibold">Fecha pagaré:</span> {showValue(supplier.promissoryNoteDate)}</div>
              </div>
            </>
          )}
        </ModalBody>
        <ModalFooter className="flex flex-wrap gap-2">
          {onRequestCreateClient && (
            <Button size="sm" color="primary" variant="flat" onPress={onRequestCreateClient}>
              Crear como cliente
            </Button>
          )}
          {onRequestCreateEmployee && (
            <Button size="sm" color="primary" variant="flat" onPress={onRequestCreateEmployee}>
              Crear como empleado
            </Button>
          )}
          {onRequestCreateConfectionist && (
            <Button size="sm" color="primary" variant="flat" onPress={onRequestCreateConfectionist}>
              Crear como confeccionista
            </Button>
          )}
          {onRequestCreatePacker && (
            <Button size="sm" color="primary" variant="flat" onPress={onRequestCreatePacker}>
              Crear como empaque
            </Button>
          )}
          <Button variant="flat" onPress={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
