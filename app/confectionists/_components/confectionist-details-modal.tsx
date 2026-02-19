"use client";

import type { Confectionist } from "./confectionists-tab";

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

export function ConfectionistDetailsModal({
  confectionist,
  isOpen,
  onOpenChange,
  onRequestCreateClient,
  onRequestCreateEmployee,
  onRequestCreateSupplier,
  onRequestCreatePacker,
}: {
  confectionist: Confectionist | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onRequestCreateClient?: () => void;
  onRequestCreateEmployee?: () => void;
  onRequestCreateSupplier?: () => void;
  onRequestCreatePacker?: () => void;
}) {
  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="3xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader>Información completa del confeccionista</ModalHeader>
        <ModalBody className="space-y-4">
          {!confectionist ? (
            <p className="text-default-500">Sin información disponible.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div><span className="font-semibold">Código:</span> {showValue(confectionist.confectionistCode)}</div>
                <div><span className="font-semibold">Nombre:</span> {showValue(confectionist.name)}</div>
                <div><span className="font-semibold">Tipo ID:</span> {showValue(confectionist.identificationType)}</div>
                <div><span className="font-semibold">Identificación:</span> {showValue(confectionist.identification)}</div>
                <div><span className="font-semibold">DV:</span> {showValue(confectionist.dv)}</div>
                <div><span className="font-semibold">Tipo:</span> {showValue(confectionist.type)}</div>
                <div><span className="font-semibold">Régimen fiscal:</span> {showValue(confectionist.taxRegime)}</div>
                <div><span className="font-semibold">Activo:</span> {showValue(confectionist.isActive)}</div>
              </div>

              <div className="border-t pt-3 grid grid-cols-2 gap-3">
                <div><span className="font-semibold">Contacto:</span> {showValue(confectionist.contactName)}</div>
                <div><span className="font-semibold">Email:</span> {showValue(confectionist.email)}</div>
                <div><span className="font-semibold">Código int.:</span> {showValue(confectionist.intlDialCode)}</div>
                <div><span className="font-semibold">Móvil:</span> {showValue(confectionist.mobile)}</div>
                <div><span className="font-semibold">Móvil completo:</span> {showValue(confectionist.fullMobile)}</div>
                <div><span className="font-semibold">Fijo:</span> {showValue(confectionist.landline)}</div>
                <div><span className="font-semibold">Extensión:</span> {showValue(confectionist.extension)}</div>
              </div>

              <div className="border-t pt-3 grid grid-cols-2 gap-3">
                <div><span className="font-semibold">Dirección:</span> {showValue(confectionist.address)}</div>
                <div><span className="font-semibold">Código postal:</span> {showValue(confectionist.postalCode)}</div>
                <div><span className="font-semibold">País:</span> {showValue(confectionist.country)}</div>
                <div><span className="font-semibold">Departamento:</span> {showValue(confectionist.department)}</div>
                <div><span className="font-semibold">Ciudad:</span> {showValue(confectionist.city)}</div>
              </div>

              {confectionist.createdAt && (
                <div className="border-t pt-3">
                  <div><span className="font-semibold">Creado:</span> {new Date(confectionist.createdAt).toLocaleString("es-CO")}</div>
                </div>
              )}
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
          {onRequestCreateSupplier && (
            <Button size="sm" color="primary" variant="flat" onPress={onRequestCreateSupplier}>
              Crear como proveedor
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
