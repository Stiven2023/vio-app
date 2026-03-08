"use client";

import type { Employee } from "../../_lib/types";

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
  BsDownload,
  BsExclamationCircle,
} from "react-icons/bs";

export function EmployeeDocumentsModal({
  employee,
  isOpen,
  onOpenChange,
}: {
  employee: Employee | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!employee) return null;

  const documents: Array<{
    label: string;
    url: string | null | undefined;
    required: boolean;
  }> = [
    { label: "Cédula", url: employee.identityDocumentUrl, required: true },
    { label: "Hoja de vida", url: employee.hojaDeVidaUrl, required: true },
    { label: "Certificado laboral", url: employee.certificadoLaboralUrl, required: true },
    { label: "Certificado de estudios", url: employee.certificadoEstudiosUrl, required: true },
    { label: "Certificado EPS", url: employee.epsCertificateUrl, required: true },
    { label: "Certificado de pensión", url: employee.pensionCertificateUrl, required: true },
    { label: "Certificado bancario", url: employee.bankCertificateUrl, required: true },
  ];

  const downloadDocument = (url: string | null | undefined) => {
    if (!url) {
      toast.error("El documento no tiene URL válida");
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.click();
  };

  const hasDocuments = documents.some((doc) => Boolean(doc.url));

  return (
    <Modal
      isOpen={isOpen}
      scrollBehavior="inside"
      size="2xl"
      onOpenChange={onOpenChange}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          Documentos de {employee.name}
          <p className="text-sm font-normal text-default-500">
            {employee.identificationType} - {employee.identification}
          </p>
        </ModalHeader>
        <Divider />
        <ModalBody className="gap-4 py-6">
          {!hasDocuments ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10">
              <BsExclamationCircle className="text-4xl text-warning" />
              <p className="text-center text-default-600">
                Este empleado no tiene documentos cargados.
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
                          {doc.required && <span className="text-danger">Requerido</span>}
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
                        onPress={() => downloadDocument(doc.url)}
                        title="Descargar documento"
                      >
                        <BsDownload />
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
    </Modal>
  );
}
