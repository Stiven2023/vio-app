"use client";

import type { Packer } from "./packers-tab";
import { useState } from "react";

import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { Button } from "@heroui/button";
import { ClientDocumentsPreviewModal } from "@/app/admin/_components/clients/client-documents-preview-modal";

function showValue(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return String(value);
}

export function PackerDetailsModal({
  packer,
  isOpen,
  onOpenChange,
  onRequestCreateClient,
  onRequestCreateEmployee,
  onRequestCreateSupplier,
  onRequestCreateConfectionist,
}: {
  packer: Packer | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onRequestCreateClient?: () => void;
  onRequestCreateEmployee?: () => void;
  onRequestCreateSupplier?: () => void;
  onRequestCreateConfectionist?: () => void;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<{
    label: string;
    url: string | null;
  }>({ label: "", url: null });

  const openDocument = (label: string, url: string | null | undefined) => {
    if (!url) return;
    setSelectedDocument({ label, url });
    setPreviewOpen(true);
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="3xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader>Información completa de empaque</ModalHeader>
        <ModalBody className="space-y-4">
          {!packer ? (
            <p className="text-default-500">Sin información disponible.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div><span className="font-semibold">Código:</span> {showValue(packer.packerCode)}</div>
                <div><span className="font-semibold">Nombre:</span> {showValue(packer.name)}</div>
                <div><span className="font-semibold">Tipo ID:</span> {showValue(packer.identificationType)}</div>
                <div><span className="font-semibold">Identificación:</span> {showValue(packer.identification)}</div>
                <div><span className="font-semibold">DV:</span> {showValue(packer.dv)}</div>
                <div><span className="font-semibold">Activo:</span> {showValue(packer.isActive)}</div>
              </div>

              <div className="border-t pt-3 grid grid-cols-2 gap-3">
                <div><span className="font-semibold">Tipo de empaque:</span> {showValue(packer.packerType)}</div>
                <div><span className="font-semibold">Especialidad:</span> {showValue(packer.specialty)}</div>
                <div><span className="font-semibold">Capacidad diaria:</span> {showValue(packer.dailyCapacity)}</div>
              </div>

              <div className="border-t pt-3 grid grid-cols-2 gap-3">
                <div><span className="font-semibold">Contacto:</span> {showValue(packer.contactName)}</div>
                <div><span className="font-semibold">Email:</span> {showValue(packer.email)}</div>
                <div><span className="font-semibold">Código int.:</span> {showValue(packer.intlDialCode)}</div>
                <div><span className="font-semibold">Móvil:</span> {showValue(packer.mobile)}</div>
                <div><span className="font-semibold">Móvil completo:</span> {showValue(packer.fullMobile)}</div>
                <div><span className="font-semibold">Fijo:</span> {showValue(packer.landline)}</div>
              </div>

              <div className="border-t pt-3 grid grid-cols-2 gap-3">
                <div><span className="font-semibold">Dirección:</span> {showValue(packer.address)}</div>
                <div><span className="font-semibold">Código postal:</span> {showValue(packer.postalCode)}</div>
                <div><span className="font-semibold">Ciudad:</span> {showValue(packer.city)}</div>
                <div><span className="font-semibold">Departamento:</span> {showValue(packer.department)}</div>
              </div>

              <div className="border-t pt-3 space-y-2">
                <h4 className="font-semibold">Documentos</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Button
                    isDisabled={!packer.identityDocumentUrl}
                    size="sm"
                    variant="flat"
                    onPress={() => openDocument("Documento de identidad", packer.identityDocumentUrl)}
                  >
                    Ver documento de identidad
                  </Button>
                  <Button
                    isDisabled={!packer.rutDocumentUrl}
                    size="sm"
                    variant="flat"
                    onPress={() => openDocument("RUT", packer.rutDocumentUrl)}
                  >
                    Ver RUT
                  </Button>
                  <Button
                    isDisabled={!packer.commerceChamberDocumentUrl}
                    size="sm"
                    variant="flat"
                    onPress={() =>
                      openDocument("Cámara de comercio", packer.commerceChamberDocumentUrl)
                    }
                  >
                    Ver cámara de comercio
                  </Button>
                  <Button
                    isDisabled={!packer.passportDocumentUrl}
                    size="sm"
                    variant="flat"
                    onPress={() => openDocument("Pasaporte", packer.passportDocumentUrl)}
                  >
                    Ver pasaporte
                  </Button>
                  <Button
                    isDisabled={!packer.taxCertificateDocumentUrl}
                    size="sm"
                    variant="flat"
                    onPress={() =>
                      openDocument("Certificado tributario", packer.taxCertificateDocumentUrl)
                    }
                  >
                    Ver certificado tributario
                  </Button>
                  <Button
                    isDisabled={!packer.companyIdDocumentUrl}
                    size="sm"
                    variant="flat"
                    onPress={() => openDocument("ID de empresa", packer.companyIdDocumentUrl)}
                  >
                    Ver ID empresa
                  </Button>
                </div>
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
          {onRequestCreateSupplier && (
            <Button size="sm" color="primary" variant="flat" onPress={onRequestCreateSupplier}>
              Crear como proveedor
            </Button>
          )}
          {onRequestCreateConfectionist && (
            <Button size="sm" color="primary" variant="flat" onPress={onRequestCreateConfectionist}>
              Crear como confeccionista
            </Button>
          )}
          <Button variant="flat" onPress={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </ModalFooter>
      </ModalContent>

      <ClientDocumentsPreviewModal
        documentLabel={selectedDocument.label}
        documentUrl={selectedDocument.url}
        isOpen={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </Modal>
  );
}
