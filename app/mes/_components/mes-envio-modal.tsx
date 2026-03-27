"use client";

/**
 * MesEnvioModal — Formulario de envío entre áreas MES
 * Usado en: Integración→Confección, Confección→Viomar, Despacho
 */
import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { Chip } from "@heroui/chip";

export type EnvioArea =
  | "VIOMAR"
  | "INTEGRACION"
  | "CONFECCION_EXTERNA"
  | "DESPACHO";

export type TransporteTipo =
  | "MENSAJERO"
  | "CONDUCTOR_PROPIO"
  | "LINEA_TERCERO";

export type EnvioItem = {
  orderItemId: string;
  name: string;
  quantity: number;
};

export type MesEnvioModalProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  origenArea: EnvioArea;
  destinoArea: EnvioArea;
  /** Label visible al usuario para el origen */
  origenLabel?: string;
  /** Label visible al usuario para el destino */
  destinoLabel?: string;
  /** Diseños disponibles para incluir en el envío */
  availableItems: EnvioItem[];
  onCreated?: () => void;
};

const TRANSPORT_OPTIONS: { value: TransporteTipo; label: string }[] = [
  { value: "MENSAJERO", label: "Mensajero" },
  { value: "CONDUCTOR_PROPIO", label: "Conductor propio" },
  { value: "LINEA_TERCERO", label: "Línea de transporte (tercero)" },
];

function getErrorMessage(e: unknown) {
  return e instanceof Error ? e.message : String(e ?? "Error desconocido");
}

