"use client";

import type {
  OrderItemPositionInput,
  OrderItemSpecialRequirementInput,
  OrderItemTeamInput,
  Position,
} from "@/app/erp/orders/_lib/order-item-types";

import React from "react";
import Image from "next/image";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";

const POSITION_OPTIONS: Position[] = [
  "JUGADOR",
  "ARQUERO",
  "CAPITAN",
  "JUEZ",
  "ENTRENADOR",
  "LIBERO",
  "ADICIONAL",
];

const PIECE_OPTIONS = ["FRONTAL", "LATERAL", "TRASERA"] as const;

function asNumber(v: unknown) {
  const n = Number(String(v ?? "0"));

  return Number.isFinite(n) ? n : 0;
}

export function OrderItemStructuresSection(props: {
  disabled: boolean;
  requiresPositions: boolean;
  totalQuantity?: number;
  positions: OrderItemPositionInput[];
  teams: OrderItemTeamInput[];
  specialRequirements: OrderItemSpecialRequirementInput[];
  onPositionsChange: (next: OrderItemPositionInput[]) => void;
  onTeamsChange: (next: OrderItemTeamInput[]) => void;
  onSpecialRequirementsChange: (
    next: OrderItemSpecialRequirementInput[],
  ) => void;
  onTeamImageFileSelect?: (args: {
    teamIndex: number;
    field: "playerImageUrl" | "goalkeeperImageUrl" | "fullSetImageUrl";
    file: File;
  }) => void;
}) {
  const {
    disabled,
    requiresPositions,
    totalQuantity,
    positions,
    teams,
    specialRequirements,
    onPositionsChange,
    onTeamsChange,
    onSpecialRequirementsChange,
    onTeamImageFileSelect,
  } = props;

  const [previewImage, setPreviewImage] = React.useState<{
    url: string;
    label: string;
  } | null>(null);

  React.useEffect(() => {
    if (!previewImage) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPreviewImage(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewImage]);

  const renderTeamImageField = (args: {
    label: string;
    url: string;
    field: "playerImageUrl" | "goalkeeperImageUrl" | "fullSetImageUrl";
    teamIndex: number;
  }) => (
    <div className="space-y-1">
      <div className="text-xs text-default-500">{args.label}</div>
      <input
        accept="image/*"
        className="block w-full text-sm"
        disabled={disabled}
        type="file"
        onChange={(e) => {
          const file = e.target.files?.[0];

          if (!file || !onTeamImageFileSelect) return;
          onTeamImageFileSelect({
            teamIndex: args.teamIndex,
            field: args.field,
            file,
          });
        }}
      />
      {args.url ? (
        <div className="flex items-center gap-2">
          <button
            className="h-14 w-14 overflow-hidden rounded border border-default-300"
            type="button"
            onClick={() =>
              setPreviewImage({
                url: args.url,
                label: args.label,
              })
            }
          >
            <span className="relative block h-full w-full">
              <Image
                fill
                unoptimized
                alt={args.label}
                className="object-cover"
                sizes="56px"
                src={args.url}
              />
            </span>
          </button>
          <a
            className="text-xs text-primary underline"
            href={args.url}
            rel="noreferrer"
            target="_blank"
          >
            Abrir en pestaña nueva
          </a>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-4 notranslate" translate="no">
      <div className="rounded-medium border border-default-200 bg-default-50 px-3 py-2 text-xs text-default-600">
        Usa este bloque para definir posiciones y cantidades, combinaciones por equipo y requerimientos especiales de confección del diseño.
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Posiciones y cantidades</div>
          <Button
            isDisabled={disabled || !requiresPositions}
            size="sm"
            variant="flat"
            onPress={() =>
              onPositionsChange([
                ...positions,
                {
                  position: "JUGADOR",
                  quantity: 0,
                  color: "",
                  sortOrder: positions.length + 1,
                },
              ])
            }
          >
            Agregar posición
          </Button>
        </div>

        {!requiresPositions ? (
          <div className="text-xs text-default-500">
            Esta sección solo se configura cuando el diseño es conjunto + arquero.
          </div>
        ) : null}

        {requiresPositions ? (
          <div className="text-xs text-primary">
            Total configurado: {positions.reduce((acc, row) => acc + Math.max(0, Math.floor(asNumber(row.quantity))), 0)} / {Math.max(0, Math.floor(asNumber(totalQuantity)))}
          </div>
        ) : null}

        {requiresPositions && positions.length === 0 ? (
          <div className="text-xs text-default-500">
            Sin posiciones configuradas.
          </div>
        ) : null}

        {requiresPositions ? positions.map((row, idx) => (
          <div key={idx} className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Select
              isDisabled={disabled}
              label="Posición"
              selectedKeys={row.position ? [row.position] : []}
              onSelectionChange={(keys: any) => {
                const k = String(
                  Array.from(keys as any)[0] ?? "JUGADOR",
                ) as Position;

                onPositionsChange(
                  positions.map((x, i) =>
                    i === idx ? { ...x, position: k } : x,
                  ),
                );
              }}
            >
              {POSITION_OPTIONS.map((opt) => (
                <SelectItem key={opt}>{opt}</SelectItem>
              ))}
            </Select>

            <Input
              isDisabled={disabled}
              label="Cantidad"
              type="number"
              value={String(row.quantity ?? 0)}
              onValueChange={(v) =>
                onPositionsChange(
                  positions.map((x, i) =>
                    i === idx
                      ? { ...x, quantity: Math.max(0, Math.floor(asNumber(v))) }
                      : x,
                  ),
                )
              }
            />

            <Input
              isDisabled={disabled}
              label="Color"
              value={String(row.color ?? "")}
              onValueChange={(v) =>
                onPositionsChange(
                  positions.map((x, i) => (i === idx ? { ...x, color: v } : x)),
                )
              }
            />

            <Button
              color="danger"
              isDisabled={disabled}
              variant="flat"
              onPress={() =>
                onPositionsChange(positions.filter((_, i) => i !== idx))
              }
            >
              Quitar
            </Button>
          </div>
        )) : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Combinaciones por equipo</div>
          <Button
            isDisabled={disabled}
            size="sm"
            variant="flat"
            onPress={() =>
              onTeamsChange([
                ...teams,
                {
                  name: "",
                  playerColor: "",
                  goalkeeperColor: "",
                  socksColor: "",
                  playerImageUrl: "",
                  goalkeeperImageUrl: "",
                  fullSetImageUrl: "",
                  sortOrder: teams.length + 1,
                },
              ])
            }
          >
            Agregar equipo
          </Button>
        </div>

        {teams.length === 0 ? (
          <div className="text-xs text-default-500">
            Sin equipos configurados.
          </div>
        ) : null}

        {teams.map((row, idx) => (
          <div key={idx} className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Input
              isDisabled={disabled}
              label="Nombre equipo"
              value={String(row.name ?? "")}
              onValueChange={(v) =>
                onTeamsChange(
                  teams.map((x, i) => (i === idx ? { ...x, name: v } : x)),
                )
              }
            />
            <Input
              isDisabled={disabled}
              label="Color jugador"
              value={String(row.playerColor ?? "")}
              onValueChange={(v) =>
                onTeamsChange(
                  teams.map((x, i) =>
                    i === idx ? { ...x, playerColor: v } : x,
                  ),
                )
              }
            />
            <Input
              isDisabled={disabled}
              label="Color arquero"
              value={String(row.goalkeeperColor ?? "")}
              onValueChange={(v) =>
                onTeamsChange(
                  teams.map((x, i) =>
                    i === idx ? { ...x, goalkeeperColor: v } : x,
                  ),
                )
              }
            />
            <Input
              isDisabled={disabled}
              label="Color medias"
              value={String(row.socksColor ?? "")}
              onValueChange={(v) =>
                onTeamsChange(
                  teams.map((x, i) =>
                    i === idx ? { ...x, socksColor: v } : x,
                  ),
                )
              }
            />

            {renderTeamImageField({
              label: "Imagen jugador",
              url: String(row.playerImageUrl ?? ""),
              field: "playerImageUrl",
              teamIndex: idx,
            })}
            {renderTeamImageField({
              label: "Imagen arquero",
              url: String(row.goalkeeperImageUrl ?? ""),
              field: "goalkeeperImageUrl",
              teamIndex: idx,
            })}
            {renderTeamImageField({
              label: "Imagen conjunto",
              url: String(row.fullSetImageUrl ?? ""),
              field: "fullSetImageUrl",
              teamIndex: idx,
            })}
            <Button
              color="danger"
              isDisabled={disabled}
              variant="flat"
              onPress={() => onTeamsChange(teams.filter((_, i) => i !== idx))}
            >
              Quitar
            </Button>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Requerimientos especiales de confección</div>
          <Button
            isDisabled={disabled}
            size="sm"
            variant="flat"
            onPress={() =>
              onSpecialRequirementsChange([
                ...specialRequirements,
                {
                  piece: "FRONTAL",
                  fabric: "",
                  fabricColor: "",
                  hasReflectiveTape: false,
                  reflectiveTapeLocation: "",
                  hasSideStripes: false,
                  notes: "",
                },
              ])
            }
          >
            Agregar detalle
          </Button>
        </div>

        {specialRequirements.length === 0 ? (
          <div className="text-xs text-default-500">
            Sin requerimientos especiales.
          </div>
        ) : null}

        {specialRequirements.map((row, idx) => (
          <div
            key={idx}
            className="rounded-medium border border-default-200 p-3 space-y-3"
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Select
                isDisabled={disabled}
                label="Pieza"
                selectedKeys={row.piece ? [String(row.piece)] : []}
                onSelectionChange={(keys: any) => {
                  const k = String(Array.from(keys as any)[0] ?? "FRONTAL");

                  onSpecialRequirementsChange(
                    specialRequirements.map((x, i) =>
                      i === idx ? { ...x, piece: k } : x,
                    ),
                  );
                }}
              >
                {PIECE_OPTIONS.map((opt) => (
                  <SelectItem key={opt}>{opt}</SelectItem>
                ))}
              </Select>

              <Input
                isDisabled={disabled}
                label="Tela"
                value={String(row.fabric ?? "")}
                onValueChange={(v) =>
                  onSpecialRequirementsChange(
                    specialRequirements.map((x, i) =>
                      i === idx ? { ...x, fabric: v } : x,
                    ),
                  )
                }
              />

              <Input
                isDisabled={disabled}
                label="Color tela"
                value={String(row.fabricColor ?? "")}
                onValueChange={(v) =>
                  onSpecialRequirementsChange(
                    specialRequirements.map((x, i) =>
                      i === idx ? { ...x, fabricColor: v } : x,
                    ),
                  )
                }
              />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Switch
                isDisabled={disabled}
                isSelected={Boolean(row.hasReflectiveTape)}
                onValueChange={(v) =>
                  onSpecialRequirementsChange(
                    specialRequirements.map((x, i) =>
                      i === idx ? { ...x, hasReflectiveTape: v } : x,
                    ),
                  )
                }
              >
                Tiene cinta reflectiva
              </Switch>

              <Switch
                isDisabled={disabled}
                isSelected={Boolean(row.hasSideStripes)}
                onValueChange={(v) =>
                  onSpecialRequirementsChange(
                    specialRequirements.map((x, i) =>
                      i === idx ? { ...x, hasSideStripes: v } : x,
                    ),
                  )
                }
              >
                Tiene franjas laterales
              </Switch>

              <Switch
                isDisabled={disabled}
                isSelected={Boolean(row.hasCordon)}
                onValueChange={(v) =>
                  onSpecialRequirementsChange(
                    specialRequirements.map((x, i) =>
                      i === idx ? { ...x, hasCordon: v } : x,
                    ),
                  )
                }
              >
                Tiene cordón
              </Switch>

              <Switch
                isDisabled={disabled}
                isSelected={Boolean(row.hasElastic)}
                onValueChange={(v) =>
                  onSpecialRequirementsChange(
                    specialRequirements.map((x, i) =>
                      i === idx ? { ...x, hasElastic: v } : x,
                    ),
                  )
                }
              >
                Tiene elástico
              </Switch>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input
                isDisabled={disabled}
                label="Cierre"
                value={String(row.closureType ?? "")}
                onValueChange={(v) =>
                  onSpecialRequirementsChange(
                    specialRequirements.map((x, i) =>
                      i === idx ? { ...x, closureType: v } : x,
                    ),
                  )
                }
              />

              <Select
                isDisabled={disabled}
                label="Cantidad de cierres"
                selectedKeys={
                  row.closureQuantity
                    ? [String(row.closureQuantity)]
                    : ["NONE"]
                }
                onSelectionChange={(keys: any) => {
                  const key = String(Array.from(keys as any)[0] ?? "NONE");
                  const nextValue = key === "NONE" ? null : Number(key);

                  onSpecialRequirementsChange(
                    specialRequirements.map((x, i) =>
                      i === idx
                        ? {
                            ...x,
                            closureQuantity:
                              nextValue === 1 || nextValue === 2 || nextValue === 4
                                ? nextValue
                                : null,
                          }
                        : x,
                    ),
                  );
                }}
              >
                <SelectItem key="NONE">No aplica</SelectItem>
                <SelectItem key="1">1</SelectItem>
                <SelectItem key="2">2</SelectItem>
                <SelectItem key="4">4</SelectItem>
              </Select>
            </div>

            <Input
              isDisabled={disabled}
              label="Lugar cinta reflectiva"
              value={String(row.reflectiveTapeLocation ?? "")}
              onValueChange={(v) =>
                onSpecialRequirementsChange(
                  specialRequirements.map((x, i) =>
                    i === idx ? { ...x, reflectiveTapeLocation: v } : x,
                  ),
                )
              }
            />

            <Input
              isDisabled={disabled}
              label="Notas"
              value={String(row.notes ?? "")}
              onValueChange={(v) =>
                onSpecialRequirementsChange(
                  specialRequirements.map((x, i) =>
                    i === idx ? { ...x, notes: v } : x,
                  ),
                )
              }
            />

            <div className="flex justify-end">
              <Button
                color="danger"
                isDisabled={disabled}
                variant="flat"
                onPress={() =>
                  onSpecialRequirementsChange(
                    specialRequirements.filter((_, i) => i !== idx),
                  )
                }
              >
                Quitar requerimiento
              </Button>
            </div>
          </div>
        ))}
      </div>

      {previewImage ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          tabIndex={-1}
        >
          <button
            aria-label="Cerrar vista previa"
            className="absolute inset-0"
            type="button"
            onClick={() => setPreviewImage(null)}
          />
          <div className="relative max-h-[90vh] max-w-[90vw] rounded-lg bg-content1 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-sm font-medium">{previewImage.label}</div>
              <Button
                size="sm"
                variant="flat"
                onPress={() => setPreviewImage(null)}
              >
                Cerrar
              </Button>
            </div>
            <div className="relative h-[78vh] w-[86vw] max-h-[78vh] max-w-[86vw]">
              <Image
                fill
                unoptimized
                alt={previewImage.label}
                className="rounded object-contain"
                sizes="86vw"
                src={previewImage.url}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
