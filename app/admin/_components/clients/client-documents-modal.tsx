"use client";

import type { Client } from "../../_lib/types";

import { useState } from "react";
import toast from "react-hot-toast";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  ModalFooter,
} from "@heroui/modal";
import { Button } from "@heroui/button";
import { Divider } from "@heroui/divider";
import { Card, CardBody } from "@heroui/card";
import {
  BsFileEarmarkPdf,
  BsEye,
  BsExclamationCircle,
} from "react-icons/bs";

import { ClientDocumentsPreviewModal } from "./client-documents-preview-modal";

export function ClientDocumentsModal({
  client,
  isOpen,
  onOpenChange,
}: {
  client: Client | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLabel, setPreviewLabel] = useState("");
  
  if (!client) return null;

  // Matriz de documentos según identificationType
  const documents: Array<{
    label: string;
    url: string | null | undefined;
    required: boolean;
  }> = [];

  // CC - Persona Natural Nacional
  if (client.identificationType === "CC") {
    documents.push(
      { label: "Cédula del titular", url: client.identityDocumentUrl, required: true },
      { label: "RUT", url: client.rutDocumentUrl, required: true }
    );
  }

  // NIT - Empresa Nacional
  if (client.identificationType === "NIT") {
    documents.push(
      { label: "RUT empresa", url: client.rutDocumentUrl, required: true },
      { label: "Cámara de Comercio", url: client.commerceChamberDocumentUrl, required: true },
      { label: "Cédula representante legal", url: client.identityDocumentUrl, required: true }
    );
  }

  // CE - Persona Natural Extranjera (Cédula de Extranjería)
  if (client.identificationType === "CE") {
    documents.push(
      { label: "Cédula de extranjería", url: client.identityDocumentUrl, required: true },
      { label: "Pasaporte", url: client.passportDocumentUrl, required: true }
    );
  }

  // PAS - Persona Natural Extranjera (Pasaporte)
  if (client.identificationType === "PAS") {
    documents.push(
      { label: "Documento de identidad", url: client.identityDocumentUrl, required: true },
      { label: "Pasaporte", url: client.passportDocumentUrl, required: true }
    );
  }

  // EMPRESA_EXTERIOR - Empresa Extranjera
  if (client.identificationType === "EMPRESA_EXTERIOR") {
    documents.push(
      { label: "Pasaporte del representante", url: client.passportDocumentUrl, required: true },
      { label: "Certificado tributario", url: client.taxCertificateDocumentUrl, required: true },
      { label: "ID de la empresa", url: client.companyIdDocumentUrl, required: true }
    );
  }

  const handlePreview = (url: string | null | undefined, label: string) => {
    if (!url) {
      toast.error("El documento no tiene URL válida");
      return;
    }
    
    setPreviewUrl(url);
    setPreviewLabel(label);
    setPreviewOpen(true);
  };

  // Obtener descripción del tipo de identificación
  const getIdentificationTypeDescription = () => {
    switch (client.identificationType) {
      case "CC":
        return "Persona Natural Nacional (CC)";
      case "NIT":
        return "Empresa Nacional (NIT)";
      case "CE":
        return "Persona Natural Extranjera (CE)";
      case "PAS":
        return "Persona Natural Extranjera (Pasaporte)";
      case "EMPRESA_EXTERIOR":
        return "Empresa Extranjera";
      default:
        return client.identificationType || "Tipo desconocido";
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      scrollBehavior="inside"
      size="2xl"
      onOpenChange={onOpenChange}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          Documentos de {client.name}
          <p className="text-sm font-normal text-default-500">
            {getIdentificationTypeDescription()}
          </p>
        </ModalHeader>
        <Divider />
        <ModalBody className="gap-4 py-6">
          {documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10">
              <BsExclamationCircle className="text-4xl text-warning" />
              <p className="text-center text-default-600">
                No hay documentos configurados para este tipo de cliente
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((doc, idx) => (
                <Card
                  key={idx}
                  className={
                    doc.url
                      ? "bg-success-50 border-success-200"
                      : "bg-danger-50 border-danger-200"
                  }
                >
                  <CardBody className="flex flex-row items-center justify-between gap-3 p-4">
                    <div className="flex items-center gap-3">
                      <BsFileEarmarkPdf
                        className={
                          doc.url ? "text-success text-xl" : "text-danger text-xl"
                        }
                      />
                      <div className="flex flex-col gap-1">
                        <p className="font-medium text-foreground">{doc.label}</p>
                        <p className="text-xs text-default-500">
                          {doc.required && (
                            <span className="text-danger">Requerido</span>
                          )}
                          {doc.url && (
                            <span className="text-success">
                              {doc.required && " • "}
                              Subido
                            </span>
                          )}
                          {!doc.url && (
                            <span className="text-danger">Pendiente</span>
                          )}
                        </p>
                      </div>
                    </div>
                    {doc.url ? (
                      <Button
                        isIconOnly
                        size="sm"
                        variant="flat"
                        color="success"
                        onPress={() => handlePreview(doc.url, doc.label)}
                        title="Ver documento"
                      >
                        <BsEye />
                      </Button>
                    ) : null}
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </ModalBody>
        <Divider />
        <ModalFooter>
          <Button color="default" onPress={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </ModalFooter>
      </ModalContent>

      <ClientDocumentsPreviewModal
        documentUrl={previewUrl}
        documentLabel={previewLabel}
        isOpen={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </Modal>
  );
}
