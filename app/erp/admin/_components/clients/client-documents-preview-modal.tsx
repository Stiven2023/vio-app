"use client";

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
import { BsDownload, BsFileEarmarkPdf } from "react-icons/bs";
import toast from "react-hot-toast";

export function ClientDocumentsPreviewModal({
  documentUrl,
  documentLabel,
  isOpen,
  onOpenChange,
}: {
  documentUrl: string | null;
  documentLabel: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!documentUrl) return null;

  const handleDownload = async () => {
    if (!documentUrl) {
      toast.error("URL del documento inválida");
      return;
    }

    try {
      toast.loading("Descargando documento...");
      
      // Usar el endpoint proxy del servidor con la ruta local
      const proxyUrl = `/api/documents/download?path=${encodeURIComponent(documentUrl)}`;
      
      const link = document.createElement("a");
      link.href = proxyUrl;
      link.setAttribute("download", `${documentLabel}.pdf`);
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setTimeout(() => {
        toast.dismiss();
        toast.success("Documento descargado");
      }, 500);
    } catch (error) {
      console.error("Error al descargar:", error);
      toast.dismiss();
      toast.error("No se pudo descargar el documento");
    }
  };

  return (
    <Modal isOpen={isOpen} size="2xl" onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <BsFileEarmarkPdf className="text-primary text-xl" />
          <span>{documentLabel}</span>
        </ModalHeader>
        <Divider />
        <ModalBody className="py-6">
          <Card className="bg-default-50">
            <CardBody className="flex flex-col items-center justify-center gap-4 p-8">
              <BsFileEarmarkPdf className="text-6xl text-default-300" />
              <div className="text-center">
                <p className="font-semibold text-foreground">{documentLabel}</p>
                <p className="text-sm text-default-500 mt-2">
                  Para visualizar el documento, descárgalo en tu dispositivo
                </p>
              </div>
              <Button
                color="primary"
                size="lg"
                startContent={<BsDownload />}
                onPress={handleDownload}
                className="mt-4"
              >
                Descargar PDF
              </Button>
            </CardBody>
          </Card>
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
