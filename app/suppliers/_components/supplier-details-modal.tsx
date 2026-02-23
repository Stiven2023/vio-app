"use client";

import type { Supplier } from "./suppliers-tab";
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

              <div className="border-t pt-3 space-y-2">
                <h4 className="font-semibold">Documentos</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Button
                    isDisabled={!supplier.identityDocumentUrl}
                    size="sm"
                    variant="flat"
                    onPress={() => openDocument("Documento de identidad", supplier.identityDocumentUrl)}
                  >
                    Ver documento de identidad
                  </Button>
                  <Button
                    isDisabled={!supplier.rutDocumentUrl}
                    size="sm"
                    variant="flat"
                    onPress={() => openDocument("RUT", supplier.rutDocumentUrl)}
                  >
                    Ver RUT
                  </Button>
                  <Button
                    isDisabled={!supplier.commerceChamberDocumentUrl}
                    size="sm"
                    variant="flat"
                    onPress={() =>
                      openDocument("Cámara de comercio", supplier.commerceChamberDocumentUrl)
                    }
                  >
                    Ver cámara de comercio
                  </Button>
                  <Button
                    isDisabled={!supplier.passportDocumentUrl}
                    size="sm"
                    variant="flat"
                    onPress={() => openDocument("Pasaporte", supplier.passportDocumentUrl)}
                  >
                    Ver pasaporte
                  </Button>
                  <Button
                    isDisabled={!supplier.taxCertificateDocumentUrl}
                    size="sm"
                    variant="flat"
                    onPress={() =>
                      openDocument("Certificado tributario", supplier.taxCertificateDocumentUrl)
                    }
                  >
                    Ver certificado tributario
                  </Button>
                  <Button
                    isDisabled={!supplier.companyIdDocumentUrl}
                    size="sm"
                    variant="flat"
                    onPress={() => openDocument("ID de empresa", supplier.companyIdDocumentUrl)}
                  >
                    Ver ID empresa
                  </Button>
                  <Button
                    isDisabled={!supplier.bankCertificateUrl}
                    size="sm"
                    variant="flat"
                    onPress={() =>
                      openDocument("Comprobante bancario", supplier.bankCertificateUrl)
                    }
                  >
                    Ver comprobante bancario
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

      <ClientDocumentsPreviewModal
        documentLabel={selectedDocument.label}
        documentUrl={selectedDocument.url}
        isOpen={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </Modal>
  );
}
