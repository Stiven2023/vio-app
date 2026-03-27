"use client";

import type { DesignFullView } from "@/src/types/design-overview";

import React from "react";
import Image from "next/image";
import NextLink from "next/link";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";

type MesDesignOverviewPanelProps = {
  items: Array<{
    orderItemId: string;
    name: string;
    quantity: number;
  }>;
};

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? "Error");
}

export function MesDesignOverviewPanel({ items }: MesDesignOverviewPanelProps) {
  const [views, setViews] = React.useState<Record<string, DesignFullView>>({});
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const itemIds = React.useMemo(
    () => items.map((item) => String(item.orderItemId ?? "").trim()).filter(Boolean),
    [items],
  );

  React.useEffect(() => {
    if (itemIds.length === 0) {
      setViews({});
      setError(null);
      setLoading(false);

      return;
    }

    let active = true;

    setLoading(true);
    setError(null);

    Promise.all(
      itemIds.map(async (orderItemId) => {
        const response = await fetch(`/api/mes/designs/${orderItemId}`);

        if (!response.ok) {
          throw new Error(await response.text());
        }

        return (await response.json()) as DesignFullView;
      }),
    )
      .then((payload) => {
        if (!active) return;

        const next: Record<string, DesignFullView> = {};

        for (const view of payload) {
          next[view.orderItemId] = view;
        }

        setViews(next);
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
  }, [itemIds]);

  return (
    <div className="rounded-medium border border-default-200 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-default-600">Diseño completo (MES snapshot)</p>
        <Chip color="warning" size="sm" variant="flat">
          Multi-equipo deshabilitado
        </Chip>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-default-500">
          <Spinner size="sm" />
          <span className="text-sm">Cargando snapshot de diseño...</span>
        </div>
      ) : null}

      {error ? <div className="text-sm text-danger">{error}</div> : null}

      {!loading && !error && itemIds.length === 0 ? (
        <div className="text-sm text-default-500">
          No hay diseños con `orderItemId` disponible para mostrar snapshot.
        </div>
      ) : null}

      <div className="space-y-3">
        {items.map((item) => {
          const view = views[item.orderItemId];

          if (!view) {
            return (
              <Card key={item.orderItemId} shadow="none">
                <CardBody className="text-sm text-default-500">
                  Snapshot no disponible para {item.name}
                </CardBody>
              </Card>
            );
          }

          return (
            <Card key={item.orderItemId} className="border border-default-100" shadow="none">
              <CardHeader className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{view.designName}</div>
                  <div className="text-xs text-default-500">
                    Pedido {view.orderCode} · Qty {view.quantity}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <Chip size="sm" variant="flat">
                    {view.productionTechnique ?? "SIN_TECNICA"}
                  </Chip>
                  <Chip size="sm" variant="flat">
                    {view.process ?? "SIN_PROCESO"}
                  </Chip>
                  <Button
                    as={NextLink}
                    href={`/mes/designs/${view.orderItemId}`}
                    rel="noreferrer"
                    size="sm"
                    target="_blank"
                    variant="flat"
                  >
                    Ver detalle
                  </Button>
                </div>
              </CardHeader>
              <CardBody className="space-y-3 pt-0">
                <div className="flex flex-wrap gap-2">
                  {view.images.slice(0, 6).map((image) => (
                    <a
                      key={image.key}
                      className="group w-[96px]"
                      href={image.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <div className="relative h-20 w-24 overflow-hidden rounded border border-default-200">
                        <Image
                          alt={image.label}
                          className="object-cover transition-transform group-hover:scale-105"
                          height={80}
                          src={image.url}
                          unoptimized
                          width={96}
                        />
                      </div>
                      <div className="mt-1 line-clamp-2 text-[10px] text-default-500">
                        {image.label}
                      </div>
                    </a>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <div className="rounded-medium border border-default-100 p-2">
                    <div className="mb-1 text-xs font-semibold text-default-600">Tallas</div>
                    <div className="text-xs text-default-500">
                      {view.packaging.sizesBreakdown.length > 0
                        ? view.packaging.sizesBreakdown
                            .map(
                              (size) =>
                                `${size.size}: ${size.totalQuantity} (${size.mode})`,
                            )
                            .join(" | ")
                        : "Sin desglose de tallas"}
                    </div>
                  </div>

                  <div className="rounded-medium border border-default-100 p-2">
                    <div className="mb-1 text-xs font-semibold text-default-600">Compras (hints)</div>
                    <div className="space-y-1">
                      {view.purchaseHints.requirements.slice(0, 4).map((req) => (
                        <div key={req.key} className="text-xs text-default-500">
                          <span className="font-medium text-default-700">{req.label}:</span>{" "}
                          {req.value ?? "Por definir"}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}