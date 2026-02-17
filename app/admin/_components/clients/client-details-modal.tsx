"use client";

import type { Client } from "../../_lib/types";

import {
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  ModalFooter,
} from "@heroui/modal";
import { Button } from "@heroui/button";
import { Divider } from "@heroui/divider";
import { Chip } from "@heroui/chip";

export function ClientDetailsModal({
  client,
  isOpen,
  onOpenChange,
}: {
  client: Client | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!client) return null;

  return (
    <Modal
      isOpen={isOpen}
      scrollBehavior="inside"
      size="3xl"
      onOpenChange={onOpenChange}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Chip
              color={
                client.clientType === "NACIONAL"
                  ? "primary"
                  : client.clientType === "EXTRANJERO"
                    ? "secondary"
                    : "warning"
              }
              size="lg"
              variant="flat"
            >
              {client.clientCode}
            </Chip>
            <div className="text-lg font-semibold">{client.name}</div>
          </div>
          <div className="text-sm font-normal text-default-500">
            Detalles completos del cliente
          </div>
        </ModalHeader>
        <ModalBody>
          {/* CÓDIGO Y TIPO */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-default-700">
              Código y tipo de cliente
            </h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <DetailField label="Código del cliente" value={client.clientCode} />
              <DetailField
                label="Tipo de cliente"
                value={
                  client.clientType === "NACIONAL"
                    ? "Nacional"
                    : client.clientType === "EXTRANJERO"
                      ? "Extranjero"
                      : "Empleado"
                }
              />
            </div>
          </div>

          <Divider />

          {/* IDENTIFICACIÓN Y NOMBRE */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-default-700">
              Identificación y Nombre
            </h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <DetailField label="Nombre tercero" value={client.name} />
              <DetailField
                label="Tipo de identificación"
                value={client.identificationType}
              />
              <DetailField
                label="Identificación"
                value={client.identification}
              />
              <DetailField label="Dígito verificación" value={client.dv} />
              <DetailField label="Sucursal" value={client.branch} />
            </div>
          </div>

          <Divider />

          {/* INFORMACIÓN FISCAL Y CONTACTO */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-default-700">
              Información fiscal y contacto
            </h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <DetailField
                label="Régimen fiscal (IVA)"
                value={client.taxRegime}
              />
              <DetailField
                label="Nombre de contacto"
                value={client.contactName}
              />
              <DetailField
                isCritical
                label="Correo electrónico"
                value={client.email}
              />
            </div>
          </div>

          <Divider />

          {/* UBICACIÓN GEOGRÁFICA */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-default-700">
              Ubicación geográfica
            </h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <DetailField label="Dirección" value={client.address} />
              <DetailField label="Código postal" value={client.postalCode} />
              <DetailField label="País" value={client.country} />
              <DetailField label="Departamento" value={client.department} />
              <DetailField label="Ciudad" value={client.city} />
            </div>
          </div>

          <Divider />

          {/* TELÉFONOS Y MARCACIÓN */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-default-700">
              Teléfonos y marcación
            </h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <DetailField
                label="Código internacional"
                value={client.intlDialCode}
              />
              <DetailField isCritical label="Móvil" value={client.mobile} />
              <DetailField label="Móvil completo" value={client.fullMobile} />
              <DetailField
                label="Código marcación local"
                value={client.localDialCode}
              />
              <DetailField label="Fijo" value={client.landline} />
              <DetailField label="Extensión" value={client.extension} />
              <DetailField label="Fijo completo" value={client.fullLandline} />
            </div>
          </div>

          <Divider />

          {/* ESTADO Y CRÉDITO */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-default-700">
              Estado y crédito
            </h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <DetailField
                label="Estado"
                value={
                  client.status || (client.isActive ? "Activo" : "Inactivo")
                }
              />
              <DetailField
                label="Activo (interno)"
                value={client.isActive ? "Sí" : "No"}
              />
              <DetailField
                label="Tiene crédito"
                value={client.hasCredit ? "Sí" : "No"}
              />
              <DetailField
                label="Número pagaré"
                value={client.promissoryNoteNumber}
              />
              <DetailField
                label="Fecha firma pagaré"
                value={
                  client.promissoryNoteDate
                    ? new Date(client.promissoryNoteDate).toLocaleDateString(
                        "es-CO",
                      )
                    : null
                }
              />
              <DetailField
                label="Fecha de registro"
                value={
                  client.createdAt
                    ? new Date(client.createdAt).toLocaleDateString("es-CO")
                    : null
                }
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function DetailField({
  label,
  value,
  isCritical = false,
}: {
  label: string;
  value: string | null | undefined;
  isCritical?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-default-500">
        {label}
        {isCritical && (
          <span className="ml-1 text-danger" title="Campo crítico">
            *
          </span>
        )}
      </dt>
      <dd className="text-sm text-default-700">
        {value && value.trim() !== "" ? value : (
          <span className="text-default-400">Sin información</span>
        )}
      </dd>
    </div>
  );
}
