"use client";

import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { BsEye, BsExclamationCircle, BsFileEarmarkPdf } from "react-icons/bs";

type ThirdPartyDocument = {
  label: string;
  url: string | null | undefined;
};

export function ThirdPartyDocumentsModal({
  title,
  subtitle,
  emptyMessage,
  documents,
  isOpen,
  onOpenChange,
}: {
  title: string;
  subtitle?: string;
  emptyMessage: string;
  documents: ThirdPartyDocument[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const hasDocuments = documents.some((doc) => Boolean(doc.url));

  return (
    <Modal isOpen={isOpen} size="2xl" scrollBehavior="inside" onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          {title}
          {subtitle ? (
            <p className="text-sm font-normal text-default-500">{subtitle}</p>
          ) : null}
        </ModalHeader>
        <Divider />
        <ModalBody className="gap-4 py-6">
          {!hasDocuments ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10">
              <BsExclamationCircle className="text-4xl text-warning" />
              <p className="text-center text-default-600">{emptyMessage}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <Card
                  key={doc.label}
                  className={
                    doc.url
                      ? "bg-success-50 border-success-200"
                      : "bg-danger-50 border-danger-200"
                  }
                >
                  <CardBody className="flex flex-row items-center justify-between gap-3 p-4">
                    <div className="flex items-center gap-3">
                      <BsFileEarmarkPdf
                        className={doc.url ? "text-success text-xl" : "text-danger text-xl"}
                      />
                      <div className="flex flex-col gap-1">
                        <p className="font-medium text-foreground">{doc.label}</p>
                        <p className="text-xs text-default-500">
                          {doc.url ? (
                            <span className="text-success">Subido</span>
                          ) : (
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
                        onPress={() => window.open(String(doc.url), "_blank", "noopener,noreferrer")}
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
    </Modal>
  );
}
