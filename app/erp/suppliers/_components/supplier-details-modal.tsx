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
import { ClientDocumentsPreviewModal } from "@/app/erp/admin/_components/clients/client-documents-preview-modal";

function showValue(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
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
        <ModalHeader>Full supplier information</ModalHeader>
        <ModalBody className="space-y-4">
          {!supplier ? (
            <p className="text-default-500">No information available.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div><span className="font-semibold">Code:</span> {showValue(supplier.supplierCode)}</div>
                <div><span className="font-semibold">Name:</span> {showValue(supplier.name)}</div>
                <div><span className="font-semibold">ID Type:</span> {showValue(supplier.identificationType)}</div>
                <div><span className="font-semibold">Identification:</span> {showValue(supplier.identification)}</div>
                <div><span className="font-semibold">DV:</span> {showValue(supplier.dv)}</div>
                <div><span className="font-semibold">Branch:</span> {showValue(supplier.branch)}</div>
                <div><span className="font-semibold">Tax regime:</span> {showValue(supplier.taxRegime)}</div>
                <div><span className="font-semibold">Active:</span> {showValue(supplier.isActive)}</div>
              </div>

              <div className="border-t pt-3 grid grid-cols-2 gap-3">
                <div><span className="font-semibold">Contact:</span> {showValue(supplier.contactName)}</div>
                <div><span className="font-semibold">Email:</span> {showValue(supplier.email)}</div>
                <div><span className="font-semibold">Int. code:</span> {showValue(supplier.intlDialCode)}</div>
                <div><span className="font-semibold">Mobile:</span> {showValue(supplier.mobile)}</div>
                <div><span className="font-semibold">Full mobile:</span> {showValue(supplier.fullMobile)}</div>
                <div><span className="font-semibold">Local code:</span> {showValue(supplier.localDialCode)}</div>
                <div><span className="font-semibold">Landline:</span> {showValue(supplier.landline)}</div>
                <div><span className="font-semibold">Extension:</span> {showValue(supplier.extension)}</div>
                <div><span className="font-semibold">Full landline:</span> {showValue(supplier.fullLandline)}</div>
              </div>

              <div className="border-t pt-3 grid grid-cols-2 gap-3">
                <div><span className="font-semibold">Address:</span> {showValue(supplier.address)}</div>
                <div><span className="font-semibold">Postal code:</span> {showValue(supplier.postalCode)}</div>
                <div><span className="font-semibold">Country:</span> {showValue(supplier.country)}</div>
                <div><span className="font-semibold">Department:</span> {showValue(supplier.department)}</div>
                <div><span className="font-semibold">City:</span> {showValue(supplier.city)}</div>
              </div>

              <div className="border-t pt-3 grid grid-cols-2 gap-3">
                <div><span className="font-semibold">Has credit:</span> {showValue(supplier.hasCredit)}</div>
                <div><span className="font-semibold">Promissory note #:</span> {showValue(supplier.promissoryNoteNumber)}</div>
                <div><span className="font-semibold">Promissory note date:</span> {showValue(supplier.promissoryNoteDate)}</div>
              </div>

              <div className="border-t pt-3 space-y-2">
                <h4 className="font-semibold">Documents</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Button
                    isDisabled={!supplier.identityDocumentUrl}
                    size="sm"
                    variant="flat"
                    onPress={() => openDocument("Documento de identidad", supplier.identityDocumentUrl)}
                  >
                    View identity document
                  </Button>
                  <Button
                    isDisabled={!supplier.rutDocumentUrl}
                    size="sm"
                    variant="flat"
                    onPress={() => openDocument("RUT", supplier.rutDocumentUrl)}
                  >
                    View RUT
                  </Button>
                  <Button
                    isDisabled={!supplier.commerceChamberDocumentUrl}
                    size="sm"
                    variant="flat"
                    onPress={() =>
                      openDocument("Cámara de comercio", supplier.commerceChamberDocumentUrl)
                    }
                  >
                    View chamber of commerce
                  </Button>
                  <Button
                    isDisabled={!supplier.passportDocumentUrl}
                    size="sm"
                    variant="flat"
                    onPress={() => openDocument("Pasaporte", supplier.passportDocumentUrl)}
                  >
                    View passport
                  </Button>
                  <Button
                    isDisabled={!supplier.taxCertificateDocumentUrl}
                    size="sm"
                    variant="flat"
                    onPress={() =>
                      openDocument("Certificado tributario", supplier.taxCertificateDocumentUrl)
                    }
                  >
                    View tax certificate
                  </Button>
                  <Button
                    isDisabled={!supplier.companyIdDocumentUrl}
                    size="sm"
                    variant="flat"
                    onPress={() => openDocument("ID de empresa", supplier.companyIdDocumentUrl)}
                  >
                    View company ID
                  </Button>
                  <Button
                    isDisabled={!supplier.bankCertificateUrl}
                    size="sm"
                    variant="flat"
                    onPress={() =>
                      openDocument("Comprobante bancario", supplier.bankCertificateUrl)
                    }
                  >
                    View bank certificate
                  </Button>
                </div>
              </div>
            </>
          )}
        </ModalBody>
        <ModalFooter className="flex flex-wrap gap-2">
          {onRequestCreateClient && (
            <Button size="sm" color="primary" variant="flat" onPress={onRequestCreateClient}>
              Create as client
            </Button>
          )}
          {onRequestCreateEmployee && (
            <Button size="sm" color="primary" variant="flat" onPress={onRequestCreateEmployee}>
              Create as employee
            </Button>
          )}
          {onRequestCreateConfectionist && (
            <Button size="sm" color="primary" variant="flat" onPress={onRequestCreateConfectionist}>
              Create as confectionist
            </Button>
          )}
          {onRequestCreatePacker && (
            <Button size="sm" color="primary" variant="flat" onPress={onRequestCreatePacker}>
              Create as packer
            </Button>
          )}
          <Button variant="flat" onPress={() => onOpenChange(false)}>
            Close
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