export function MesEnvioModal({
  isOpen,
  onOpenChange,
  orderId,
  origenArea,
  destinoArea,
  origenLabel,
  destinoLabel,
  availableItems,
  onCreated,
}: MesEnvioModalProps) {
  const [transporteTipo, setTransporteTipo] =
    useState<TransporteTipo>("MENSAJERO");
  const [transportistaNombre, setTransportistaNombre] = useState("");
  const [empresaTercero, setEmpresaTercero] = useState("");
  const [guiaNumero, setGuiaNumero] = useState("");
  const [placa, setPlaca] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [requiereSegundaParada, setRequiereSegundaParada] = useState(false);
  const [segundaParadaTipo, setSegundaParadaTipo] = useState("");
  const [segundaParadaDestino, setSegundaParadaDestino] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(
    () => new Set(availableItems.map((i) => i.orderItemId)),
  );
  const [submitting, setSubmitting] = useState(false);

  const toggleItem = (id: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const reset = () => {
    setTransporteTipo("MENSAJERO");
    setTransportistaNombre("");
    setEmpresaTercero("");
    setGuiaNumero("");
    setPlaca("");
    setObservaciones("");
    setRequiereSegundaParada(false);
    setSegundaParadaTipo("");
    setSegundaParadaDestino("");
    setSelectedItemIds(new Set(availableItems.map((i) => i.orderItemId)));
    setSubmitting(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const submit = async () => {
    if (submitting) return;

    if (selectedItemIds.size === 0) {
      toast.error("Selecciona al menos un diseño para incluir en el envío");
      return;
    }

    if (
      transporteTipo === "LINEA_TERCERO" &&
      !empresaTercero.trim()
    ) {
      toast.error("Ingresa el nombre de la empresa de transporte");
      return;
    }

    const items = availableItems
      .filter((i) => selectedItemIds.has(i.orderItemId))
      .map((i) => ({ orderItemId: i.orderItemId, quantity: i.quantity }));

    try {
      setSubmitting(true);
      const res = await fetch("/api/mes/envios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          origenArea,
          origenNombre: origenLabel ?? origenArea,
          destinoArea,
          destinoNombre: destinoLabel ?? destinoArea,
          transporteTipo,
          transportistaNombre: transportistaNombre.trim() || null,
          empresaTercero: empresaTercero.trim() || null,
          guiaNumero: guiaNumero.trim() || null,
          placa: placa.trim() || null,
          requiereSegundaParada,
          segundaParadaTipo: segundaParadaTipo.trim() || null,
          segundaParadaDestino: segundaParadaDestino.trim() || null,
          observaciones: observaciones.trim() || null,
          items,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Error al crear el envío");
      }

      toast.success("Envío registrado correctamente");
      handleOpenChange(false);
      onCreated?.();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      scrollBehavior="inside"
      size="2xl"
      onOpenChange={handleOpenChange}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <span>Registrar envío</span>
          <span className="text-sm font-normal text-default-500">
            {origenLabel ?? origenArea} → {destinoLabel ?? destinoArea}
          </span>
        </ModalHeader>

        <ModalBody className="gap-4">
          {/* Diseños a incluir */}
          <div>
            <p className="mb-2 text-sm font-medium">Diseños en el envío</p>
            <div className="flex flex-wrap gap-2">
              {availableItems.map((item) => (
                <Chip
                  key={item.orderItemId}
                  className="cursor-pointer"
                  color={
                    selectedItemIds.has(item.orderItemId) ? "primary" : "default"
                  }
                  variant={
                    selectedItemIds.has(item.orderItemId) ? "solid" : "bordered"
                  }
                  onClick={() => toggleItem(item.orderItemId)}
                >
                  {item.name} ({item.quantity})
                </Chip>
              ))}
            </div>
          </div>

          {/* Transporte */}
          <Select
            label="Tipo de transporte"
            selectedKeys={[transporteTipo]}
            onSelectionChange={(keys) => {
              const first = Array.from(keys)[0] as TransporteTipo;
              setTransporteTipo(first ?? "MENSAJERO");
            }}
          >
            {TRANSPORT_OPTIONS.map((o) => (
              <SelectItem key={o.value}>{o.label}</SelectItem>
            ))}
          </Select>

          {transporteTipo !== "LINEA_TERCERO" && (
            <Input
              label="Nombre del transportista"
              placeholder="Ej. Juan Pérez"
              value={transportistaNombre}
              onValueChange={setTransportistaNombre}
            />
          )}

          {transporteTipo === "LINEA_TERCERO" && (
            <Input
              isRequired
              label="Empresa de transporte"
              placeholder="Ej. Coordinadora, Servientrega"
              value={empresaTercero}
              onValueChange={setEmpresaTercero}
            />
          )}

          {transporteTipo === "CONDUCTOR_PROPIO" && (
            <Input
              label="Placa del vehículo"
              placeholder="Ej. ABC-123"
              value={placa}
              onValueChange={setPlaca}
            />
          )}

          <Input
            label="N° guía / remisión (opcional)"
            placeholder="Ej. GU-000123"
            value={guiaNumero}
            onValueChange={setGuiaNumero}
          />

          {/* Segunda parada */}
          <div className="flex items-center gap-3">
            <Switch
              isSelected={requiereSegundaParada}
              onValueChange={setRequiereSegundaParada}
            >
              Requiere segunda parada
            </Switch>
          </div>

          {requiereSegundaParada && (
            <>
              <Input
                label="Tipo de segunda parada"
                placeholder="Ej. Bordadora, Estampadora"
                value={segundaParadaTipo}
                onValueChange={setSegundaParadaTipo}
              />
              <Input
                label="Destino segunda parada"
                placeholder="Dirección o nombre"
                value={segundaParadaDestino}
                onValueChange={setSegundaParadaDestino}
              />
            </>
          )}

          <Textarea
            label="Observaciones"
            placeholder="Instrucciones adicionales, referencias..."
            value={observaciones}
            onValueChange={setObservaciones}
          />
        </ModalBody>

        <ModalFooter>
          <Button
            variant="light"
            onPress={() => handleOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            color="primary"
            isLoading={submitting}
            onPress={submit}
          >
            Registrar envío
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
