"use client";

import type { Confectionist } from "./confectionists-tab";
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
                <div><span className="font-semibold">Activo:</span> {showValue(confectionist.isActive)}</div>
              </div>

              <div className="border-t pt-3 grid grid-cols-2 gap-3">
                <div><span className="font-semibold">Tipo de empaque:</span> {showValue(confectionist.type)}</div>
                <div><span className="font-semibold">Especialidad:</span> {showValue(confectionist.specialty)}</div>
                <div><span className="font-semibold">Capacidad diaria:</span> {showValue(confectionist.dailyCapacity)}</div>
                <div><span className="font-semibold">Régimen fiscal:</span> {showValue(confectionist.taxRegime)}</div>
              </div>

              <div className="border-t pt-3 grid grid-cols-2 gap-3">
                <div><span className="font-semibold">Contacto:</span> {showValue(confectionist.contactName)}</div>
                <div><span className="font-semibold">Email:</span> {showValue(confectionist.email)}</div>
                <div><span className="font-semibold">Código int.:</span> {showValue(confectionist.intlDialCode)}</div>
                <div><span className="font-semibold">Móvil:</span> {showValue(confectionist.mobile)}</div>
                <div><span className="font-semibold">Móvil completo:</span> {showValue(confectionist.fullMobile)}</div>
                <div><span className="font-semibold">Fijo:</span> {showValue(confectionist.landline)}</div>
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

              <div className="border-t pt-3 space-y-2">
                <h4 className="font-semibold">Documentos</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Button
                    isDisabled={!confectionist.identityDocumentUrl}
                    size="sm"
                    variant="flat"
                    onPress={() =>
                      openDocument("Documento de identidad", confectionist.identityDocumentUrl)
                    }
                  >
                    Ver documento de identidad
                  </Button>
                  <Button
                    isDisabled={!confectionist.rutDocumentUrl}
                    size="sm"
                    variant="flat"
                    onPress={() => openDocument("RUT", confectionist.rutDocumentUrl)}
                  >
                    Ver RUT
                  </Button>
                  <Button
                    isDisabled={!confectionist.commerceChamberDocumentUrl}
                    size="sm"
                    variant="flat"
                    onPress={() =>
                      openDocument(
                        "Cámara de comercio",
                        confectionist.commerceChamberDocumentUrl,
                      )
                    }
                  >
                    Ver cámara de comercio
                  </Button>
                  <Button
                    isDisabled={!confectionist.passportDocumentUrl}
                    size="sm"
                    variant="flat"
                    onPress={() =>
                      openDocument("Pasaporte", confectionist.passportDocumentUrl)
                    }
                  >
                    Ver pasaporte
                  </Button>
                  <Button
                    isDisabled={!confectionist.taxCertificateDocumentUrl}
                    size="sm"
                    variant="flat"
                    onPress={() =>
                      openDocument(
                        "Certificado tributario",
                        confectionist.taxCertificateDocumentUrl,
                      )
                    }
                  >
                    Ver certificado tributario
                  </Button>
                  <Button
                    isDisabled={!confectionist.companyIdDocumentUrl}
                    size="sm"
                    variant="flat"
                    onPress={() =>
                      openDocument("ID de empresa", confectionist.companyIdDocumentUrl)
                    }
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
