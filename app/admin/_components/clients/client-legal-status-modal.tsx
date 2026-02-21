"use client";

import { useState, useEffect } from "react";
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
import { Select, SelectItem } from "@heroui/select";
import { Textarea, Input } from "@heroui/input";
import { Chip } from "@heroui/chip";
import {
  BsShieldCheck,
  BsShieldExclamation,
  BsShieldX,
  BsClipboard,
} from "react-icons/bs";
import type { Client, ClientLegalStatusRecord } from "../../_lib/types";
import { updateClientLegalStatus, getClientLegalStatusHistory, shouldClientBeActive } from "../../_lib/client-legal-status";

const statusConfig = {
  VIGENTE: {
    label: "Vigente",
    color: "success" as const,
    icon: BsShieldCheck,
    description: "Sin problemas, puede operar",
  },
  EN_REVISION: {
    label: "En Revisión",
    color: "warning" as const,
    icon: BsShieldExclamation,
    description: "Bajo revisión, operación pendiente",
  },
  BLOQUEADO: {
    label: "Bloqueado",
    color: "danger" as const,
    icon: BsShieldX,
    description: "Bloqueado, no puede operar",
  },
};

export function ClientLegalStatusModal({
  client,
  isOpen,
  onOpenChange,
}: {
  client: Client | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [status, setStatus] = useState<"VIGENTE" | "EN_REVISION" | "BLOQUEADO">("VIGENTE");
  const [notes, setNotes] = useState("");
  const [reviewedBy, setReviewedBy] = useState("");
  const [history, setHistory] = useState<ClientLegalStatusRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !client) return;

    const fetchHistory = async () => {
      setLoading(true);
      try {
        const data = await getClientLegalStatusHistory(client.id);
        setHistory(data || []);
        
        // Pre-llenar con el estado más reciente
        if (data && data.length > 0) {
          const latest = data[0];
          setStatus(latest.status);
          setNotes(latest.notes || "");
          setReviewedBy(latest.reviewedBy || "");
        }
      } catch (error) {
        console.error("Error cargando historial:", error);
        toast.error("No se pudo cargar el historial");
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [isOpen, client]);

  const handleSave = async () => {
    if (!client) return;
    
    setSaving(true);
    try {
      await updateClientLegalStatus(client.id, {
        status,
        notes: notes || undefined,
        reviewedBy: reviewedBy || undefined,
      });

      toast.success("Estado jurídico actualizado");
      
      // Recargar historial
      const data = await getClientLegalStatusHistory(client.id);
      setHistory(data || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al actualizar");
    } finally {
      setSaving(false);
    }
  };

  // Guard clause después de todos los hooks
  if (!client) return null;

  const currentConfig = statusConfig[status];
  const CurrentIcon = currentConfig.icon;

  return (
    <Modal isOpen={isOpen} size="3xl" onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader className="flex gap-2">
          <CurrentIcon className="text-xl" />
          <span>Estado Jurídico - {client.name}</span>
        </ModalHeader>
        <Divider />
        <ModalBody className="gap-4 py-6">
          {/* Estado Actual */}
          <Card className="bg-default-50 border border-default-200">
            <CardBody className="gap-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Estado Actual</span>
                <Chip
                  color={currentConfig.color}
                  variant="flat"
                >
                  {currentConfig.label}
                </Chip>
              </div>
              <p className="text-xs text-default-500">
                {currentConfig.description}
              </p>
            </CardBody>
          </Card>

          {/* Formulario */}
          <div className="space-y-4">
            <Select
              label="Cambiar Estado"
              selectedKeys={[status]}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as "VIGENTE" | "EN_REVISION" | "BLOQUEADO";
                setStatus(selected);
              }}
              className="max-w-xs"
            >
              {Object.entries(statusConfig).map(([key, config]) => (
                <SelectItem key={key}>
                  {config.label}
                </SelectItem>
              ))}
            </Select>
            <Textarea
              label="Notas / Observaciones"
              placeholder="Detalles del estado, motivo del cambio, etc."
              value={notes}
              onValueChange={setNotes}
              minRows={3}
            />

            <input
              type="text"
              placeholder="Revisado por (usuario/nombre)"
              value={reviewedBy}
              onChange={(e) => setReviewedBy(e.target.value)}
              className="w-full px-3 py-2 bg-default-100 border border-default-200 rounded-lg text-sm"
            />
          </div>

          {/* Advertencia de desactivación automática */}
          {status !== "VIGENTE" && (
            <Card className="bg-warning-50 border border-warning-200">
              <CardBody className="gap-2 p-3">
                <div className="flex items-start gap-2">
                  <span className="text-lg">⚠️</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-warning-900">
                      Cliente será desactivado automáticamente
                    </p>
                    <p className="text-xs text-warning-800 mt-1">
                      {status === "EN_REVISION"
                        ? "El cliente no podrá operar mientras su estado esté en revisión."
                        : "El cliente no podrá operar mientras esté bloqueado."}
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Historial */}
          {history.length > 0 && (
            <>
              <Divider />
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <BsClipboard className="text-default-500" />
                  </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {history.map((record) => {
                    const config = statusConfig[record.status];
                    const Icon = config.icon;
                    return (
                      <Card key={record.id} className="bg-default-50">
                        <CardBody className="gap-2 p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Icon className="text-lg" />
                              <span className="font-medium text-sm">
                                {config.label}
                              </span>
                            </div>
                            <span className="text-xs text-default-500">
                              {record.reviewedAt
                                ? new Date(record.reviewedAt).toLocaleDateString("es-CO")
                                : "Sin fecha"}
                            </span>
                          </div>
                          {record.reviewedBy && (
                            <p className="text-xs text-default-600">
                              <strong>Revisado por:</strong> {record.reviewedBy}
                            </p>
                          )}
                          {record.notes && (
                            <p className="text-xs text-default-600 mt-1">
                              {record.notes}
                            </p>
                          )}
                          {record.changedFields && (
                            <div className="mt-2 pt-2 border-t border-default-200">
                              <p className="text-xs font-semibold text-default-600 mb-1">
                                📝 Campos modificados:
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {(() => {
                                  try {
                                    const fields = JSON.parse(record.changedFields);
                                    return fields.map((field: string) => (
                                      <span
                                        key={field}
                                        className="text-xs bg-warning-100 text-warning-800 px-2 py-1 rounded"
                                      >
                                        {field}
                                      </span>
                                    ));
                                  } catch {
                                    return (
                                      <span className="text-xs text-default-500">
                                        {record.changedFields}
                                      </span>
                                    );
                                  }
                                })()}
                              </div>
                            </div>
                          )}
                        </CardBody>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </ModalBody>
        <Divider />
        <ModalFooter>
          <Button color="default" onPress={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button
            color="primary"
            onPress={handleSave}
            isLoading={saving}
            isDisabled={loading}
          >
            Guardar Cambio
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
