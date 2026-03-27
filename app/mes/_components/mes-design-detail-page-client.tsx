"use client";

import type { DesignFullView } from "@/src/types/design-overview";

import React from "react";
import Image from "next/image";
import NextLink from "next/link";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? "Error");
}

export function MesDesignDetailPageClient(props: { orderItemId: string }) {
  const { orderItemId } = props;
  const [data, setData] = React.useState<DesignFullView | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;

    setLoading(true);
    setError(null);
    setData(null);

    fetch(`/api/mes/designs/${orderItemId}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(await response.text());

        return (await response.json()) as DesignFullView;
      })
      .then((payload) => {
        if (!active) return;
        setData(payload);
      })
      .catch((fetchError) => {
        if (!active) return;
        setError(toErrorMessage(fetchError));
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [orderItemId]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-4 pb-6 pt-4 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">MES design detail</h1>
          <p className="text-sm text-default-500">
            Snapshot completo del diseno para operacion y compras.
          </p>
        </div>
        <Button as={NextLink} href="/mes" variant="flat">
          Volver a MES
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 rounded-medium border border-default-200 p-4">
          <Spinner size="sm" />
          <span className="text-sm text-default-600">Cargando snapshot...</span>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-medium border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700">
          {error}
        </div>
      ) : null}

      {data ? (
        <>
          <Card className="border border-divider" radius="sm" shadow="none">
            <CardHeader className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-lg font-semibold">{data.designName}</div>
                <div className="text-sm text-default-500">
                  Pedido {data.orderCode} · Qty {data.quantity}
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                <Chip size="sm" variant="flat">
                  {data.productionTechnique ?? "SIN_TECNICA"}
                </Chip>
                <Chip size="sm" variant="flat">
                  {data.process ?? "SIN_PROCESO"}
                </Chip>
                <Chip color="warning" size="sm" variant="flat">
                  Multi-equipo deshabilitado
                </Chip>
              </div>
            </CardHeader>
            <CardBody className="space-y-3 pt-0">
              <div className="flex flex-wrap gap-3">
                {data.images.length > 0 ? (
                  data.images.map((image) => (
                    <a
                      key={image.key}
                      className="group w-[120px]"
                      href={image.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <div className="relative h-24 w-[120px] overflow-hidden rounded border border-default-200">
                        <Image
                          alt={image.label}
                          className="object-cover transition-transform group-hover:scale-105"
                          height={96}
                          src={image.url}
                          unoptimized
                          width={120}
                        />
                      </div>
                      <div className="mt-1 line-clamp-2 text-[10px] text-default-500">
                        {image.label}
                      </div>
                    </a>
                  ))
                ) : (
                  <div className="text-sm text-default-500">Sin imagenes disponibles.</div>
                )}
              </div>
            </CardBody>
          </Card>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Card className="border border-divider" radius="sm" shadow="none">
              <CardHeader>
                <div className="text-sm font-semibold">Tallas y empaque</div>
              </CardHeader>
              <CardBody className="space-y-2 pt-0">
                {data.packaging.sizesBreakdown.length > 0 ? (
                  data.packaging.sizesBreakdown.map((size) => (
                    <div key={size.size} className="text-sm text-default-600">
                      {size.size}: {size.totalQuantity} ({size.mode})
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-default-500">Sin desglose de tallas.</div>
                )}
              </CardBody>
            </Card>

            <Card className="border border-divider" radius="sm" shadow="none">
              <CardHeader>
                <div className="text-sm font-semibold">Requerimientos especiales</div>
              </CardHeader>
              <CardBody className="space-y-2 pt-0">
                {data.specialRequirements.length > 0 ? (
                  data.specialRequirements.map((requirement) => (
                    <div key={requirement.id} className="text-sm text-default-600">
                      {requirement.piece ?? "Pieza"} · {requirement.fabric ?? "Sin tela"}
                      {requirement.fabricColor ? ` · ${requirement.fabricColor}` : ""}
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-default-500">Sin requerimientos especiales.</div>
                )}
              </CardBody>
            </Card>
          </div>

          <Card className="border border-divider" radius="sm" shadow="none">
            <CardHeader>
              <div className="text-sm font-semibold">Molderia aplicada</div>
            </CardHeader>
            <CardBody className="space-y-2 pt-0">
              {data.appliedMoldings.length > 0 ? (
                data.appliedMoldings.map((molding) => (
                  <div key={molding.id} className="rounded-medium border border-default-100 p-2">
                    <div className="text-sm font-medium">
                      {molding.moldingCode ?? "MOLDERIA"}
                      {molding.version ? ` v${molding.version}` : ""}
                    </div>
                    <div className="text-xs text-default-500">
                      {molding.garmentType ?? "-"} · {molding.garmentSubtype ?? "-"} · Tela {molding.fabric ?? "-"}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-default-500">Sin molderia aplicada.</div>
              )}
            </CardBody>
          </Card>

          <Card className="border border-divider" radius="sm" shadow="none">
            <CardHeader className="flex items-center justify-between">
              <div className="text-sm font-semibold">Purchase hints</div>
              <Chip color="warning" size="sm" variant="flat">
                Pendiente parametrizacion insumos
              </Chip>
            </CardHeader>
            <CardBody className="space-y-2 pt-0">
              {data.purchaseHints.requirements.map((requirement) => (
                <div key={requirement.key} className="rounded-medium border border-default-100 p-2">
                  <div className="text-sm font-medium">{requirement.label}</div>
                  <div className="text-sm text-default-600">{requirement.value ?? "Por definir"}</div>
                  {requirement.details ? (
                    <div className="text-xs text-default-500">{requirement.details}</div>
                  ) : null}
                </div>
              ))}
            </CardBody>
          </Card>
        </>
      ) : null}
    </div>
  );
}