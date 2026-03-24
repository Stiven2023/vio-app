"use client";

import React, { useState } from "react";
import { toast } from "react-hot-toast";
import {
  Button,
  Card,
  CardBody,
  Chip,
  Divider,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Textarea,
} from "@heroui/react";
import { MdCheckCircle, MdWarning } from "react-icons/md";

type RepoItemType = "PIEZA" | "PRENDA";
type RepoReason = "FALTANTE" | "DAÑO" | "INCORRECTO";

type PlotterRepoWizardProps = {
  isOpen: boolean;
  orderCode: string;
  designName: string;
  size: string | null;
  expectedQty: number;
  producedQty: number;
  onClose: () => void;
  onRepoGenerated: (ticketRef: string) => void;
};

export function PlotterRepoWizard({
  isOpen,
  orderCode,
  designName,
  size,
  expectedQty,
  producedQty,
  onClose,
  onRepoGenerated,
}: PlotterRepoWizardProps) {
  const [step, setStep] = useState<
    "confirm" | "launched" | "repo_ask" | "repo_form" | "done"
  >("confirm");
  const [launchedMissing, setLaunchedMissing] = useState<boolean | null>(null);
  const [needsRepo, setNeedsRepo] = useState<boolean | null>(null);
  const [repoItemType, setRepoItemType] = useState<RepoItemType>("PIEZA");
  const [repoReason, setRepoReason] = useState<RepoReason>("FALTANTE");
  const [repoNotes, setRepoNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [generatedTicket, setGeneratedTicket] = useState<string | null>(null);

  const missing = expectedQty - producedQty;

  const reset = () => {
    setStep("confirm");
    setLaunchedMissing(null);
    setNeedsRepo(null);
    setRepoItemType("PIEZA");
    setRepoReason("FALTANTE");
    setRepoNotes("");
    setGeneratedTicket(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleConfirmPartial = (answer: boolean) => {
    if (!answer) {
      // User says quantities DO match - close
      handleClose();

      return;
    }
    setStep("launched");
  };

  const handleLaunched = (launched: boolean) => {
    setLaunchedMissing(launched);
    setStep("repo_ask");
  };

  const handleNeedsRepo = (needs: boolean) => {
    setNeedsRepo(needs);
    if (!needs) {
      handleClose();

      return;
    }
    setStep("repo_form");
  };

  const generateRepoTicket = async () => {
    if (saving) return;

    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/operative-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleArea: "OPERARIOS",
          operationType: "PLOTTER",
          orderCode,
          designName,
          size: size || null,
          quantityOp: missing,
          producedQuantity: 0,
          isComplete: false,
          isPartial: true,
          repoCheck: true,
          processCode: "P",
          observations: [
            "[TICKET_REPOSICION_PLOTTER]",
            `Tipo: ${repoItemType}`,
            `Razón: ${repoReason}`,
            launchedMissing ? "Faltante lanzado: SÍ" : "Faltante lanzado: NO",
            repoNotes.trim() ? `Notas: ${repoNotes.trim()}` : null,
          ]
            .filter(Boolean)
            .join(" | "),
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(String(data?.message ?? "No se pudo crear el ticket"));
      }

      const ticketRef = `REPO-PLO-${String(data?.id ?? "")
        .slice(0, 8)
        .toUpperCase()}`;

      setGeneratedTicket(ticketRef);
      setStep("done");
      onRepoGenerated(ticketRef);
      toast.success(`Ticket de reposición ${ticketRef} generado`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al generar ticket",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      disableAnimation
      isOpen={isOpen}
      size="md"
      onOpenChange={(open) => !open && handleClose()}
    >
      <ModalContent>
        <>
          <ModalHeader className="flex items-center gap-2">
            <MdWarning className="text-warning" size={20} />
            <span>Alerta de cantidad – Plotter</span>
          </ModalHeader>

          <ModalBody className="gap-4 py-4">
            {step === "confirm" && (
              <>
                <Card
                  className="border border-warning-200 bg-warning-50"
                  radius="sm"
                  shadow="none"
                >
                  <CardBody className="gap-1 py-3">
                    <p className="text-sm font-medium text-warning-800">
                      La cantidad producida no coincide con lo esperado
                    </p>
                    <div className="flex gap-4 mt-1">
                      <div>
                        <p className="text-xs text-default-500">Esperado</p>
                        <p className="text-lg font-bold">{expectedQty}</p>
                      </div>
                      <div>
                        <p className="text-xs text-default-500">Producido</p>
                        <p className="text-lg font-bold text-danger">
                          {producedQty}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-default-500">Faltante</p>
                        <p className="text-lg font-bold text-warning">
                          {missing}
                        </p>
                      </div>
                    </div>
                  </CardBody>
                </Card>
                <p className="text-sm text-default-600">
                  ¿La cantidad producida es realmente parcial?
                </p>
              </>
            )}

            {step === "launched" && (
              <p className="text-sm text-default-600">
                ¿Ya lanzaste el faltante de{" "}
                <strong>{missing} unidad(es)</strong>?
              </p>
            )}

            {step === "repo_ask" && (
              <>
                {launchedMissing !== null && (
                  <Chip
                    color={launchedMissing ? "success" : "warning"}
                    size="sm"
                    variant="flat"
                  >
                    Faltante lanzado: {launchedMissing ? "SÍ" : "NO"}
                  </Chip>
                )}
                <p className="text-sm text-default-600">
                  ¿Necesitas generar un ticket de reposición?
                </p>
              </>
            )}

            {step === "repo_form" && (
              <div className="space-y-3">
                <p className="text-sm font-medium">
                  Datos del ticket de reposición
                </p>
                <Divider />
                <Select
                  disallowEmptySelection
                  label="¿Qué se va a reponer?"
                  selectedKeys={[repoItemType]}
                  size="sm"
                  onSelectionChange={(keys) =>
                    setRepoItemType(Array.from(keys)[0] as RepoItemType)
                  }
                >
                  <SelectItem key="PIEZA">PIEZA</SelectItem>
                  <SelectItem key="PRENDA">PRENDA</SelectItem>
                </Select>
                <Select
                  disallowEmptySelection
                  label="Razón de la reposición"
                  selectedKeys={[repoReason]}
                  size="sm"
                  onSelectionChange={(keys) =>
                    setRepoReason(Array.from(keys)[0] as RepoReason)
                  }
                >
                  <SelectItem key="FALTANTE">FALTANTE</SelectItem>
                  <SelectItem key="DAÑO">DAÑO</SelectItem>
                  <SelectItem key="INCORRECTO">INCORRECTO</SelectItem>
                </Select>
                <Textarea
                  label="Observaciones adicionales"
                  placeholder="Describe el problema..."
                  size="sm"
                  value={repoNotes}
                  onValueChange={setRepoNotes}
                />
                <div className="rounded-medium bg-default-50 border border-default-200 p-3 text-xs text-default-500 space-y-1">
                  <p>
                    <strong>Pedido:</strong> {orderCode}
                  </p>
                  <p>
                    <strong>Diseño:</strong> {designName}
                  </p>
                  {size && (
                    <p>
                      <strong>Talla:</strong> {size}
                    </p>
                  )}
                  <p>
                    <strong>Unidades a reponer:</strong> {missing}
                  </p>
                </div>
              </div>
            )}

            {step === "done" && generatedTicket && (
              <div className="text-center space-y-3 py-4">
                <MdCheckCircle className="mx-auto text-success" size={48} />
                <p className="text-base font-semibold">¡Gracias!</p>
                <p className="text-sm text-default-600">
                  Ticket de reposición{" "}
                  <Chip color="secondary" size="sm" variant="flat">
                    {generatedTicket}
                  </Chip>{" "}
                  generado correctamente.
                </p>
              </div>
            )}
          </ModalBody>

          <ModalFooter>
            {step === "confirm" && (
              <>
                <Button size="sm" variant="flat" onPress={handleClose}>
                  No, las cantidades sí coinciden
                </Button>
                <Button
                  color="warning"
                  size="sm"
                  onPress={() => handleConfirmPartial(true)}
                >
                  Sí, es parcial
                </Button>
              </>
            )}

            {step === "launched" && (
              <>
                <Button
                  size="sm"
                  variant="flat"
                  onPress={() => handleLaunched(false)}
                >
                  No
                </Button>
                <Button
                  color="primary"
                  size="sm"
                  onPress={() => handleLaunched(true)}
                >
                  Sí
                </Button>
              </>
            )}

            {step === "repo_ask" && (
              <>
                <Button
                  size="sm"
                  variant="flat"
                  onPress={() => handleNeedsRepo(false)}
                >
                  No
                </Button>
                <Button
                  color="primary"
                  size="sm"
                  onPress={() => handleNeedsRepo(true)}
                >
                  Sí
                </Button>
              </>
            )}

            {step === "repo_form" && (
              <>
                <Button size="sm" variant="flat" onPress={handleClose}>
                  Cancelar
                </Button>
                <Button
                  color="primary"
                  isDisabled={saving}
                  size="sm"
                  onPress={() => void generateRepoTicket()}
                >
                  {saving ? "Generando..." : "Generar ticket de reposición"}
                </Button>
              </>
            )}

            {step === "done" && (
              <Button color="success" size="sm" onPress={handleClose}>
                Cerrar
              </Button>
            )}
          </ModalFooter>
        </>
      </ModalContent>
    </Modal>
  );
}
